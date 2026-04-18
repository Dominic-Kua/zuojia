import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { exportManuscriptToPdf } from '../src/export/pdf.js';

vi.mock('../src/export/validate-deps.js', () => ({
  validateExportDependencies: vi.fn(),
}));

vi.mock('../src/util/subprocess.js', () => ({
  runSubprocess: vi.fn(),
}));

const TEST_DIR = path.join(process.cwd(), `test-export-pdf-${Date.now()}`);

async function writeNovel() {
  await fs.mkdir(path.join(TEST_DIR, 'manuscript'), { recursive: true });
  await fs.mkdir(path.join(TEST_DIR, 'meta'), { recursive: true });
  await fs.writeFile(
    path.join(TEST_DIR, 'meta', 'index.json'),
    JSON.stringify({
      chapters: [
        { filename: 'chapter-01.md', title: 'Chapter 1', wordCount: 10 },
        { filename: 'chapter-02.md', title: 'Chapter 2', wordCount: 12 },
      ],
      wiki: [],
      lastRebuild: new Date().toISOString(),
    }),
    'utf-8'
  );
  await fs.writeFile(path.join(TEST_DIR, 'manuscript', 'chapter-01.md'), '# Chapter 1\n\nFirst chapter', 'utf-8');
  await fs.writeFile(path.join(TEST_DIR, 'manuscript', 'chapter-02.md'), '# Chapter 2\n\nSecond chapter', 'utf-8');
}

describe('exportManuscriptToPdf', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await writeNovel();
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns dependency guidance when export prerequisites are missing', async () => {
    const { validateExportDependencies } = await import('../src/export/validate-deps.js');
    validateExportDependencies.mockResolvedValue({
      status: 'error',
      error: {
        code: 'PANDOC_UNAVAILABLE',
        message: 'Pandoc is not installed',
        suggestion: 'Install via: brew install pandoc',
      },
    });

    const result = await exportManuscriptToPdf(TEST_DIR, {
      title: 'Novel',
      author: 'Dom',
      date: '2026-04-17',
    });

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('PANDOC_UNAVAILABLE');
  });

  it('exports all indexed chapters and writes a log entry', async () => {
    const { validateExportDependencies } = await import('../src/export/validate-deps.js');
    const { runSubprocess } = await import('../src/util/subprocess.js');

    validateExportDependencies.mockResolvedValue({
      status: 'ok',
      data: {
        pandoc: { available: true, version: 'pandoc 3.1.0' },
        tex: { available: true, engine: 'xelatex', version: 'XeTeX 3.14' },
      },
    });

    runSubprocess.mockResolvedValue({
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
      durationMs: 420,
    });

    const result = await exportManuscriptToPdf(TEST_DIR, {
      title: 'Novel',
      author: 'Dom',
      date: '2026-04-17',
    });

    expect(result.status).toBe('ok');
    expect(result.data.outputPath).toMatch(/meta\/exports\/.+\.pdf$/);
    expect(result.data.logPath).toMatch(/meta\/logs\/export-.+\.log$/);
    expect(runSubprocess).toHaveBeenCalledOnce();

    const [command, args] = runSubprocess.mock.calls[0];
    expect(command).toBe('pandoc');
    expect(args).toContain('--pdf-engine=xelatex');
    expect(args.some((arg) => arg.endsWith('chapter-01.md'))).toBe(true);
    expect(args.some((arg) => arg.endsWith('chapter-02.md'))).toBe(true);
    expect(args).toContain('--metadata');
  });
});