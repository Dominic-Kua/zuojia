import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import fs from 'fs'
import { createError } from '../util/error.js'

/**
 * Create a new novel directory structure
 * @param {string} novelName - Name of the novel (pretty name with spaces, capitals, unicode allowed)
 * @param {string} novelRootPath - Base path where novels are stored (defaults to ~/.zuojia)
 * @returns {Promise<{status, data, timestamp}>} Response envelope
 */
export async function createNovel(novelName, novelRootPath = path.join(process.env.HOME, '.zuojia')) {
  try {
    // Validate novel name
    if (!novelName || novelName.trim() === '') {
      return createError('INVALID_NOVEL_NAME', 'Novel name cannot be empty');
    }

    // Reject names containing path separators to prevent path traversal
    if (/[/\\:]/.test(novelName)) {
      return createError('INVALID_NOVEL_NAME', 'Novel name cannot contain /, \\, or : characters');
    }

    // Convert novel name to safe directory slug
    // Remove leading/trailing whitespace, convert to lowercase, replace spaces with hyphens,
    // and remove any characters that aren't alphanumeric, hyphens, or underscores
    const slug = novelName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')           // spaces to hyphens
      .replace(/[^a-z0-9_\-]/g, '');  // remove invalid chars

    // After sanitization, check if we have a valid slug
    if (!slug || slug.length === 0) {
      return createError(
        'INVALID_NOVEL_NAME',
        'Novel name must contain at least one alphanumeric character'
      );
    }

    const novelPath = path.join(novelRootPath, slug);

    // Check if novel already exists
    if (fs.existsSync(novelPath)) {
      return createError('NOVEL_EXISTS', `Novel "${novelName}" already exists at ${novelPath}`);
    }

    // Create directory structure
    await mkdir(path.join(novelPath, 'manuscript'), { recursive: true });
    await mkdir(path.join(novelPath, 'wiki'), { recursive: true });
    await mkdir(path.join(novelPath, 'meta'), { recursive: true });

    // Initialize empty index
    const index = {
      chapters: [],
      wiki: [],
      lastRebuild: new Date().toISOString(),
    };

    await writeFile(
      path.join(novelPath, 'meta', 'index.json'),
      JSON.stringify(index, null, 2)
    );

    return {
      status: 'ok',
      data: { novelPath },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError('SUBPROCESS_FAILED', `Failed to create novel: ${err.message}`);
  }
}
