/**
 * Wiki page CRUD operations
 */

import fs from 'fs/promises';
import path from 'path';
import { createError } from '../util/error.js';

/**
 * Generate URL-safe slug from title
 * @param {string} title - Page title
 * @returns {string} - URL-safe slug
 */
export function generateSlug(title) {
  if (!title || typeof title !== 'string') {
    return '';
  }

  return title
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Create a new wiki page
 * @param {string} novelPath - Path to novel directory
 * @param {string} title - Page title
 * @param {string} content - Page content
 * @returns {Promise<Object>} - {status, data: {slug}, error}
 */
export async function createWikiPage(novelPath, title, content) {
  try {
    // Validate title
    if (!title || title.trim() === '') {
      return createError('INVALID_TITLE', 'Title cannot be empty');
    }

    // Generate slug
    const slug = generateSlug(title);
    if (!slug) {
      return createError('INVALID_TITLE', 'Title must contain at least one alphanumeric character');
    }

    const wikiDir = path.join(novelPath, 'wiki');
    const filePath = path.join(wikiDir, `${slug}.md`);

    // Check if wiki directory exists
    try {
      await fs.access(wikiDir);
    } catch {
      return createError('WIKI_DIR_NOT_FOUND', 'Wiki directory does not exist');
    }

    // Check if file already exists
    try {
      await fs.access(filePath);
      return createError('WIKI_PAGE_EXISTS', `Wiki page with slug "${slug}" already exists`);
    } catch {
      // File doesn't exist, which is what we want
    }

    // Write content to file
    await fs.writeFile(filePath, content, 'utf-8');

    return {
      status: 'ok',
      data: { slug },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return createError(error.code || 'UNKNOWN_ERROR', error.message);
  }
}

/**
 * Read wiki page content
 * @param {string} novelPath - Path to novel directory
 * @param {string} slug - Page slug
 * @returns {Promise<Object>} - {status, data: {content}, error}
 */
export async function readWikiPage(novelPath, slug) {
  try {
    // Validate slug (prevent path traversal)
    if (!slug || slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
      return createError('INVALID_SLUG', 'Invalid slug format');
    }

    const filePath = path.join(novelPath, 'wiki', `${slug}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return createError('WIKI_PAGE_NOT_FOUND', `Wiki page "${slug}" not found`);
    }

    const content = await fs.readFile(filePath, 'utf-8');

    return {
      status: 'ok',
      data: { content },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return createError(error.code || 'UNKNOWN_ERROR', error.message);
  }
}

/**
 * Update wiki page content (atomic operation)
 * @param {string} novelPath - Path to novel directory
 * @param {string} slug - Page slug
 * @param {string} content - New content
 * @returns {Promise<Object>} - {status, error}
 */
export async function updateWikiPage(novelPath, slug, content) {
  try {
    // Validate slug
    if (!slug || slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
      return createError('INVALID_SLUG', 'Invalid slug format');
    }

    const filePath = path.join(novelPath, 'wiki', `${slug}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return createError('WIKI_PAGE_NOT_FOUND', `Wiki page "${slug}" not found`);
    }

    // Atomic write: write to temp file, then rename
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, filePath);

    return {
      status: 'ok',
      data: {},
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return createError(error.code || 'UNKNOWN_ERROR', error.message);
  }
}

/**
 * Delete wiki page
 * @param {string} novelPath - Path to novel directory
 * @param {string} slug - Page slug
 * @returns {Promise<Object>} - {status, error}
 */
export async function deleteWikiPage(novelPath, slug) {
  try {
    // Validate slug
    if (!slug || slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
      return createError('INVALID_SLUG', 'Invalid slug format');
    }

    const filePath = path.join(novelPath, 'wiki', `${slug}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return createError('WIKI_PAGE_NOT_FOUND', `Wiki page "${slug}" not found`);
    }

    await fs.unlink(filePath);

    return {
      status: 'ok',
      data: {},
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return createError(error.code || 'UNKNOWN_ERROR', error.message);
  }
}

/**
 * Rename wiki page (atomic operation)
 * @param {string} novelPath - Path to novel directory
 * @param {string} oldSlug - Current slug
 * @param {string} newTitle - New title
 * @returns {Promise<Object>} - {status, data: {newSlug}, error}
 */
export async function renameWikiPage(novelPath, oldSlug, newTitle) {
  try {
    // Validate old slug
    if (!oldSlug || oldSlug.includes('/') || oldSlug.includes('\\') || oldSlug.includes('..')) {
      return createError('INVALID_SLUG', 'Invalid slug format');
    }

    // Validate new title
    if (!newTitle || newTitle.trim() === '') {
      return createError('INVALID_TITLE', 'New title cannot be empty');
    }

    const oldPath = path.join(novelPath, 'wiki', `${oldSlug}.md`);

    // Check if old file exists
    try {
      await fs.access(oldPath);
    } catch {
      return createError('WIKI_PAGE_NOT_FOUND', `Wiki page "${oldSlug}" not found`);
    }

    // Generate new slug
    const newSlug = generateSlug(newTitle);
    if (!newSlug) {
      return createError('INVALID_TITLE', 'New title must contain at least one alphanumeric character');
    }

    const newPath = path.join(novelPath, 'wiki', `${newSlug}.md`);

    // Check if new slug already exists
    if (oldSlug !== newSlug) {
      try {
        await fs.access(newPath);
        return createError('WIKI_PAGE_EXISTS', `Wiki page with slug "${newSlug}" already exists`);
      } catch {
        // File doesn't exist, which is what we want
      }
    }

    // Rename file (atomic operation on most filesystems)
    await fs.rename(oldPath, newPath);

    return {
      status: 'ok',
      data: { newSlug },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return createError(error.code || 'UNKNOWN_ERROR', error.message);
  }
}
