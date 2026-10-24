export const SEASONAL_THEME_STORAGE_KEY = 'zuojia-seasonal-theme';
export const SEASONAL_THEME_MODES = Object.freeze(['off', 'automatic']);

export function normalizeSeasonalPreference(value) {
  if (typeof value !== 'string') {
    return 'off';
  }
  const normalized = value.trim();
  return SEASONAL_THEME_MODES.includes(normalized) ? normalized : 'off';
}

export function getStoredSeasonalPreference() {
  try {
    const value = window.localStorage.getItem(SEASONAL_THEME_STORAGE_KEY);
    return normalizeSeasonalPreference(value);
  } catch {
    return 'off';
  }
}

function parseLondonDate(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(parsed);
  const yearPart = parts.find((part) => part.type === 'year')?.value;
  const monthPart = parts.find((part) => part.type === 'month')?.value;
  const dayPart = parts.find((part) => part.type === 'day')?.value;

  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return { year, month, day };
}

function londonDateIso(date) {
  const parts = parseLondonDate(date);
  if (!parts) {
    return null;
  }
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function addCalendarDaysToIso(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getAdventSundayIso(year) {
  const firstCandidate = new Date(Date.UTC(year, 10, 27));
  const daysToSunday = (7 - firstCandidate.getUTCDay()) % 7;
  const adventSunday = new Date(firstCandidate);
  adventSunday.setUTCDate(adventSunday.getUTCDate() + daysToSunday);
  return adventSunday.toISOString().slice(0, 10);
}

function isChristmasWindow(iso) {
  const year = Number(iso.slice(0, 4));
  if (!Number.isInteger(year)) {
    return false;
  }

  for (const targetYear of [year - 1, year]) {
    if (targetYear < 1) {
      continue;
    }
    const startIso = getAdventSundayIso(targetYear);
    const endIso = `${String(targetYear + 1).padStart(4, '0')}-01-05`;
    if (iso >= startIso && iso <= endIso) {
      return true;
    }
  }

  return false;
}

// Lunar New Year’s Day dates for 2026–2045 from Hong Kong Observatory conversion tables:
// https://www.hko.gov.hk/en/gts/time/conversion.htm
const LUNAR_NEW_YEAR_DATES_BY_YEAR = Object.freeze({
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
});

function isCnyWindow(iso) {
  const year = Number(iso.slice(0, 4));
  const lunarNewYearIso = LUNAR_NEW_YEAR_DATES_BY_YEAR[year];
  if (!lunarNewYearIso) {
    return false;
  }
  const startIso = addCalendarDaysToIso(lunarNewYearIso, -1);
  const endIso = addCalendarDaysToIso(lunarNewYearIso, 14);
  return iso >= startIso && iso <= endIso;
}

export function resolveSeasonalTheme(date = new Date()) {
  const iso = londonDateIso(date);
  if (!iso) {
    return null;
  }

  const month = Number(iso.slice(5, 7));
  if (month === 10) {
    return 'halloween';
  }
  if (isChristmasWindow(iso)) {
    return 'christmas';
  }
  if (isCnyWindow(iso)) {
    return 'cny';
  }

  return null;
}

export function resolveActiveSeasonalTheme(preference, date = new Date()) {
  if (normalizeSeasonalPreference(preference) !== 'automatic') {
    return null;
  }
  return resolveSeasonalTheme(date);
}
