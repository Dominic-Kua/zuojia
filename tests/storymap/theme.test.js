// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getStoredTheme,
  applyTheme,
  resolveCssVariable,
  hexToRgba,
  resolveColorWithAlpha,
} from '../../src/lib/theme';

describe('theme helpers', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads stored theme from localStorage', () => {
    const storage = new Map([['zuojia-theme', 'dark']]);
    vi.stubGlobal('localStorage', {
      getItem: (key) => storage.get(key) || null,
      setItem: () => {},
    });
    expect(getStoredTheme()).toBe('dark');
  });

  it('defaults to light when localStorage fails', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('disabled');
      },
    });
    expect(getStoredTheme()).toBe('light');
  });

  it('applies theme to document root', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resolves CSS variable', () => {
    document.documentElement.style.setProperty('--test-color', '#ff0000');
    expect(resolveCssVariable('--test-color')).toBe('#ff0000');
  });

  it('converts hex to rgba', () => {
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(hexToRgba('#7da27e')).toBe('rgba(125, 162, 126, 1)');
  });

  it('resolves color with alpha', () => {
    document.documentElement.style.setProperty('--accent', '#7da27e');
    expect(resolveColorWithAlpha('--accent', 0.5)).toBe('rgba(125, 162, 126, 0.5)');
  });
});
