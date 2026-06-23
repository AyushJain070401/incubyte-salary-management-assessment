import { z } from 'zod';

// Money is stored and transmitted as integer MINOR UNITS (cents, paise, etc.)
// represented as a base-10 string. The string form avoids precision loss when
// values exceed Number.MAX_SAFE_INTEGER and makes the bigint -> JSON crossing
// safe without any custom serialization on the wire.
//
// See docs/TRADE-OFFS.md ("Money") for the rationale.

export const MinorUnitsSchema: z.ZodString = z
  .string()
  .regex(/^(0|[1-9]\d*)$/u, 'amount must be a non-negative integer in minor units')
  .max(20, 'amount is implausibly large');

export type MinorUnits = z.infer<typeof MinorUnitsSchema>;

// ISO-4217 currency code: three uppercase letters.
// We don't restrict to an enum because new currencies should not require a
// schema change. Validation that the currency is one we *support* (have an
// FX rate for) is enforced at the application layer, not the wire schema.
export const CurrencySchema: z.ZodString = z
  .string()
  .length(3, 'currency must be ISO-4217 (3 letters)')
  .regex(/^[A-Z]{3}$/u, 'currency must be uppercase A-Z');

export type Currency = z.infer<typeof CurrencySchema>;

export const MoneySchema = z.object({
  amountMinor: MinorUnitsSchema,
  currency: CurrencySchema,
});

export type Money = z.infer<typeof MoneySchema>;

// Number of fractional digits for a currency under ISO-4217.
// Covers the cases we seed; defaults to 2 for everything else (correct for
// the vast majority of currencies). Authoritative table is the ISO list.
const MINOR_DIGITS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
  TND: 3,
};

export function currencyMinorDigits(currency: string): number {
  return MINOR_DIGITS[currency] ?? 2;
}

// Convert a major-unit value the user typed (e.g. 85000.50) into a
// minor-units string ("8500050" for USD). Throws if `major` is negative,
// not finite, or has more fractional digits than the currency supports.
export function majorToMinor(major: number, currency: string): string {
  if (!Number.isFinite(major)) throw new Error('major must be a finite number');
  if (major < 0) throw new Error('major must be non-negative');

  const digits = currencyMinorDigits(currency);
  const factor = 10 ** digits;
  const scaled = Math.round(major * factor);

  // Guard against silent precision loss: if `major * factor` overflows
  // Number.MAX_SAFE_INTEGER the rounded value is unreliable.
  if (!Number.isSafeInteger(scaled)) {
    throw new Error('amount exceeds safe integer range for this currency');
  }

  return scaled.toString();
}

// Convert a minor-units string back to a major-unit number for display.
// Returns a `number`, which is safe for any realistic salary value
// (USD 1 trillion ≈ 1e14 < Number.MAX_SAFE_INTEGER).
export function minorToMajor(minor: string, currency: string): number {
  const parsed = MinorUnitsSchema.parse(minor);
  const digits = currencyMinorDigits(currency);
  const asNumber = Number(parsed);
  return asNumber / 10 ** digits;
}
