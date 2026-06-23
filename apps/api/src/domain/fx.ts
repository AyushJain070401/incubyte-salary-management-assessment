import { currencyMinorDigits } from '@acme/shared';
import { multiplyMinorByFactor } from './money.js';

// Snapshot FX rate. Mirrors the shape of `fx_rates` rows but uses plain
// JS types (the repo layer translates Prisma's Decimal/Date to these).
export type FxRate = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  asOf: Date;
};

// Find the most recent rate for converting `from` -> `to`. Identity
// conversion (from === to) returns 1 without needing a row.
//
// Returns null if no rate is on file for the pair. Caller decides whether
// that's a 404, a 422, or a fallback.
export function findLatestRate(
  rates: readonly FxRate[],
  from: string,
  to: string,
): number | null {
  if (from === to) return 1;

  let best: FxRate | null = null;
  for (const r of rates) {
    if (r.baseCurrency !== from || r.quoteCurrency !== to) continue;
    if (!best || r.asOf > best.asOf) best = r;
  }
  return best ? best.rate : null;
}

// Convert a minor-units amount from one currency to another using the
// most recent rate found in `rates`. Returns a BigInt in the target
// currency's minor units.
//
// The conversion accounts for the difference in minor-unit precision
// between source and target (e.g. USD has 2 minor digits, JPY has 0).
//
// Throws if no rate is found for the (from, to) pair.
export function convertMinor(
  amount: bigint,
  from: string,
  to: string,
  rates: readonly FxRate[],
): bigint {
  if (from === to) return amount;

  const rate = findLatestRate(rates, from, to);
  if (rate === null) {
    throw new Error(`no FX rate available for ${from} -> ${to}`);
  }

  // Adjust for the difference in minor-unit precision between currencies.
  // Example: USD 100.00 (10000 minor) at 1 USD = 110 JPY:
  //   rate = 110, fromDigits = 2, toDigits = 0
  //   precisionFactor = 10^(0-2) = 0.01
  //   result = 10000 * 110 * 0.01 = 11000 minor JPY = 11000 JPY
  // which matches: $100 * 110 = ¥11,000. ✓
  const fromDigits = currencyMinorDigits(from);
  const toDigits = currencyMinorDigits(to);
  const precisionFactor = 10 ** (toDigits - fromDigits);

  return multiplyMinorByFactor(amount, rate * precisionFactor);
}
