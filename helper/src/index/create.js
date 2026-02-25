import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import fs from 'fs'
import { createError } from '../util/error.js'

/**
 * Create a new novel directory structure
 * @param {string} novelName - Name of the novel (will be used as directory name)
 * @param {string} novelRootPath - Base path where novels are stored (defaults to ~/.netwriter)
 * @returns {Promise<{status, data, timestamp}>} Response envelope
 */
export async function createNovel(novelName, novelRootPath = path.join(process.env.HOME, '.netwriter')) {
  try {
    // Validate novel name
    if (!novelName || novelName.trim() === '') {
      return createError('INVALID_NOVEL_NAME', 'Novel name cannot be empty');
    }

    // Check for invalid characters (path traversal, special chars)
    if (!/^[a-z0-9_\-]+$/.test(novelName)) {
      return createError(
        'INVALID_NOVEL_NAME',
        'Novel name must contain only lowercase letters, numbers, hyphens, and underscores'
      );
    }

    const novelPath = path.join(novelRootPath, novelName);

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
