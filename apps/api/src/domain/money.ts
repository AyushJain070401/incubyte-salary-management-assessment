import { currencyMinorDigits, MinorUnitsSchema } from '@acme/shared';

// Domain helpers for money. Internally the api works with BigInt because
// Prisma returns `BigInt` for the `amount_minor` column. On the wire
// (JSON in / JSON out) amounts are strings — see docs/TRADE-OFFS.md
// ("Money") for why.

// Convert a BigInt minor-units value to the wire string ("12500" for
// $125.00). Validates against the shared MinorUnits regex so a buggy
// caller can't silently send something malformed.
export function toWire(amount: bigint): string {
  if (amount < 0n) throw new Error('amount must be non-negative');
  const asString = amount.toString();
  // Belt and braces: round-trip through the wire schema so the same
  // validator that gates inbound requests gates outbound responses too.
  return MinorUnitsSchema.parse(asString);
}

// Convert a wire string ("12500") to a BigInt. Validates via the shared
// schema so a buggy caller hits the same error path inbound requests do.
export function fromWire(amount: string): bigint {
  const validated = MinorUnitsSchema.parse(amount);
  return BigInt(validated);
}

// Format a BigInt minor-units value as a human-readable major-units number
// for analytics (averages, sums). Used at the read layer when computing
// display figures. Returns a number; precision is safe up to ~9e15 minor
// units, which is more than any realistic salary aggregate.
export function toMajorNumber(amount: bigint, currency: string): number {
  const digits = currencyMinorDigits(currency);
  if (digits === 0) return Number(amount);
  return Number(amount) / 10 ** digits;
}

// Add two minor amounts. Both must be in the SAME currency — currency
// addition isn't meaningful (would silently lose information). Caller
// asserts the currencies match before calling.
export function addMinor(a: bigint, b: bigint): bigint {
  return a + b;
}

// Multiply a minor amount by a positive decimal factor (e.g. an FX rate
// expressed as a number). Rounds to the nearest minor unit using
// banker's rounding-free integer math. Returns a BigInt.
//
// Implementation: scale the factor to an integer with a fixed precision
// (10^9 here — enough for FX rates which are typically ~6 d.p.), then do
// the multiply in BigInt space and divide out. Avoids any floating-point
// intermediate over the amount itself.
const FACTOR_PRECISION = 9n;
const FACTOR_SCALE = 10n ** FACTOR_PRECISION;

export function multiplyMinorByFactor(amount: bigint, factor: number): bigint {
  if (!Number.isFinite(factor)) throw new Error('factor must be a finite number');
  if (factor < 0) throw new Error('factor must be non-negative');

  // Scale the factor to a BigInt with FACTOR_PRECISION decimal places.
  // Math.round here is on the FACTOR not the amount — the amount stays
  // exact through the BigInt multiplication.
  const scaledFactor = BigInt(Math.round(factor * Number(FACTOR_SCALE)));
  const product = amount * scaledFactor;

  // Divide back out, rounding half-up.
  const halfScale = FACTOR_SCALE / 2n;
  return (product + halfScale) / FACTOR_SCALE;
}
