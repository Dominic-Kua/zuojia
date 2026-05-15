import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createError } from '../util/error.js';
import { validateExportDependencies } from './validate-deps.js';
import { buildPdfExportCommand } from './command-builder.js';
import { runSubprocess } from '../util/subprocess.js';
import { getIndex } from '../index/get.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LATEX_TEMPLATE_PATH = path.join(__dirname, 'latex-template.tex');

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
  return chapterOrder.filter((entry) => {
    if (!entry || typeof entry.filename !== 'string') return false;
    const fn = entry.filename;
    if (path.isAbsolute(fn) || fn.includes('..') || fn.includes('/') || fn.includes('\\')) {
      return false;
    }
    if (!validFilenames.has(fn)) return false;
    if (seen.has(fn)) return false;
    seen.add(fn);
    return true;
  });
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

export async function exportManuscriptToPdf(novelPath, metadata = {}) {
  try {
    if (!novelPath || !fs.existsSync(novelPath)) {
      return createError('INVALID_NOVEL_PATH', 'Novel path does not exist');
    }

    const depsResult = await validateExportDependencies();
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
    const exportChapters =
      Array.isArray(metadata.chapterOrder) && metadata.chapterOrder.length > 0
        ? sanitizeChapterOrder(metadata.chapterOrder, chapters)
        : chapters;

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

    const outputPath = path.join(exportsDir, `${path.basename(novelPath)}-${timestamp}.pdf`);
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

    const templatePath = fs.existsSync(LATEX_TEMPLATE_PATH) ? LATEX_TEMPLATE_PATH : null;

    const command = buildPdfExportCommand({
      chapterPaths,
      metadata: metadataValue,
      outputPath,
      pdfEngine: depsResult.data.tex.engine,
      templatePath,
    });

    const subprocessResult = await runSubprocess(command.command, command.args, { cwd: novelPath });
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
      return createError(
        'PDF_EXPORT_FAILED',
        'PDF export failed',
        'Review the export log and confirm Pandoc and TeX are installed correctly',
        { logPath, stderr: subprocessResult.stderr }
      );
    }

    return {
      status: 'ok',
      data: {
        outputPath,
        logPath,
        durationMs: subprocessResult.durationMs,
        texEngine: depsResult.data.tex.engine,
        chapterCount: exportChapters.length,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return createError(
      'PDF_EXPORT_FAILED',
      'PDF export failed',
      'Review the export configuration and dependencies, then try again',
      { error: error.message }
    );
  }
}