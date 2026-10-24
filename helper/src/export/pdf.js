import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { createError } from '../util/error.js';
import { validateExportDependencies } from './validate-deps.js';
import { buildDocumentExportCommand, buildPdfExportCommand } from './command-builder.js';
import { runSubprocess } from '../util/subprocess.js';
import { getIndex } from '../index/get.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LATEX_TEMPLATE_PATH = path.join(__dirname, 'latex-template.tex');
const REFERENCE_DOCS_PATH = path.join(__dirname, 'reference-docs');
const EPUB_STYLES = {
  manuscript: `body { font-family: serif; line-height: 1.45; margin: 5%; }\np { text-indent: 1.2em; margin: 0 0 0.55em; }\nh1 { text-align: center; }`,
  reader: `body { font-family: sans-serif; line-height: 1.7; margin: 8%; }\np { text-indent: 0; margin: 0 0 0.9em; }\nh1 { text-align: left; }`,
};
const DOCX_CHAPTER_BREAK_FILTER = `function Header(header)\n  if header.level == 1 then\n    return { pandoc.RawBlock('openxml', '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'), header }\n  end\nend`;

function toFileTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function createExportLog(payload) {
  return [
    `timestamp: ${payload.timestamp}`,
    `command: ${payload.command}`,
    `exitCode: ${payload.exitCode}`,
    `durationMs: ${payload.durationMs}`,
    '',
    'stdout:',
    payload.stdout || '',
    '',
    'stderr:',
    payload.stderr || '',
    '',
  ].join('\n');
}

function sanitizeChapterOrder(chapterOrder, indexChapters) {
  const validFilenames = new Set(indexChapters.map((c) => c.filename));
  const seen = new Set();
  const chapters = [];
  const skipped = [];

  for (const entry of chapterOrder) {
    if (!entry || typeof entry.filename !== 'string') {
      skipped.push(entry);
      continue;
    }
    const fn = entry.filename;
    if (path.isAbsolute(fn) || fn.includes('..') || fn.includes('/') || fn.includes('\\')) {
      skipped.push(entry);
      continue;
    }
    if (!validFilenames.has(fn)) {
      skipped.push(entry);
      continue;
    }
    if (seen.has(fn)) {
      skipped.push(entry);
      continue;
    }
    seen.add(fn);
    chapters.push(entry);
  }

  return { chapters, skipped };
}

function normalizeMetadata(novelPath, metadata = {}) {
  return {
    title: String(metadata.title || path.basename(novelPath)).trim(),
    author: String(metadata.author || '').trim(),
    date: String(metadata.date || new Date().toISOString().slice(0, 10)).trim(),
  };
}

async function pruneExportLogs(logsDir, maxLogs = 10) {
  let files;
  try {
    files = await fsPromises.readdir(logsDir);
  } catch {
    return;
  }
  const logFiles = files.filter((f) => f.startsWith('export-') && f.endsWith('.log')).sort();
  const excess = logFiles.length - maxLogs;
  if (excess <= 0) {
    return;
  }
  await Promise.all(
    logFiles.slice(0, excess).map((f) => fsPromises.unlink(path.join(logsDir, f)).catch(() => {}))
  );
}

