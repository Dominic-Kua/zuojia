import path from 'path'
import fs from 'fs'
import { readdir, readFile, writeFile, rename, unlink } from 'fs/promises'
import { createError } from '../util/error.js'
import { calculateWordCount } from '../stats/word-count.js'

/**
 * Extract title from markdown content
 * Looks for first H1 heading; falls back to filename if not found
 * @param {string} filename - Filename
 * @param {string} content - File content
 * @returns {string} Title
 */
function extractTitle(filename, content) {
  // Look for first H1 heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }
  
  // Fallback to filename without extension
  return path.parse(filename).name;
}

/**
 * Scan a directory for markdown files and build metadata
 * @param {string} dirPath - Directory path
 * @returns {Promise<Array>} Array of {filename, title, wordCount (for chapters only)}
 */
async function scanDirectory(dirPath, includeWordCount = false) {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const files = await readdir(dirPath);
    const mdFiles = files.filter(f => f.endsWith('.md')).sort();
    const results = [];

    for (const filename of mdFiles) {
      const filePath = path.join(dirPath, filename);
      const content = await readFile(filePath, 'utf-8');
      const title = extractTitle(filename, content);
      
      const entry = {
        filename,
        title,
      };

      if (includeWordCount) {
        entry.wordCount = calculateWordCount(content);
      }

      results.push(entry);
    }

    return results;
  } catch (err) {
    console.error(`Error scanning directory ${dirPath}:`, err);
    return [];
  }
}

/**
 * Rebuild index from manuscript and wiki directories
 * @param {string} novelPath - Path to the novel directory
 * @returns {Promise<{status, data, timestamp}>} Response envelope
 */
export async function rebuildIndex(novelPath) {
  try {
    // Check if novel path exists
    if (!fs.existsSync(novelPath)) {
      return createError('ENOENT', `Novel directory not found at ${novelPath}`);
    }

    const manuscriptPath = path.join(novelPath, 'manuscript');
    const wikiPath = path.join(novelPath, 'wiki');
    const metaPath = path.join(novelPath, 'meta');
    const indexPath = path.join(metaPath, 'index.json');

    // Scan directories
    const chapters = await scanDirectory(manuscriptPath, true);
    const wiki = await scanDirectory(wikiPath, false);

    const index = {
      chapters,
      wiki,
      lastRebuild: new Date().toISOString(),
    };

    // Write updated index to disk atomically (write to temp file, then rename)
    const tempPath = `${indexPath}.tmp-${Date.now()}`;
    await writeFile(tempPath, JSON.stringify(index, null, 2));
    try {
      await rename(tempPath, indexPath);
    } catch (renameError) {
      await unlink(tempPath).catch(() => {});
      throw renameError;
    }

    return {
      status: 'ok',
      data: index,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError('SUBPROCESS_FAILED', `Failed to rebuild index: ${err.message}`);
  }
}
