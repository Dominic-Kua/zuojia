import path from 'path'
import fs from 'fs'
import { createError } from '../util/error.js'

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

    // Check required directories
    const requiredDirs = ['manuscript', 'wiki', 'meta'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(novelPath, dir);
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        return createError('INVALID_MANIFEST', `Required directory '${dir}' not found in novel`);
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
