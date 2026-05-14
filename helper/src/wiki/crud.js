/**
 * Wiki page CRUD operations
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { createError } from '../util/error.js';
import { rebuildSpellcheckDict } from './rebuild-dict.js';

const FRONTMATTER_BOUNDARY = '---';

/**
 * Validate a wiki page slug.
 * Allows forward slashes for subdirectory paths but blocks path traversal.
 * @param {string} slug - The slug to validate
 * @returns {boolean} - true if valid, false otherwise
 */
function isValidSlug(slug) {
  if (!slug) return false;
  if (slug.includes('\\')) return false;
  if (slug.includes('..')) return false;
  if (slug.startsWith('/')) return false;
  if (slug.endsWith('/')) return false;
  if (slug.includes('//')) return false;
  return true;
}

function normalizeTags(inputTags) {
  if (!Array.isArray(inputTags)) {
    return [];
  }

  const normalized = inputTags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0);

  return Array.from(new Set(normalized));
}

function escapeYamlDoubleQuotedString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function unescapeYamlDoubleQuotedString(value) {
  return String(value).replace(/\\(["\\nrt])/g, (_match, escaped) => {
    switch (escaped) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case '"':
      case '\\':
        return escaped;
    }
  });
}

function stripFrontmatter(content) {
  if (!content.startsWith(`${FRONTMATTER_BOUNDARY}\n`)) {
    return content;
  }

  const endIndex = content.indexOf(`\n${FRONTMATTER_BOUNDARY}`, FRONTMATTER_BOUNDARY.length + 1);
  if (endIndex === -1) {
    return content;
  }

  return content.slice(endIndex + FRONTMATTER_BOUNDARY.length + 1).replace(/^\n+/, '');
}

function extractTagsFromFrontmatter(content) {
  if (!content.startsWith(`${FRONTMATTER_BOUNDARY}\n`)) {
    return [];
  }

  const endIndex = content.indexOf(`\n${FRONTMATTER_BOUNDARY}`, FRONTMATTER_BOUNDARY.length + 1);
  if (endIndex === -1) {
    return [];
  }

  const frontmatterLines = content.slice(FRONTMATTER_BOUNDARY.length + 1, endIndex).split('\n');
  const tagsLineIndex = frontmatterLines.findIndex((line) => line.trim().toLowerCase().startsWith('tags:'));

  if (tagsLineIndex === -1) {
    return [];
  }

  const tagsLine = frontmatterLines[tagsLineIndex];
  const rawValue = tagsLine.split(':').slice(1).join(':').trim();

  // Obsidian YAML list format: tags: followed by lines starting with "  - "
  if (!rawValue) {
    const listTags = [];
    for (let i = tagsLineIndex + 1; i < frontmatterLines.length; i++) {
      const m = frontmatterLines[i].match(/^\s+-\s+(.+)$/);
      if (!m) break;
      listTags.push(m[1].trim());
    }
    return normalizeTags(listTags);
  }

  // Inline array format (old or new): tags: [tag1, tag2] or tags: ["tag1", "tag2"]
  if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    const inner = rawValue.slice(1, -1);
    return normalizeTags(inner.split(',').map((tag) => tag.replace(/^"|"$/g, '').trim()));
  }

  // Comma-separated plain text fallback
  return normalizeTags(rawValue.split(',').map((tag) => tag.trim()));
}

function extractTitleFromFrontmatter(content) {
  if (!content.startsWith(`${FRONTMATTER_BOUNDARY}\n`)) {
    return null;
  }

  const endIndex = content.indexOf(`\n${FRONTMATTER_BOUNDARY}`, FRONTMATTER_BOUNDARY.length + 1);
  if (endIndex === -1) {
    return null;
  }

  const titleLine = content
    .slice(FRONTMATTER_BOUNDARY.length + 1, endIndex)
    .split('\n')
    .find((line) => line.trim().toLowerCase().startsWith('title:'));

  if (!titleLine) return null;

  const rawTitle = titleLine.split(':').slice(1).join(':').trim();
  if (!rawTitle) return null;

  if (rawTitle.startsWith('"') && rawTitle.endsWith('"')) {
    return unescapeYamlDoubleQuotedString(rawTitle.slice(1, -1)) || null;
  }

  return rawTitle || null;
}

