/**
 * Wiki page listing operations
 */

import fs from 'fs/promises';
import path from 'path';
import { calculateWordCount } from '../stats/word-count.js';
import { createError } from '../util/error.js';

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
 * List all wiki pages with metadata
 * @param {string} novelPath - Path to novel directory
 * @returns {Promise<Object>} - {status, data: {pages: [{slug, title, wordCount, lastModified}]}, error}
 */
export async function listWikiPages(novelPath) {
  try {
    const wikiDir = path.join(novelPath, 'wiki');

    // Check if wiki directory exists
    try {
      await fs.access(wikiDir);
    } catch {
      // Wiki directory doesn't exist, return empty array
      return {
        status: 'ok',
        data: { pages: [] },
        timestamp: new Date().toISOString()
      };
    }

    // Read directory contents
    const files = await fs.readdir(wikiDir);

    // Filter for markdown files (not hidden)
    const mdFiles = files.filter(file => {
      return file.endsWith('.md') && !file.startsWith('.');
    });

    // Process each file
    const pages = await Promise.all(
      mdFiles.map(async (file) => {
        const slug = path.basename(file, '.md');
        const filePath = path.join(wikiDir, file);

        // Read content
        const content = await fs.readFile(filePath, 'utf-8');

        // Extract title
        const title = extractTitle(content) || slug;

        // Calculate word count
        const wordCount = calculateWordCount(content);

        // Get last modified time
        const stats = await fs.stat(filePath);
        const lastModified = stats.mtime.toISOString();

        return {
          slug,
          title,
          wordCount,
          lastModified
        };
      })
    );

    // Sort alphabetically by title (case-insensitive)
    pages.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

    return {
      status: 'ok',
      data: { pages },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return createError(error.code || 'UNKNOWN_ERROR', error.message);
  }
}
