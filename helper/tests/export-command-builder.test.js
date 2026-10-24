import { describe, it, expect } from 'vitest';
import { buildDocumentExportCommand, buildPdfExportCommand } from '../src/export/command-builder.js';

describe('buildPdfExportCommand', () => {
  const base = {
    chapterPaths: ['/novel/manuscript/chapter-01.md', '/novel/manuscript/chapter-02.md'],
    metadata: { title: 'My Novel', author: 'Dom', date: '2026-04-18' },
    outputPath: '/novel/meta/exports/novel-2026.pdf',
    pdfEngine: 'xelatex',
  };

  it('includes all chapter paths as positional args', () => {
    const { args } = buildPdfExportCommand(base);
    expect(args[0]).toMatch(/chapter-01\.md$/);
    expect(args[1]).toMatch(/chapter-02\.md$/);
  });

  it('uses colon separator in --metadata args', () => {
    const { args } = buildPdfExportCommand(base);
    const metaArgs = args.filter((_, i) => args[i - 1] === '--metadata');
    expect(metaArgs.some((v) => v.startsWith('title:'))).toBe(true);
    expect(metaArgs.some((v) => v.startsWith('author:'))).toBe(true);
    expect(metaArgs.some((v) => v.startsWith('date:'))).toBe(true);
    // Must NOT use = separator
    expect(metaArgs.every((v) => !v.match(/^(title|author|date)=/))).toBe(true);
  });

  it('omits --metadata entries for empty values', () => {
    const { args } = buildPdfExportCommand({
      ...base,
      metadata: { title: '', author: '', date: '' },
    });
    expect(args).not.toContain('--metadata');
  });

  it('includes pdf-engine flag', () => {
    const { args } = buildPdfExportCommand(base);
    expect(args).toContain('--pdf-engine=xelatex');
  });

  it('includes --template flag when templatePath is provided', () => {
    const { args } = buildPdfExportCommand({
      ...base,
      templatePath: '/path/to/latex-template.tex',
    });
    expect(args).toContain('--template=/path/to/latex-template.tex');
  });

  it('omits --template flag when templatePath is absent', () => {
    const { args } = buildPdfExportCommand(base);
    expect(args.every((a) => !a.startsWith('--template'))).toBe(true);
  });

  it('omits --template flag when templatePath is null', () => {
    const { args } = buildPdfExportCommand({ ...base, templatePath: null });
    expect(args.every((a) => !a.startsWith('--template'))).toBe(true);
  });

  it('outputs -o with the given output path', () => {
    const { args } = buildPdfExportCommand(base);
    const oIdx = args.indexOf('-o');
    expect(oIdx).toBeGreaterThan(-1);
    expect(args[oIdx + 1]).toBe(base.outputPath);
  });
});

describe('buildDocumentExportCommand', () => {
  const base = {
    chapterPaths: ['/novel/manuscript/chapter-02.md', '/novel/manuscript/chapter-01.md'],
    metadata: { title: 'My Novel', author: 'Dom', date: '2026-04-18' },
    outputPath: '/novel/meta/exports/novel-2026.docx',
    format: 'docx',
    style: 'manuscript',
    includeTableOfContents: true,
    chapterBreaks: true,
  };

  it('preserves input chapter order and publication metadata for DOCX', () => {
    const { command, args } = buildDocumentExportCommand({
      ...base,
      pageBreakFilterPath: '/tmp/chapter-breaks.lua',
      referenceDocPath: '/tmp/manuscript-reference.docx',
    });

    expect(command).toBe('pandoc');
    expect(args.slice(0, 2)).toEqual(base.chapterPaths);
    expect(args).toContain('--to=docx');
    expect(args).toContain('--metadata');
    expect(args).toContain('title:My Novel');
    expect(args).toContain('author:Dom');
    expect(args).toContain('date:2026-04-18');
    expect(args).toContain('--number-sections');
    expect(args).toContain('--toc');
    expect(args).toContain('--toc-depth=2');
    expect(args).toContain('--reference-doc=/tmp/manuscript-reference.docx');
    expect(args).toContain('--lua-filter=/tmp/chapter-breaks.lua');
    expect(args.slice(-2)).toEqual(['-o', base.outputPath]);
  });

  it('configures EPUB style, chapter splitting, and optional contents', () => {
    const { args } = buildDocumentExportCommand({
      ...base,
      format: 'epub',
      style: 'reader',
      includeTableOfContents: false,
      chapterBreaks: false,
      epubStylePath: '/tmp/reader.css',
      outputPath: '/novel/meta/exports/novel-2026.epub',
    });

    expect(args).toContain('--to=epub3');
    expect(args).toContain('--split-level=0');
    expect(args).toContain('--css=/tmp/reader.css');
    expect(args).not.toContain('--toc');
    expect(args).not.toContain('--number-sections');
  });
});
