import path from 'path'
import fs from 'fs'
import { createError } from '../util/error.js'
import { realpathOrNull, isWithinDir, isSymlink } from '../util/path-guard.js'

/**
 * Validate that a novel directory has the correct structure
 * @param {string} novelPath - Path to the novel directory
 * @returns {Promise<{status, data, timestamp}>} Response envelope
 */
export async function validateNovel(novelPath) {
  try {
    // Check if novel path exists
    if (!fs.existsSync(novelPath)) {
      return createError('ENOENT', `Novel directory not found at ${novelPath}`);
    }

    // Check required directories. Symlinks are rejected outright: a shared
    // novel can carry `manuscript -> /etc`, and existsSync/stat follow it.
    const rootReal = realpathOrNull(novelPath);
    if (!rootReal) {
      return createError('INVALID_MANIFEST', `Novel directory not found in novel`);
    }
    const requiredDirs = ['manuscript', 'wiki', 'meta'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(novelPath, dir);
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        return createError('INVALID_MANIFEST', `Required directory '${dir}' not found in novel`);
      }
      if (isSymlink(dirPath)) {
        return createError('INVALID_MANIFEST', `Required directory '${dir}' must not be a symlink`);
      }
      const dirReal = realpathOrNull(dirPath);
      if (!dirReal || !isWithinDir(rootReal, dirReal)) {
        return createError('INVALID_MANIFEST', `Required directory '${dir}' escapes the novel directory`);
      }
    }

    // Check for index.json
    const indexPath = path.join(novelPath, 'meta', 'index.json');
    if (!fs.existsSync(indexPath)) {
      return createError('INVALID_MANIFEST', 'Required file meta/index.json not found in novel');
    }

    return {
      status: 'ok',
      data: { isValid: true, novelPath },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError('SUBPROCESS_FAILED', `Failed to validate novel: ${err.message}`);
  }
}
