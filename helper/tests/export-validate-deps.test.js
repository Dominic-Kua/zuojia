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

  it('returns install guidance when TeX is unavailable', async () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'pandoc' && args[0] === '--version') {
        return 'pandoc 3.1.0';
      }

      if (cmd === 'xelatex' && args[0] === '--version') {
        throw new Error('not found');
      }

      if (cmd === 'pdflatex' && args[0] === '--version') {
        throw new Error('not found');
      }

      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });

    const result = await validateExportDependencies();

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('TEX_UNAVAILABLE');
    expect(result.error.suggestion).toMatch(/mactex|tex/i);
    expect(result.error.context.enginesTried).toEqual(['xelatex', 'pdflatex']);
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

  it('falls back to pdflatex when xelatex is unavailable', async () => {
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

    expect(result.status).toBe('ok');
    expect(result.data.tex.engine).toBe('pdflatex');
    expect(result.data.enginesTried).toEqual(['xelatex', 'pdflatex']);
  });
});