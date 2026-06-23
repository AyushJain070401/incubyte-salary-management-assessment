import { describe, it, expect } from 'vitest';
import { findLatestRate, convertMinor, type FxRate } from './fx.js';

const rate = (
  baseCurrency: string,
  quoteCurrency: string,
  rateValue: number,
  asOfIso: string,
): FxRate => ({
  baseCurrency,
  quoteCurrency,
  rate: rateValue,
  asOf: new Date(asOfIso),
});

describe('findLatestRate', () => {
  const rates: FxRate[] = [
    rate('USD', 'EUR', 0.91, '2026-01-01'),
    rate('USD', 'EUR', 0.92, '2026-06-01'), // newer
    rate('USD', 'EUR', 0.89, '2025-12-01'), // older
    rate('EUR', 'USD', 1.10, '2026-06-01'),
    rate('USD', 'GBP', 0.78, '2026-06-01'),
  ];

  it('returns 1 for identity conversions', () => {
    expect(findLatestRate(rates, 'USD', 'USD')).toBe(1);
    expect(findLatestRate(rates, 'XYZ', 'XYZ')).toBe(1);
  });

  it('returns the newest rate when multiple exist for the pair', () => {
    expect(findLatestRate(rates, 'USD', 'EUR')).toBe(0.92);
  });

  it('returns null when no rate exists for the pair', () => {
    expect(findLatestRate(rates, 'JPY', 'USD')).toBeNull();
  });

  it('is directional — USD->EUR is not the same row as EUR->USD', () => {
    expect(findLatestRate(rates, 'USD', 'EUR')).toBe(0.92);
    expect(findLatestRate(rates, 'EUR', 'USD')).toBe(1.10);
  });

  it('handles an empty rate set', () => {
    expect(findLatestRate([], 'USD', 'EUR')).toBeNull();
  });
});

describe('convertMinor', () => {
  const rates: FxRate[] = [
    rate('USD', 'EUR', 0.92, '2026-06-01'),
    rate('USD', 'JPY', 150, '2026-06-01'),
    rate('USD', 'BHD', 0.376, '2026-06-01'),
    rate('JPY', 'USD', 0.0067, '2026-06-01'),
  ];

  it('returns the input unchanged for identity conversions', () => {
    expect(convertMinor(12500n, 'USD', 'USD', rates)).toBe(12500n);
  });

  it('converts USD -> EUR at the same minor-digit precision', () => {
    // $100.00 (10000 minor) * 0.92 = €92.00 (9200 minor)
    expect(convertMinor(10000n, 'USD', 'EUR', rates)).toBe(9200n);
  });

  it('converts USD -> JPY across a precision change (2 -> 0 digits)', () => {
    // $100.00 (10000 USD-minor) * 150 = ¥15000 (15000 JPY-minor, no decimals)
    expect(convertMinor(10000n, 'USD', 'JPY', rates)).toBe(15000n);
  });

  it('converts JPY -> USD (0 -> 2 digits)', () => {
    // ¥10000 (10000 JPY-minor) * 0.0067 = $67.00 (6700 USD-minor)
    expect(convertMinor(10000n, 'JPY', 'USD', rates)).toBe(6700n);
  });

  it('converts USD -> BHD across a precision change (2 -> 3 digits)', () => {
    // $100.00 (10000 USD-minor) * 0.376 = 37.600 BHD (37600 BHD-minor)
    expect(convertMinor(10000n, 'USD', 'BHD', rates)).toBe(37600n);
  });

  it('throws if no rate is available for the pair', () => {
    expect(() => convertMinor(10000n, 'EUR', 'JPY', rates)).toThrow(
      /no FX rate available for EUR -> JPY/,
    );
  });

  it('handles very large amounts without precision loss', () => {
    // $1 billion in cents = 100_000_000_000 USD-minor
    //   * 0.92 = 92_000_000_000 EUR-minor (€920,000,000)
    expect(convertMinor(100_000_000_000n, 'USD', 'EUR', rates)).toBe(92_000_000_000n);
  });
});
