/**
 * Manuscript word count utilities
 * @module stats/manuscript-count
 */

import fs from 'fs/promises';
import path from 'path';
import { calculateWordCount } from './word-count.js';

/**
 * Get total word count for all chapters in manuscript directory
 * Recursively scans manuscript/ directory for .md files
 * Excludes: wiki/, meta/, hidden files, non-markdown files
 * 
 * @param {string} novelPath - Path to novel root directory
 * @returns {Promise<number>} Total word count across all chapters
 * @throws {Error} If novelPath or manuscript directory doesn't exist
 */
export async function getManuscriptWordCount(novelPath) {
  const manuscriptPath = path.join(novelPath, 'manuscript');

  // Verify paths exist
  try {
    await fs.access(novelPath);
  } catch (err) {
    throw new Error(`Novel path does not exist: ${novelPath}`);
  }

  try {
    await fs.access(manuscriptPath);
  } catch (err) {
    throw new Error(`Manuscript directory does not exist: ${manuscriptPath}`);
  }

  // Recursively scan manuscript directory
  let totalWords = 0;
  
  async function scanDirectory(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip hidden files and directories (starting with .)
      if (entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Count words in markdown files
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const wordCount = calculateWordCount(content);
          totalWords += wordCount;
        } catch (err) {
          console.error(`Error reading file ${fullPath}:`, err);
          // Continue processing other files
        }
      }
    }
  }

  await scanDirectory(manuscriptPath);
  return totalWords;
}
