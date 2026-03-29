/**
 * Rebuild spellcheck dictionary from wiki pages
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Extract title from markdown content (first H1)
 * @param {string} content - Markdown content
 * @returns {string|null} - Title or null if not found
 */
function extractTitle(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.substring(2).trim();
    }
  }
  return null;
}

/**
 * Extract words from a title by splitting on whitespace and removing punctuation
 * @param {string} title - Wiki page title
 * @returns {Array<string>} Array of words
 */
function extractWordsFromTitle(title) {
  return (
    title
      // Replace punctuation with spaces
      .replace(/[^\w\s-]/g, ' ')
      // Split on whitespace
      .split(/\s+/)
      // Filter out empty strings and hyphens
      .filter((word) => word.length > 0 && word !== '-')
  );
}

/**
 * Rebuild the spellcheck dictionary from wiki pages
 * Extracts all wiki page titles, splits into words, deduplicates, and writes to meta/spellcheck-dict.json
 *
 * @param {string} novelPath - Path to the novel directory
 * @returns {Promise<{status: string, data?: object, error?: object}>}
 */
export async function rebuildSpellcheckDict(novelPath) {
  try {
    const wikiDir = path.join(novelPath, 'wiki');
    const metaDir = path.join(novelPath, 'meta');
    const dictPath = path.join(metaDir, 'spellcheck-dict.json');

    // Ensure meta directory exists
    await fs.mkdir(metaDir, { recursive: true });

    // Read wiki directory recursively
    let wikiFiles = [];
    try {
      const allFiles = await fs.readdir(wikiDir, { recursive: true });
      wikiFiles = allFiles.filter(file => {
        if (!file.endsWith('.md')) return false;
        const segments = file.split(path.sep);
        return segments.every(seg => !seg.startsWith('.'));
      });
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      // Wiki directory doesn't exist - return empty dictionary
    }

    // Extract words from all wiki page titles
    const allWords = new Set();

    for (const file of wikiFiles) {
      try {
        const filePath = path.join(wikiDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Extract title from first H1 heading
        const title = extractTitle(content);

        if (title) {
          const words = extractWordsFromTitle(title);
          words.forEach((word) => allWords.add(word));
        }
      } catch (err) {
        // Skip files that can't be read
        console.warn(`Failed to read wiki page ${file}:`, err.message);
      }
    }

    // Convert Set to sorted array
    const words = Array.from(allWords).sort();

    // Write dictionary
    const dictionary = {
      words,
      count: words.length,
      timestamp: Date.now(),
    };

    await fs.writeFile(dictPath, JSON.stringify(dictionary, null, 2), 'utf-8');

    return {
      status: 'ok',
      data: {
        words,
        count: words.length,
        path: dictPath,
      },
    };
  } catch (err) {
    console.error('Failed to rebuild spellcheck dictionary:', err);
    return {
      status: 'error',
      error: {
        code: 'REBUILD_DICT_ERROR',
        message: err.message,
        suggestion: 'Check that the novel directory exists and is accessible',
      },
    };
  }
}
