/**
 * Wiki page CRUD operations
 */

import fs from 'fs/promises';
import path from 'path';

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
      return {
        status: 'error',
        error: {
          code: 'INVALID_TITLE',
          message: 'Title cannot be empty'
        },
        timestamp: new Date().toISOString()
      };
    }

    // Generate slug
    const slug = generateSlug(title);
    if (!slug) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_TITLE',
          message: 'Title must contain at least one alphanumeric character'
        },
        timestamp: new Date().toISOString()
      };
    }

    const wikiDir = path.join(novelPath, 'wiki');
    const filePath = path.join(wikiDir, `${slug}.md`);

    // Check if wiki directory exists
    try {
      await fs.access(wikiDir);
    } catch {
      return {
        status: 'error',
        error: {
          code: 'WIKI_DIR_NOT_FOUND',
          message: 'Wiki directory does not exist'
        },
        timestamp: new Date().toISOString()
      };
    }

    // Check if file already exists
    try {
      await fs.access(filePath);
      return {
        status: 'error',
        error: {
          code: 'WIKI_PAGE_EXISTS',
          message: `Wiki page with slug "${slug}" already exists`
        },
        timestamp: new Date().toISOString()
      };
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
    return {
      status: 'error',
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    };
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
      return {
        status: 'error',
        error: {
          code: 'INVALID_SLUG',
          message: 'Invalid slug format'
        },
        timestamp: new Date().toISOString()
      };
    }

    const filePath = path.join(novelPath, 'wiki', `${slug}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return {
        status: 'error',
        error: {
          code: 'WIKI_PAGE_NOT_FOUND',
          message: `Wiki page "${slug}" not found`
        },
        timestamp: new Date().toISOString()
      };
    }

    const content = await fs.readFile(filePath, 'utf-8');

    return {
      status: 'ok',
      data: { content },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    };
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
      return {
        status: 'error',
        error: {
          code: 'INVALID_SLUG',
          message: 'Invalid slug format'
        },
        timestamp: new Date().toISOString()
      };
    }

    const filePath = path.join(novelPath, 'wiki', `${slug}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return {
        status: 'error',
        error: {
          code: 'WIKI_PAGE_NOT_FOUND',
          message: `Wiki page "${slug}" not found`
        },
        timestamp: new Date().toISOString()
      };
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
    return {
      status: 'error',
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    };
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
      return {
        status: 'error',
        error: {
          code: 'INVALID_SLUG',
          message: 'Invalid slug format'
        },
        timestamp: new Date().toISOString()
      };
    }

    const filePath = path.join(novelPath, 'wiki', `${slug}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return {
        status: 'error',
        error: {
          code: 'WIKI_PAGE_NOT_FOUND',
          message: `Wiki page "${slug}" not found`
        },
        timestamp: new Date().toISOString()
      };
    }

    await fs.unlink(filePath);

    return {
      status: 'ok',
      data: {},
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    };
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
      return {
        status: 'error',
        error: {
          code: 'INVALID_SLUG',
          message: 'Invalid slug format'
        },
        timestamp: new Date().toISOString()
      };
    }

    // Validate new title
    if (!newTitle || newTitle.trim() === '') {
      return {
        status: 'error',
        error: {
          code: 'INVALID_TITLE',
          message: 'New title cannot be empty'
        },
        timestamp: new Date().toISOString()
      };
    }

    const oldPath = path.join(novelPath, 'wiki', `${oldSlug}.md`);

    // Check if old file exists
    try {
      await fs.access(oldPath);
    } catch {
      return {
        status: 'error',
        error: {
          code: 'WIKI_PAGE_NOT_FOUND',
          message: `Wiki page "${oldSlug}" not found`
        },
        timestamp: new Date().toISOString()
      };
    }

    // Generate new slug
    const newSlug = generateSlug(newTitle);
    if (!newSlug) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_TITLE',
          message: 'New title must contain at least one alphanumeric character'
        },
        timestamp: new Date().toISOString()
      };
    }

    const newPath = path.join(novelPath, 'wiki', `${newSlug}.md`);

    // Check if new slug already exists
    if (oldSlug !== newSlug) {
      try {
        await fs.access(newPath);
        return {
          status: 'error',
          error: {
            code: 'WIKI_PAGE_EXISTS',
            message: `Wiki page with slug "${newSlug}" already exists`
          },
          timestamp: new Date().toISOString()
        };
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
    return {
      status: 'error',
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    };
  }
}
