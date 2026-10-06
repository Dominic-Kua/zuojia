const THEME_STORAGE_KEY = 'zuojia-theme';

export function getStoredTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme) {
  const resolved = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

export function resolveCssVariable(name) {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || null;
  } catch {
    return null;
  }
}

export function hexToRgba(hex, alpha = 1) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  if (Number.isNaN(bigint)) return null;

  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveColorWithAlpha(name, alpha = 1, fallback = `rgba(128, 128, 128, ${alpha})`) {
  const hex = resolveCssVariable(name);
  if (!hex) return fallback;
  const rgba = hexToRgba(hex, alpha);
  return rgba || fallback;
}
