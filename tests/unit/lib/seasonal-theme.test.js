import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SEASONAL_THEME_STORAGE_KEY,
  SEASONAL_THEME_MODES,
  normalizeSeasonalPreference,
  getStoredSeasonalPreference,
  resolveSeasonalTheme,
  resolveActiveSeasonalTheme,
} from '../../../src/lib/seasonal-theme.js';

const LUNAR_NEW_YEAR_DATES_BY_YEAR = {
  2026: '2026-02-17',
  2027: '2027-02-06',
  2028: '2028-01-26',
  2029: '2029-02-13',
  2030: '2030-02-03',
  2031: '2031-01-23',
  2032: '2032-02-11',
  2033: '2033-01-31',
  2034: '2034-02-19',
  2035: '2035-02-08',
  2036: '2036-01-28',
  2037: '2037-02-15',
  2038: '2038-02-04',
  2039: '2039-01-24',
  2040: '2040-02-12',
  2041: '2041-02-01',
  2042: '2042-01-22',
  2043: '2043-02-10',
  2044: '2044-01-30',
  2045: '2045-02-17',
};

function isoDate(iso) {
  return new Date(`${iso}T12:00:00Z`);
}

function shiftIso(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normalizeSeasonalPreference', () => {
  it('accepts known seasonal preference modes', () => {
    expect(normalizeSeasonalPreference('off')).toBe('off');
    expect(normalizeSeasonalPreference('automatic')).toBe('automatic');
  });

  it('normalizes surrounding whitespace in known modes', () => {
    expect(normalizeSeasonalPreference(' off ')).toBe('off');
    expect(normalizeSeasonalPreference(' automatic ')).toBe('automatic');
  });

  it('falls back to off for invalid or non-string values', () => {
    expect(normalizeSeasonalPreference(null)).toBe('off');
    expect(normalizeSeasonalPreference(undefined)).toBe('off');
    expect(normalizeSeasonalPreference('')).toBe('off');
    expect(normalizeSeasonalPreference('auto')).toBe('off');
    expect(normalizeSeasonalPreference('Automatic')).toBe('off');
    expect(normalizeSeasonalPreference({})).toBe('off');
    expect(normalizeSeasonalPreference(1)).toBe('off');
  });
});

describe('SEASONAL_THEME_MODES', () => {
  it('exposes the supported preference modes', () => {
    expect(SEASONAL_THEME_MODES).toEqual(['off', 'automatic']);
    expect(Object.isFrozen(SEASONAL_THEME_MODES)).toBe(true);
  });
});

describe('getStoredSeasonalPreference', () => {
  it('reads the stored seasonal preference', () => {
    const storage = new Map([[SEASONAL_THEME_STORAGE_KEY, 'automatic']]);
    vi.stubGlobal('localStorage', {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    });

    expect(getStoredSeasonalPreference()).toBe('automatic');
  });

  it('falls back to off when the stored preference is missing or invalid', () => {
    const storage = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    });

    expect(getStoredSeasonalPreference()).toBe('off');

    storage.set(SEASONAL_THEME_STORAGE_KEY, 'not-a-mode');
    expect(getStoredSeasonalPreference()).toBe('off');
  });

  it('falls back to off when localStorage access throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage unavailable');
      },
    });

    expect(getStoredSeasonalPreference()).toBe('off');
  });
});

describe('Halloween window', () => {
  it('resolves Halloween for every day from 1 October through 31 October', () => {
    expect(resolveSeasonalTheme(isoDate('2026-10-01'))).toBe('halloween');
    expect(resolveSeasonalTheme(isoDate('2026-10-15'))).toBe('halloween');
    expect(resolveSeasonalTheme(isoDate('2026-10-31'))).toBe('halloween');

    expect(resolveSeasonalTheme(isoDate('2026-09-30'))).toBeNull();
    expect(resolveSeasonalTheme(isoDate('2026-11-01'))).toBeNull();
  });

  it('uses Europe/London calendar date rather than local machine time', () => {
    // 2026-10-01T03:30:00Z is still 1 October in Europe/London.
    expect(resolveSeasonalTheme(new Date('2026-10-01T03:30:00Z'))).toBe('halloween');

    // 2026-09-30T22:30:00Z is still 30 September in Europe/London.
    expect(resolveSeasonalTheme(new Date('2026-09-30T22:30:00Z'))).toBeNull();
  });
});

