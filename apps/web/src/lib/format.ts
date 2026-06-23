// Number of fractional digits per ISO-4217 currency. Mirrors
// @acme/shared/money.ts so the wire amountMinor string can be rendered
// without re-trading off precision.
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

function digits(currency: string): number {
  return MINOR_DIGITS[currency] ?? 2;
}

// Format an amountMinor string + currency code as a localised currency
// string. Uses Intl.NumberFormat so each currency renders with its
// natural symbol and fractional precision.
export function formatMoney(amountMinor: string, currency: string): string {
  const minor = Number(amountMinor);
  const major = minor / 10 ** digits(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      maximumFractionDigits: digits(currency),
    }).format(major);
  } catch {
    // Unknown currency to the runtime — fall back to plain digits.
    return `${major.toLocaleString()} ${currency}`;
  }
}

// Shorter form for table cells: integer-only, with thousands separators.
export function formatMoneyCompact(amountMinor: string, currency: string): string {
  const minor = Number(amountMinor);
  const major = minor / 10 ** digits(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `${Math.round(major).toLocaleString()} ${currency}`;
  }
}

// "2025-03-14" -> "Mar 14, 2025" (locale-aware)
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
