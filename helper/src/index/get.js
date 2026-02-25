import path from 'path'
import { readFile } from 'fs/promises'
import fs from 'fs'
import { createError } from '../util/error.js'

/**
 * Read index from a novel directory
 * @param {string} novelPath - Path to the novel directory
 * @returns {Promise<{status, data, timestamp}>} Response envelope
 */
export async function getIndex(novelPath) {
  try {
    const indexPath = path.join(novelPath, 'meta', 'index.json');

    // Check if index exists
    if (!fs.existsSync(indexPath)) {
      return createError('ENOENT', `Index file not found at ${indexPath}`);
    }

    // Read and parse index
    const content = await readFile(indexPath, 'utf-8');
    const index = JSON.parse(content);

    return {
      status: 'ok',
      data: index,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return createError('ENOENT', `Index file not found for novel at ${novelPath}`);
    }
    return createError('SUBPROCESS_FAILED', `Failed to read index: ${err.message}`);
  }
}
