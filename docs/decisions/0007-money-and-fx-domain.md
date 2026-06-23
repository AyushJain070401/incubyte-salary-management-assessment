# ADR 0007: Money as BigInt minor units + snapshot FX with direct currency pairs

## Status

accepted — 2026-06-23

## Context

The application is multi-currency at its core: employees in different countries are paid in different currencies, and the dashboard needs to compare them in a single display currency. Two questions to answer:

1. How are money amounts represented in code, in the database, and on the wire?
2. How does currency conversion work?

### Money representation

Three things money math gets wrong in production:

- **Floating-point arithmetic on currency.** `0.1 + 0.2 !== 0.3`. Two reads of "the same" salary can return different totals depending on the order of aggregation.
- **Implicit currency.** A `salary` column with no currency context means "USD" until the day someone pays an Indian employee in INR and the aggregation reports `salaries.sum = 18_000_000` because rupees got added to dollars.
- **JSON `bigint` confusion.** Sending `12500000000` as a JSON number works until the client is an older JS runtime that silently truncates anything above `Number.MAX_SAFE_INTEGER` (≈ 9e15). Cents up to $90 trillion is safe; minor units in zero-decimal currencies (KRW, JPY) at the scale of company-wide payroll get closer.

### FX conversion

The dashboard needs to convert salaries to a chosen display currency. Three approaches:

1. **Live FX provider** (Open Exchange Rates, ECB, fixer.io). Real-time but: cost, third-party failure mode, non-deterministic tests, rate jitter between two reads of the same dashboard.
2. **Snapshot rates with periodic refresh.** Daily/weekly batch job updates the rates. Live-ish but introduces a job scheduler, retries, alerting on stale rates.
3. **Fixed snapshot.** A seeded table of rates, treated as part of the application data. Same conversion every time. No external dependencies.

For an HR app where "what's the median engineer salary in EUR right now" is the question being asked, none of these is wrong — but live rates would make tests flake and add a moving piece for marginal product value. Snapshot rates are honest about what we can guarantee.

### Conversion topology

Within snapshot rates: **direct pairs vs base-currency hub.**

- **Direct pairs (`USD↔EUR`, `USD↔GBP`, `USD↔INR`, `EUR↔GBP`, …).** N currencies need N×(N-1) rates. With 4 currencies that's 12 rows — trivial.
- **Hub via a base currency.** All rates are `base→quote`. Converting `EUR→GBP` does `EUR→USD→GBP`, multiplying two rates. Smaller table (N-1 rows) but rounding compounds and the maths is more error-prone.

At 4 supported currencies the table-size argument doesn't matter. Direct pairs are simpler to reason about and have one rounding step per conversion.

## Decision

### Money representation

- **Stored as `BIGINT` minor units + ISO-4217 currency code.** Salaries column is `amount_minor: bigint`, currency is `char(3)`.
- **In application code, amounts are `BigInt`.** Prisma returns `bigint` for the column; the domain layer keeps it as `bigint` through all arithmetic.
- **On the wire, amounts are JSON strings.** Outbound: `BigInt.toString()`. Inbound: validated by the shared `MinorUnitsSchema` (non-negative integer regex) and converted to `BigInt`. The `@acme/shared` package defines the schema; the api's `domain/money.ts` does the conversion via `toWire` / `fromWire`.

Helpers in `apps/api/src/domain/money.ts`:

- `toWire(amount: bigint) -> string` — JSON-safe serialization, validates against the schema.
- `fromWire(amount: string) -> bigint` — JSON-safe parsing, validates against the schema.
- `addMinor(a, b) -> bigint` — addition. Caller asserts same currency.
- `multiplyMinorByFactor(amount, factor: number) -> bigint` — multiplication by a non-integer factor (e.g. an FX rate). Scales the factor to a BigInt with 9 decimal places of precision before multiplying, so the amount itself never crosses into floating-point.
- `toMajorNumber(amount, currency) -> number` — for display formatting only. Returns a `number`; safe up to ~9e15 minor units, which exceeds any realistic salary aggregate.

### FX conversion

- **Snapshot table `fx_rates(base_currency, quote_currency, rate, as_of)`.** Schema lives in [ADR 0006](0006-append-only-salary-history.md)'s migration.
- **Direct pairs** for every supported (from, to) combination. With USD/EUR/GBP/INR/JPY supported in v1 that's 20 rows; seeded once and never refreshed.
- **Conversion picks the most recent `as_of`** for the requested pair. If no row exists, the conversion throws — the API maps that to a `422 unprocessable` with a clear message rather than silently substituting the source amount.
- **Precision adjustment across currency pairs.** Converting USD (2 minor digits) to JPY (0 minor digits) needs to account for the difference: `result_minor = amount_minor × rate × 10^(toDigits - fromDigits)`. The helper `convertMinor` in `domain/fx.ts` does this in one call.

### Tests

`domain/money.test.ts` (18 cases) and `domain/fx.test.ts` (12 cases) cover:

- Wire serialization round-trips, including amounts beyond `Number.MAX_SAFE_INTEGER`.
- Currencies with 0, 2, and 3 minor digits (KRW/JPY, USD/EUR, BHD/KWD).
- Rate selection by most-recent `as_of`, identity conversions, missing pairs, directional asymmetry (`USD→EUR` ≠ `EUR→USD`).
- Multiplication rounding at the half-up boundary.
- Conversion across precision changes in both directions (2→0, 0→2, 2→3).
- Large amounts ($1B-scale) to verify no precision drift.

## Consequences

**Easier:**
- Integer arithmetic eliminates the floating-point class of bugs entirely. Aggregations are exact regardless of read order.
- Currency is always co-located with amount; an aggregate that mixes currencies is a compile-time impossibility (different types) and a test-time error (mismatched currency assertion).
- Tests are deterministic — the same query returns the same number every time.
- Adding a new currency is one row per existing currency in the FX table.

**Harder:**
- BigInt is awkward to serialize. Worked around with `toWire`/`fromWire` and a JSON-string convention on the wire.
- Multiplication by a non-integer factor (FX rates) requires the scaling trick. Encapsulated in `multiplyMinorByFactor`; callers don't see it.
- Direct-pairs FX means seeding `N×(N-1)` rates whenever currencies are added. At our scale (≤ 10 currencies) this is cheap; at 100 currencies it would warrant the hub model.

**Not chosen — and why:**
- **Floating-point money** — never, for reasons everyone in the industry already agrees on.
- **`Decimal` columns instead of `BigInt`** — Postgres `numeric(20, 4)` works but loses parity with the application BigInt; also Prisma maps `Decimal` to a `Decimal` JS object, which is another precision context to reason about. BigInt is one consistent representation top to bottom.
- **Live FX** — non-deterministic, third-party failure mode, marginal product value for an HR dashboard.
- **Hub conversion via USD** — smaller table but rounding compounds and the maths needs extra care. At 4-10 currencies the saved rows aren't worth the conceptual cost.
- **Library-based money** (`dinero.js`, `money-ts`) — solid libraries, but adds a runtime dependency that maps closely to what these few helper functions do. The application benefits from owning the helpers because they're tightly coupled to our serialization rules (JSON string, BigInt-internal).
