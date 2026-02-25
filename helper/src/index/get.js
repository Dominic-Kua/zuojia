import path from 'path'
import { readFile } from 'fs/promises'
import fs from 'fs'
import { createError } from '../util/error.js'
import { rebuildIndex } from './rebuild.js'

/**
 * Get index for a novel directory
 * If index is missing/corrupted, rebuilds it from disk
 * @param {string} novelPath - Path to the novel directory
 * @returns {Promise<{status, data, timestamp}>} Response envelope
 */
export async function getIndex(novelPath) {
  try {
    const indexPath = path.join(novelPath, 'meta', 'index.json');

    // Try to read existing index
    if (fs.existsSync(indexPath)) {
      try {
        const content = await readFile(indexPath, 'utf-8');
        const index = JSON.parse(content);

        return {
          status: 'ok',
          data: index,
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        // Index is corrupted, rebuild it
        console.warn(`Index corrupted at ${indexPath}, rebuilding:`, err.message);
        return await rebuildIndex(novelPath);
      }
    }

    // Index doesn't exist, rebuild it
    console.log(`Index not found at ${indexPath}, rebuilding from disk`);
    return await rebuildIndex(novelPath);
  } catch (err) {
    return createError('SUBPROCESS_FAILED', `Failed to get/rebuild index: ${err.message}`);
  }
}