describe('Christmas window', () => {
  it('resolves Christmas from Advent Sunday through 5 January', () => {
    expect(resolveSeasonalTheme(isoDate('2026-12-03'))).toBe('christmas');
    expect(resolveSeasonalTheme(isoDate('2026-12-25'))).toBe('christmas');
    expect(resolveSeasonalTheme(isoDate('2027-01-05'))).toBe('christmas');

    expect(resolveSeasonalTheme(isoDate('2026-11-28'))).toBeNull();
    expect(resolveSeasonalTheme(isoDate('2027-01-06'))).toBeNull();
  });

  it('handles the following year Christmas rollover boundary', () => {
    expect(resolveSeasonalTheme(isoDate('2027-12-02'))).toBe('christmas');
    expect(resolveSeasonalTheme(isoDate('2028-01-05'))).toBe('christmas');
    expect(resolveSeasonalTheme(isoDate('2027-11-27'))).toBeNull();
    expect(resolveSeasonalTheme(isoDate('2028-01-06'))).toBeNull();
  });
});

describe('Chinese New Year window', () => {
  it('resolves Chinese New Year from Lunar New Year’s Eve through Lantern Festival for every embedded 2026–2045 year', () => {
    for (const [year, lunarNewYearIso] of Object.entries(LUNAR_NEW_YEAR_DATES_BY_YEAR)) {
      const startIso = shiftIso(lunarNewYearIso, -1);
      const endIso = shiftIso(lunarNewYearIso, 14);

      expect(resolveSeasonalTheme(isoDate(startIso)), `start for ${year}`).toBe('cny');
      expect(resolveSeasonalTheme(isoDate(lunarNewYearIso)), `first day for ${year}`).toBe('cny');
      expect(resolveSeasonalTheme(isoDate(endIso)), `end for ${year}`).toBe('cny');

      expect(resolveSeasonalTheme(isoDate(shiftIso(startIso, -1))), `before ${year}`).not.toBe('cny');
      expect(resolveSeasonalTheme(isoDate(shiftIso(endIso, 1))), `after ${year}`).not.toBe('cny');
    }
  });

  it('does not infer Chinese New Year dates for years outside the embedded 2026–2045 table', () => {
    expect(resolveSeasonalTheme(isoDate('2025-02-10'))).toBeNull();
    expect(resolveSeasonalTheme(isoDate('2026-01-28'))).toBeNull();
    expect(resolveSeasonalTheme(isoDate('2046-02-10'))).toBeNull();
  });
});

describe('resolveSeasonalTheme', () => {
  it('returns null for unsupported seasons and invalid dates', () => {
    expect(resolveSeasonalTheme(isoDate('2026-06-15'))).toBeNull();
    expect(resolveSeasonalTheme(isoDate('2026-08-01'))).toBeNull();
    expect(resolveSeasonalTheme(new Date('not a date'))).toBeNull();
  });

  it('returns null when automatic preference is off', () => {
    expect(resolveActiveSeasonalTheme('off', isoDate('2026-10-31'))).toBeNull();
    expect(resolveActiveSeasonalTheme('off', isoDate('2026-12-25'))).toBeNull();
    expect(resolveActiveSeasonalTheme('off', isoDate('2026-02-17'))).toBeNull();
  });
});

describe('resolveActiveSeasonalTheme', () => {
  it('returns null for off, malformed, and invalid preferences even during seasonal windows', () => {
    expect(resolveActiveSeasonalTheme('off', isoDate('2026-10-31'))).toBeNull();
    expect(resolveActiveSeasonalTheme(' automatic ', isoDate('2026-12-25'))).toBe('christmas');
    expect(resolveActiveSeasonalTheme('invalid', isoDate('2026-10-31'))).toBeNull();
  });

  it('returns the resolved seasonal theme for automatic mode', () => {
    expect(resolveActiveSeasonalTheme('automatic', isoDate('2026-10-15'))).toBe('halloween');
    expect(resolveActiveSeasonalTheme('automatic', isoDate('2026-12-25'))).toBe('christmas');
    expect(resolveActiveSeasonalTheme('automatic', isoDate('2026-02-17'))).toBe('cny');
    expect(resolveActiveSeasonalTheme('automatic', isoDate('2026-06-01'))).toBeNull();
  });
});
