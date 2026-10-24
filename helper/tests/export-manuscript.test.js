import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { exportManuscriptToFormat } from '../src/export/pdf.js';

vi.mock('../src/export/validate-deps.js', () => ({ validateExportDependencies: vi.fn() }));
vi.mock('../src/util/subprocess.js', () => ({ runSubprocess: vi.fn() }));

const TEST_DIR = path.join(process.cwd(), `test-export-manuscript-${Date.now()}`);

async function writeNovel() {
  await fs.mkdir(path.join(TEST_DIR, 'manuscript'), { recursive: true });
  await fs.mkdir(path.join(TEST_DIR, 'meta'), { recursive: true });
  await fs.writeFile(path.join(TEST_DIR, 'meta', 'index.json'), JSON.stringify({
    chapters: [
      { filename: 'chapter-01.md', title: 'Chapter 1' },
      { filename: 'chapter-02.md', title: 'Chapter 2' },
    ],
    wiki: [],
  }), 'utf-8');
  await fs.writeFile(path.join(TEST_DIR, 'manuscript', 'chapter-01.md'), '# Chapter 1\n\nFirst chapter', 'utf-8');
  await fs.writeFile(path.join(TEST_DIR, 'manuscript', 'chapter-02.md'), '# Chapter 2\n\nSecond chapter', 'utf-8');
}

describe('exportManuscriptToFormat', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await writeNovel();
    const { validateExportDependencies } = await import('../src/export/validate-deps.js');
    validateExportDependencies.mockResolvedValue({
      status: 'ok',
      data: { pandoc: { available: true, version: 'pandoc 3.1.0' } },
    });
    const { runSubprocess } = await import('../src/util/subprocess.js');
    runSubprocess.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, durationMs: 100 });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('exports selected chapters to DOCX with metadata, contents, and chapter breaks', async () => {
    const { validateExportDependencies } = await import('../src/export/validate-deps.js');
    const { runSubprocess } = await import('../src/util/subprocess.js');
    let filterPath;
    runSubprocess.mockImplementation(async (_command, args) => {
      const filterArg = args.find((arg) => arg.startsWith('--lua-filter='));
      filterPath = filterArg.slice('--lua-filter='.length);
      expect(await fs.readFile(filterPath, 'utf-8')).toContain("pandoc.RawBlock('openxml'");
      return { stdout: '', stderr: '', exitCode: 0, durationMs: 120 };
    });

    const result = await exportManuscriptToFormat(TEST_DIR, {
      format: 'docx',
      style: 'manuscript',
      includeTableOfContents: true,
      chapterBreaks: true,
      title: 'My Novel',
      author: 'Dom',
      date: '2026-04-18',
      chapterOrder: [{ filename: 'chapter-02.md', title: 'Chapter 2' }],
    });

    expect(result.status).toBe('ok');
    expect(result.data.outputPath).toMatch(/\.docx$/);
    expect(result.data.chapterCount).toBe(1);
    expect(validateExportDependencies).toHaveBeenCalledWith('docx');
    const [command, args] = runSubprocess.mock.calls[0];
    expect(command).toBe('pandoc');
    expect(args).toContain('--to=docx');
    expect(args).toContain('--toc');
    expect(args.some((arg) => arg.endsWith('/manuscript.docx'))).toBe(true);
    expect(args.some((arg) => arg.endsWith('chapter-02.md'))).toBe(true);
    expect(args.some((arg) => arg.endsWith('chapter-01.md'))).toBe(false);
    await expect(fs.access(filterPath)).rejects.toThrow();
  });

  it('exports EPUB with the selected style and configurable contents and chapter splitting', async () => {
    const { runSubprocess } = await import('../src/util/subprocess.js');
    let stylePath;
    runSubprocess.mockImplementation(async (_command, args) => {
      const cssArg = args.find((arg) => arg.startsWith('--css='));
      stylePath = cssArg.slice('--css='.length);
      expect(await fs.readFile(stylePath, 'utf-8')).toContain('font-family: sans-serif');
      return { stdout: '', stderr: '', exitCode: 0, durationMs: 120 };
    });

    const result = await exportManuscriptToFormat(TEST_DIR, {
      format: 'epub',
      style: 'reader',
      includeTableOfContents: false,
      chapterBreaks: false,
    });

    expect(result.status).toBe('ok');
    expect(result.data.outputPath).toMatch(/\.epub$/);
    const [, args] = runSubprocess.mock.calls[0];
    expect(args).toContain('--to=epub3');
    expect(args).toContain('--split-level=0');
    expect(args).not.toContain('--toc');
    await expect(fs.access(stylePath)).rejects.toThrow();
  });

  it('rejects unsupported output formats', async () => {
    const { runSubprocess } = await import('../src/util/subprocess.js');

    const result = await exportManuscriptToFormat(TEST_DIR, { format: 'html' });

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('UNSUPPORTED_EXPORT_FORMAT');
    expect(runSubprocess).not.toHaveBeenCalled();
  });
});
