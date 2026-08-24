import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { validateExportDependencies } from '../src/export/validate-deps.js';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('validateExportDependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns install guidance when xelatex is unavailable', async () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'pandoc' && args[0] === '--version') {
        return 'pandoc 3.1.0';
      }

      if (cmd === 'xelatex' && args[0] === '--version') {
        throw new Error('not found');
      }

      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });

    const result = await validateExportDependencies();

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('TEX_UNAVAILABLE');
    expect(result.error.suggestion).toMatch(/basictex|tex/i);
    expect(result.error.context.enginesTried).toEqual(['xelatex']);
  });

  it('returns available tools when pandoc and a TeX engine exist', async () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'pandoc' && args[0] === '--version') {
        return 'pandoc 3.1.0';
      }

      if (cmd === 'xelatex' && args[0] === '--version') {
        return 'XeTeX 3.14';
      }

      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });

    const result = await validateExportDependencies();

    expect(result.status).toBe('ok');
    expect(result.data.pandoc.available).toBe(true);
    expect(result.data.tex.available).toBe(true);
    expect(result.data.tex.engine).toBe('xelatex');
    expect(result.data.enginesTried).toEqual(['xelatex']);
  });

  it('does not fall back to pdflatex (cannot render CJK)', async () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'pandoc' && args[0] === '--version') {
        return 'pandoc 3.1.0';
      }

      if (cmd === 'xelatex' && args[0] === '--version') {
        throw new Error('not found');
      }

      if (cmd === 'pdflatex' && args[0] === '--version') {
        return 'pdfTeX 3.14159';
      }

      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });

    const result = await validateExportDependencies();

    // pdflatex must never be selected: the export template needs xelatex
    // for Chinese text, so falling back would silently break exports.
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('TEX_UNAVAILABLE');
    expect(result.error.context.enginesTried).toEqual(['xelatex']);
  });
});
