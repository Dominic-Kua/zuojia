// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { PATH_ENRICHMENT } from '../../../electron/platform-paths.js';

describe('platform-paths', () => {
  it('exports an array of strings', () => {
    expect(Array.isArray(PATH_ENRICHMENT)).toBe(true);
    PATH_ENRICHMENT.forEach((p) => {
      expect(typeof p).toBe('string');
    });
  });

  it('includes /opt/homebrew/bin', () => {
    expect(PATH_ENRICHMENT).toContain('/opt/homebrew/bin');
  });

  it('includes /usr/local/bin', () => {
    expect(PATH_ENRICHMENT).toContain('/usr/local/bin');
  });

  it('includes user local bin when HOME is set', () => {
    const home = process.env.HOME;
    if (home) {
      expect(PATH_ENRICHMENT).toContain(`${home}/.local/bin`);
    }
  });

  it('includes user cargo bin when HOME is set', () => {
    const home = process.env.HOME;
    if (home) {
      expect(PATH_ENRICHMENT).toContain(`${home}/.cargo/bin`);
    }
  });

  it('has no empty strings', () => {
    PATH_ENRICHMENT.forEach((p) => {
      expect(p.length).toBeGreaterThan(0);
    });
  });
});
