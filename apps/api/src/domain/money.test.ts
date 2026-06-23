import { describe, it, expect } from 'vitest';
import {
  toWire,
  fromWire,
  toMajorNumber,
  addMinor,
  multiplyMinorByFactor,
} from './money.js';

describe('toWire', () => {
  it('returns the bigint as a decimal string', () => {
    expect(toWire(0n)).toBe('0');
    expect(toWire(12500n)).toBe('12500');
    expect(toWire(9_999_999_999_999_999n)).toBe('9999999999999999');
  });

  it('rejects negative amounts', () => {
    expect(() => toWire(-1n)).toThrow();
  });
});

describe('fromWire', () => {
  it('parses a valid string', () => {
    expect(fromWire('0')).toBe(0n);
    expect(fromWire('12500')).toBe(12500n);
    expect(fromWire('9999999999999999999')).toBe(9999999999999999999n);
  });

  it('rejects non-integer strings', () => {
    expect(() => fromWire('12.50')).toThrow();
    expect(() => fromWire('-100')).toThrow();
    expect(() => fromWire('abc')).toThrow();
    expect(() => fromWire('')).toThrow();
  });

  it('rejects leading zeros (canonical form only)', () => {
    expect(() => fromWire('00100')).toThrow();
  });

  it('round-trips with toWire', () => {
    const cases = [0n, 1n, 100n, 8_500_000n, 99_999_999_999_999n];
    for (const c of cases) {
      expect(fromWire(toWire(c))).toBe(c);
    }
  });
});

describe('toMajorNumber', () => {
  it('divides by 100 for two-digit currencies', () => {
    expect(toMajorNumber(0n, 'USD')).toBe(0);
    expect(toMajorNumber(1n, 'USD')).toBe(0.01);
    expect(toMajorNumber(12500n, 'USD')).toBe(125);
    expect(toMajorNumber(12345n, 'EUR')).toBe(123.45);
  });

  it('returns the bigint as a number for zero-digit currencies', () => {
    expect(toMajorNumber(1000n, 'JPY')).toBe(1000);
    expect(toMajorNumber(0n, 'KRW')).toBe(0);
  });

  it('divides by 1000 for three-digit currencies', () => {
    expect(toMajorNumber(1000n, 'BHD')).toBe(1);
    expect(toMajorNumber(1234567n, 'KWD')).toBe(1234.567);
  });

  it('defaults to two-digit precision for unknown currencies', () => {
    expect(toMajorNumber(12500n, 'XYZ')).toBe(125);
  });
});

describe('addMinor', () => {
  it('adds two bigints', () => {
    expect(addMinor(100n, 200n)).toBe(300n);
    expect(addMinor(0n, 0n)).toBe(0n);
  });

  it('handles values beyond Number.MAX_SAFE_INTEGER', () => {
    const big = 9_007_199_254_740_993n; // MAX_SAFE_INTEGER + 2
    expect(addMinor(big, big)).toBe(18_014_398_509_481_986n);
  });
});

describe('multiplyMinorByFactor', () => {
  it('returns the same amount when multiplied by 1', () => {
    expect(multiplyMinorByFactor(12500n, 1)).toBe(12500n);
  });

  it('returns 0 when multiplied by 0', () => {
    expect(multiplyMinorByFactor(12500n, 0)).toBe(0n);
  });

  it('multiplies and rounds half-up', () => {
    // 100 minor * 1.005 = 100.5 minor -> rounds to 101
    expect(multiplyMinorByFactor(100n, 1.005)).toBe(101n);
    // 100 minor * 1.004 = 100.4 minor -> rounds to 100
    expect(multiplyMinorByFactor(100n, 1.004)).toBe(100n);
  });

  it('handles an FX-style rate to 6 decimals exactly', () => {
    // EUR -> USD at 1.073621: €85,000.00 (8,500,000 minor)
    //   8,500,000 * 1.073621 = 9,125,778.5 -> rounds to 9,125,779
    expect(multiplyMinorByFactor(8_500_000n, 1.073621)).toBe(9_125_779n);
  });

  it('rejects negative or non-finite factors', () => {
    expect(() => multiplyMinorByFactor(100n, -1)).toThrow();
    expect(() => multiplyMinorByFactor(100n, NaN)).toThrow();
    expect(() => multiplyMinorByFactor(100n, Infinity)).toThrow();
  });

  it('preserves precision over very large amounts', () => {
    // $1 billion in cents = 100,000,000,000 minor, * 1.5 = 150,000,000,000
    expect(multiplyMinorByFactor(100_000_000_000n, 1.5)).toBe(150_000_000_000n);
  });
});