function extractH1FromContent(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function buildFrontmatter(title, tags) {
  const normalized = normalizeTags(tags);
  const safeTitle = title ? escapeYamlDoubleQuotedString(title) : null;

  if (!safeTitle && normalized.length === 0) {
    return '';
  }

  let fm = `${FRONTMATTER_BOUNDARY}\n`;

  if (safeTitle) {
    fm += `title: "${safeTitle}"\n`;
  }

  if (normalized.length > 0) {
    fm += `tags:\n`;
    for (const tag of normalized) {
      fm += `  - ${tag}\n`;
    }
  }

  fm += `${FRONTMATTER_BOUNDARY}\n\n`;
  return fm;
}

/**
 * Generate URL-safe slug from title
 * @param {string} title - Page title
 * @returns {string} - URL-safe slug
 */
export function generateSlug(title) {
  if (!title || typeof title !== 'string') {
    return '';
  }

  const slug = title
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

  // If slug is empty after sanitization, generate a UUID
  if (!slug) {
    return crypto.randomUUID();
  }

  return slug;
}

/**
 * Create a new wiki page
 * @param {string} novelPath - Path to novel directory
 * @param {string} title - Page title
 * @param {string} content - Page content
 * @returns {Promise<Object>} - {status, data: {slug}, error}
 */
export async function createWikiPage(novelPath, title, content, tags = []) {
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

    const rawBody = stripFrontmatter(content || '');
    const body = rawBody.trim() ? rawBody : `# ${title}\n\n`;
    const frontmatter = buildFrontmatter(title, tags);

    // Write content to file
    await fs.writeFile(filePath, `${frontmatter}${body}`, 'utf-8');
    await rebuildSpellcheckDict(novelPath);

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
 * @returns {Promise<Object>} - {status, data: {content, tags, title}, error}
 */
export async function readWikiPage(novelPath, slug) {
  try {
    // Validate slug (prevent path traversal)
    if (!isValidSlug(slug)) {
      return createError('INVALID_SLUG', 'Invalid slug format');
    }

    const filePath = path.join(novelPath, 'wiki', `${slug}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return createError('WIKI_PAGE_NOT_FOUND', `Wiki page "${slug}" not found`);
    }

    const rawContent = await fs.readFile(filePath, 'utf-8');
    const tags = extractTagsFromFrontmatter(rawContent);
    const title = extractTitleFromFrontmatter(rawContent);
    const content = stripFrontmatter(rawContent);

    return {
      status: 'ok',
      data: { content, tags, title },
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
export async function updateWikiPage(novelPath, slug, content, tags = []) {
  try {
    // Validate slug
    if (!isValidSlug(slug)) {
      return createError('INVALID_SLUG', 'Invalid slug format');
    }

    const filePath = path.join(novelPath, 'wiki', `${slug}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return createError('WIKI_PAGE_NOT_FOUND', `Wiki page "${slug}" not found`);
    }

    // Derive title: prefer H1 from new content body, fall back to existing frontmatter title
    const strippedBody = stripFrontmatter(content || '');
    const titleFromH1 = extractH1FromContent(strippedBody);
    let pageTitle = titleFromH1;
    if (!pageTitle) {
      // Preserve existing title from frontmatter if no H1 in new content
      try {
        const existing = await fs.readFile(filePath, 'utf-8');
        pageTitle = extractTitleFromFrontmatter(existing);
      } catch {
        // Non-fatal
      }
    }

    const frontmatter = buildFrontmatter(pageTitle, tags);
    const body = strippedBody;
    const nextContent = `${frontmatter}${body}`;

    // Atomic write: write to temp file, then rename
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, nextContent, 'utf-8');
    try {
      await fs.rename(tempPath, filePath);
    } catch (renameError) {
      await fs.unlink(tempPath).catch(() => {});
      throw renameError;
    }

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
    if (!isValidSlug(slug)) {
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
    await rebuildSpellcheckDict(novelPath);

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
    if (!isValidSlug(oldSlug)) {
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

    // Update the H1 heading and frontmatter title to match the new title
    try {
      const existingContent = await fs.readFile(newPath, 'utf-8');
      const existingTags = extractTagsFromFrontmatter(existingContent);
      const existingBody = stripFrontmatter(existingContent);
      const updatedBody = existingBody.replace(/^# .+$/m, `# ${newTitle}`);
      const newFrontmatter = buildFrontmatter(newTitle, existingTags);
      await fs.writeFile(newPath, `${newFrontmatter}${updatedBody}`, 'utf-8');
    } catch {
      // Non-fatal: dictionary rebuild still uses the new file
    }

    await rebuildSpellcheckDict(novelPath);

    return {
      status: 'ok',
      data: { newSlug },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return createError(error.code || 'UNKNOWN_ERROR', error.message);
  }
}
