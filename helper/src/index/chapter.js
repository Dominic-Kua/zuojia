import path from 'path'
import fs from 'fs'
import { readFile, writeFile, unlink } from 'fs/promises'
import { createError } from '../util/error.js'

/**
 * Read chapter content from manuscript directory
 * @param {string} novelPath - Path to the novel directory
 * @param {string} filename - Chapter filename (e.g., 'chapter-01.md')
 * @returns {Promise<{status, data, timestamp}>} Response envelope
 */
export async function readChapter(novelPath, filename) {
  try {
    const chapterPath = path.join(novelPath, 'manuscript', filename);

    // Check if file exists
    if (!fs.existsSync(chapterPath)) {
      return createError('ENOENT', `Chapter file not found: ${filename}`);
    }

    // Read content
    const content = await readFile(chapterPath, 'utf-8');

    return {
      status: 'ok',
      data: {
        filename,
        content,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return createError('ENOENT', `Chapter file not found: ${filename}`);
    }
    return createError('SUBPROCESS_FAILED', `Failed to read chapter: ${err.message}`);
  }
}

/**
 * Write chapter content to manuscript directory
 * @param {string} novelPath - Path to the novel directory
 * @param {string} filename - Chapter filename (e.g., 'chapter-01.md')
 * @param {string} content - Chapter content
 * @returns {Promise<{status, data, timestamp}>} Response envelope
 */
export async function writeChapter(novelPath, filename, content) {
  let tempPath;
  try {
    const manuscriptPath = path.join(novelPath, 'manuscript');
    
    // Check if manuscript directory exists
    if (!fs.existsSync(manuscriptPath)) {
      return createError('ENOENT', `Novel directory not found: ${novelPath}`);
    }

    // Validate filename - prevent path traversal and absolute paths
    // Check for absolute paths
    if (path.isAbsolute(filename)) {
      return createError('INVALID_PATH', 'Absolute paths not allowed');
    }
    
    // Check for directory traversal sequences
    if (filename.includes('..') || filename.startsWith('/')) {
      return createError('INVALID_PATH', 'Path traversal sequences not allowed');
    }
    
    // Also validate via resolved path as backup
    const resolvedPath = path.resolve(manuscriptPath, filename);
    const resolvedManuscript = path.resolve(manuscriptPath);
    
    if (!resolvedPath.startsWith(resolvedManuscript + path.sep) && resolvedPath !== path.join(resolvedManuscript, filename)) {
      return createError('INVALID_PATH', 'Path escapes manuscript directory');
    }

    const chapterPath = path.join(manuscriptPath, filename);

    // Write content atomically (write to temp file, then rename)
    tempPath = `${chapterPath}.tmp`;
    await writeFile(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, chapterPath);

    return {
      status: 'ok',
      data: {
        filename,
        path: chapterPath,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (tempPath) {
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors to avoid masking the original error
      }
    }
    if (err.code === 'ENOENT') {
      return createError('ENOENT', `Novel directory not found: ${novelPath}`);
    }
    return createError('SUBPROCESS_FAILED', `Failed to write chapter: ${err.message}`);
  }
}
