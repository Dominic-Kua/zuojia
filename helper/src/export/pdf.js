import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { createError } from '../util/error.js';
import { validateExportDependencies } from './validate-deps.js';
import { buildPdfExportCommand } from './command-builder.js';
import { runSubprocess } from '../util/subprocess.js';
import { getIndex } from '../index/get.js';

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

function normalizeMetadata(novelPath, metadata = {}) {
  return {
    title: String(metadata.title || path.basename(novelPath)).trim(),
    author: String(metadata.author || '').trim(),
    date: String(metadata.date || new Date().toISOString().slice(0, 10)).trim(),
  };
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

    const timestamp = toFileTimestamp();
    const metadataValue = normalizeMetadata(novelPath, metadata);
    const exportsDir = path.join(novelPath, 'meta', 'exports');
    const logsDir = path.join(novelPath, 'meta', 'logs');
    await fsPromises.mkdir(exportsDir, { recursive: true });
    await fsPromises.mkdir(logsDir, { recursive: true });

    const outputPath = path.join(exportsDir, `${path.basename(novelPath)}-${timestamp}.pdf`);
    const logPath = path.join(logsDir, `export-${timestamp}.log`);
    const chapterPaths = chapters.map((chapter) => path.join(novelPath, 'manuscript', chapter.filename));

    const missingChapters = chapterPaths.filter((p) => !fs.existsSync(p));
    if (missingChapters.length > 0) {
      return createError(
        'CHAPTER_FILE_MISSING',
        `${missingChapters.length} chapter file(s) could not be found on disk`,
        'Run "Rebuild Index" to resync the chapter list, or check that manuscript files have not been moved'
      );
    }

    const command = buildPdfExportCommand({
      chapterPaths,
      metadata: metadataValue,
      outputPath,
      pdfEngine: depsResult.data.tex.engine,
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