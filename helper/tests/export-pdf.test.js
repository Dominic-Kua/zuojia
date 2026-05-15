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
    expect(result.data.texEngine).toBe('xelatex');
    expect(result.data.chapterCount).toBe(2);
    expect(runSubprocess).toHaveBeenCalledOnce();

    const [command, args] = runSubprocess.mock.calls[0];
    expect(command).toBe('pandoc');
    expect(args).toContain('--pdf-engine=xelatex');
    expect(args.some((arg) => arg.endsWith('chapter-01.md'))).toBe(true);
    expect(args.some((arg) => arg.endsWith('chapter-02.md'))).toBe(true);
    expect(args).toContain('--metadata');
  });

  it('respects chapterOrder when provided — uses given order, skips omitted chapters', async () => {
    const { validateExportDependencies } = await import('../src/export/validate-deps.js');
    const { runSubprocess } = await import('../src/util/subprocess.js');

    validateExportDependencies.mockResolvedValue({
      status: 'ok',
      data: {
        pandoc: { available: true, version: 'pandoc 3.1.0' },
        tex: { available: true, engine: 'xelatex', version: 'XeTeX 3.14' },
      },
    });

    runSubprocess.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, durationMs: 100 });

    // Export only chapter-02; chapter-01 is omitted from chapterOrder
    const result = await exportManuscriptToPdf(TEST_DIR, {
      title: 'Novel',
      author: 'Dom',
      date: '2026-04-18',
      chapterOrder: [{ filename: 'chapter-02.md', title: 'Chapter 2' }],
    });

    expect(result.status).toBe('ok');
    expect(result.data.chapterCount).toBe(1);
    const [, args] = runSubprocess.mock.calls[0];
    const chapterArgs = args.filter((a) => a.endsWith('.md'));
    expect(chapterArgs).toHaveLength(1);
    expect(chapterArgs[0]).toMatch(/chapter-02\.md$/);
    expect(chapterArgs.some((a) => a.endsWith('chapter-01.md'))).toBe(false);
  });

  it('falls back to index order when chapterOrder is absent', async () => {
    const { validateExportDependencies } = await import('../src/export/validate-deps.js');
    const { runSubprocess } = await import('../src/util/subprocess.js');

    validateExportDependencies.mockResolvedValue({
      status: 'ok',
      data: {
        pandoc: { available: true, version: 'pandoc 3.1.0' },
        tex: { available: true, engine: 'xelatex', version: 'XeTeX 3.14' },
      },
    });

    runSubprocess.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, durationMs: 100 });

    const result = await exportManuscriptToPdf(TEST_DIR, {
      title: 'Novel',
      author: 'Dom',
      date: '2026-04-18',
    });

    expect(result.status).toBe('ok');
    const [, args] = runSubprocess.mock.calls[0];
    const chapterArgs = args.filter((a) => a.endsWith('.md'));
    expect(chapterArgs).toHaveLength(2);
  });

  it('rejects invalid chapterOrder entries and returns guidance when none remain', async () => {
    const { validateExportDependencies } = await import('../src/export/validate-deps.js');
    const { runSubprocess } = await import('../src/util/subprocess.js');

    validateExportDependencies.mockResolvedValue({
      status: 'ok',
      data: {
        pandoc: { available: true, version: 'pandoc 3.1.0' },
        tex: { available: true, engine: 'xelatex', version: 'XeTeX 3.14' },
      },
    });

    const result = await exportManuscriptToPdf(TEST_DIR, {
      title: 'Novel',
      author: 'Dom',
      date: '2026-04-18',
      chapterOrder: [
        { filename: '../chapter-01.md', title: 'Bad path' },
        { filename: '/etc/passwd', title: 'Absolute path' },
      ],
    });

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('NO_CHAPTERS_TO_EXPORT');
    expect(runSubprocess).not.toHaveBeenCalled();
  });

  it('prunes export logs to keep only the 10 most recent after a successful export', async () => {
    const { validateExportDependencies } = await import('../src/export/validate-deps.js');
    const { runSubprocess } = await import('../src/util/subprocess.js');

    validateExportDependencies.mockResolvedValue({
      status: 'ok',
      data: {
        pandoc: { available: true, version: 'pandoc 3.1.0' },
        tex: { available: true, engine: 'xelatex', version: 'XeTeX 3.14' },
      },
    });
    runSubprocess.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, durationMs: 100 });

    // Pre-populate the logs dir with 10 old log files
    const logsDir = path.join(TEST_DIR, 'meta', 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    for (let i = 1; i <= 10; i++) {
      const ts = `2026-01-${String(i).padStart(2, '0')}T00-00-00-000Z`;
      await fs.writeFile(path.join(logsDir, `export-${ts}.log`), `log ${i}`, 'utf-8');
    }

    const result = await exportManuscriptToPdf(TEST_DIR, { title: 'Novel', author: 'Dom', date: '2026-04-18' });
    expect(result.status).toBe('ok');

    const remaining = (await fs.readdir(logsDir)).filter((f) => f.startsWith('export-'));
    expect(remaining).toHaveLength(10);
    // Oldest (2026-01-01) should be pruned; the new log plus 2026-01-02 through 10 remain
    expect(remaining.some((f) => f.includes('2026-01-01'))).toBe(false);
  });

  it('passes --template when latex template file exists', async () => {
    const { validateExportDependencies } = await import('../src/export/validate-deps.js');
    const { runSubprocess } = await import('../src/util/subprocess.js');

    validateExportDependencies.mockResolvedValue({
      status: 'ok',
      data: {
        pandoc: { available: true, version: 'pandoc 3.1.0' },
        tex: { available: true, engine: 'xelatex', version: 'XeTeX 3.14' },
      },
    });

    runSubprocess.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, durationMs: 100 });

    await exportManuscriptToPdf(TEST_DIR, { title: 'Novel', author: 'Dom', date: '2026-04-18' });

    const [, args] = runSubprocess.mock.calls[0];
    // Template is present when the latex-template.tex file exists in the export directory
    const templateArg = args.find((a) => a.startsWith('--template'));
    expect(templateArg).toBeDefined();
    expect(templateArg).toContain('latex-template.tex');
  });
});