export async function exportManuscriptToFormat(novelPath, metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    metadata = {};
  }
  const format = metadata.format || 'pdf';
  try {
    if (!novelPath || !fs.existsSync(novelPath)) {
      return createError('INVALID_NOVEL_PATH', 'Novel path does not exist');
    }
    if (!['pdf', 'docx', 'epub'].includes(format)) {
      return createError(
        'UNSUPPORTED_EXPORT_FORMAT',
        `Unsupported export format: ${format}`,
        'Choose PDF, DOCX, or EPUB'
      );
    }
    // Resolve once so all derived chapter/output/log paths are absolute
    novelPath = path.resolve(novelPath);

    const depsResult = await validateExportDependencies(format);
    if (depsResult.status === 'error') {
      return depsResult;
    }

    const indexResult = await getIndex(novelPath);
    if (indexResult.status === 'error') {
      return indexResult;
    }

    const chapters = indexResult.data.chapters || [];
    if (chapters.length === 0) {
      return createError(
        'NO_CHAPTERS_TO_EXPORT',
        'No chapters are available for export',
        'Create at least one manuscript chapter before exporting'
      );
    }

    // Use caller-specified chapter order (from UI selection/reorder) when provided;
    // fall back to the full index order.  Sanitize to reject path traversal attempts
    // and filenames not present in the index.
    let skippedChapters = [];
    let exportChapters;
    if (Array.isArray(metadata.chapterOrder) && metadata.chapterOrder.length > 0) {
      const sanitized = sanitizeChapterOrder(metadata.chapterOrder, chapters);
      exportChapters = sanitized.chapters;
      skippedChapters = sanitized.skipped
        .map((entry) => (entry && typeof entry.filename === 'string' ? entry.filename : String(entry)))
        .filter(Boolean);
    } else {
      exportChapters = chapters;
    }

    if (exportChapters.length === 0) {
      return createError(
        'NO_CHAPTERS_TO_EXPORT',
        'No chapters are available for export',
        'Create at least one manuscript chapter before exporting'
      );
    }

    const timestamp = toFileTimestamp();
    const metadataValue = normalizeMetadata(novelPath, metadata);
    const exportsDir = path.join(novelPath, 'meta', 'exports');
    const logsDir = path.join(novelPath, 'meta', 'logs');
    await fsPromises.mkdir(exportsDir, { recursive: true });
    await fsPromises.mkdir(logsDir, { recursive: true });

    const outputPath = path.join(exportsDir, `${path.basename(novelPath)}-${timestamp}.${format}`);
    const logPath = path.join(logsDir, `export-${timestamp}.log`);
    const chapterPaths = exportChapters.map((chapter) => path.join(novelPath, 'manuscript', chapter.filename));

    const missingChapters = chapterPaths.filter((p) => !fs.existsSync(p));
    if (missingChapters.length > 0) {
      return createError(
        'CHAPTER_FILE_MISSING',
        `${missingChapters.length} chapter file(s) could not be found on disk`,
        'Run "Rebuild Index" to resync the chapter list, or check that manuscript files have not been moved'
      );
    }

    let command;
    let subprocessResult;
    const temporaryAssets = [];
    try {
      if (format === 'pdf') {
        const templatePath = fs.existsSync(LATEX_TEMPLATE_PATH) ? LATEX_TEMPLATE_PATH : null;
        command = buildPdfExportCommand({
          chapterPaths,
          metadata: metadataValue,
          outputPath,
          pdfEngine: depsResult.data.tex.engine,
          templatePath,
        });
      } else {
        const style = metadata.style === 'reader' ? 'reader' : 'manuscript';
        let epubStylePath;
        let pageBreakFilterPath;
        let referenceDocPath;

        if (format === 'epub') {
          epubStylePath = path.join(exportsDir, `.export-${randomUUID()}.css`);
          temporaryAssets.push(epubStylePath);
          await fsPromises.writeFile(epubStylePath, EPUB_STYLES[style], 'utf-8');
        }
        if (format === 'docx' && metadata.chapterBreaks !== false) {
          pageBreakFilterPath = path.join(exportsDir, `.export-${randomUUID()}.lua`);
          temporaryAssets.push(pageBreakFilterPath);
          await fsPromises.writeFile(pageBreakFilterPath, DOCX_CHAPTER_BREAK_FILTER, 'utf-8');
        }
        if (format === 'docx') {
          const resourcePath = process.resourcesPath
            ? path.join(process.resourcesPath, 'helper', 'src', 'export', 'reference-docs', `${style}.docx`)
            : null;
          const sourcePath = path.join(REFERENCE_DOCS_PATH, `${style}.docx`);
          referenceDocPath = resourcePath && fs.existsSync(resourcePath) ? resourcePath : sourcePath;
        }

        command = buildDocumentExportCommand({
          chapterPaths,
          metadata: metadataValue,
          outputPath,
          format,
          style,
          includeTableOfContents: metadata.includeTableOfContents !== false,
          chapterBreaks: metadata.chapterBreaks !== false,
          epubStylePath,
          pageBreakFilterPath,
          referenceDocPath,
        });
      }

      subprocessResult = await runSubprocess(command.command, command.args, { cwd: novelPath });
    } finally {
      await Promise.all(temporaryAssets.map((assetPath) => fsPromises.unlink(assetPath).catch(() => {})));
    }

    await fsPromises.writeFile(
      logPath,
      createExportLog({
        timestamp: new Date().toISOString(),
        command: `${command.command} ${command.args.join(' ')}`,
        ...subprocessResult,
      }),
      'utf-8'
    );
    await pruneExportLogs(logsDir);

    if (subprocessResult.exitCode !== 0) {
      const pdf = format === 'pdf';
      return createError(
        pdf ? 'PDF_EXPORT_FAILED' : 'MANUSCRIPT_EXPORT_FAILED',
        `${format.toUpperCase()} export failed`,
        pdf
          ? 'Review the export log and confirm Pandoc and TeX are installed correctly'
          : 'Review the export log and confirm Pandoc is installed correctly',
        { logPath, stderr: subprocessResult.stderr, format }
      );
    }

    return {
      status: 'ok',
      data: {
        outputPath,
        logPath,
        format,
        durationMs: subprocessResult.durationMs,
        ...(format === 'pdf' ? { texEngine: depsResult.data.tex.engine } : {}),
        chapterCount: exportChapters.length,
        skippedChapters,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const isPdf = format === 'pdf';
    return createError(
      isPdf ? 'PDF_EXPORT_FAILED' : 'MANUSCRIPT_EXPORT_FAILED',
      isPdf ? 'PDF export failed' : `${format.toUpperCase()} export failed`,
      'Review the export configuration and dependencies, then try again',
      { error: error.message, format }
    );
  }
}

export async function exportManuscriptToPdf(novelPath, metadata = {}) {
  return exportManuscriptToFormat(novelPath, { ...metadata, format: 'pdf' });
}
