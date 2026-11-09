import path from 'path'
import fs from 'fs'
import { readdir, readFile, writeFile, rename, unlink } from 'fs/promises'
import { createError } from '../util/error.js'
import { isSymlink } from '../util/path-guard.js'
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

async function readMarkdownEntry(dirPath, filename, includeWordCount = false) {
  const filePath = path.join(dirPath, filename);
  if (isSymlink(filePath)) return null;
  const content = await readFile(filePath, 'utf-8');
  const title = extractTitle(filename, content);
  const entry = { filename, title };
  if (includeWordCount) entry.wordCount = calculateWordCount(content);
  return entry;
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
      try {
        const entry = await readMarkdownEntry(dirPath, filename, includeWordCount);
        if (entry) results.push(entry);
      } catch (err) {
        console.error(`Error reading ${filename} in ${dirPath}:`, err);
      }
    }

    return results;
  } catch (err) {
    console.error(`Error scanning directory ${dirPath}:`, err);
    return [];
  }
}

function readExistingIndex(indexPath) {
  try {
    if (!fs.existsSync(indexPath)) return null;
    const raw = fs.readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function mergeChapterOrder(discoveredChapters, existingIndex) {
  const byFilename = new Map(discoveredChapters.map((c) => [c.filename, c]));
  const previous = Array.isArray(existingIndex?.chapters) ? existingIndex.chapters : [];
  const ordered = [];
  const seen = new Set();

  // Preserve previous order for chapters that still exist.
  for (const prev of previous) {
    const filename = prev?.filename;
    if (typeof filename !== 'string' || seen.has(filename)) continue;
    const current = byFilename.get(filename);
    if (current) {
      ordered.push(current);
      seen.add(filename);
    }
  }

  // Append newly discovered chapters in lexical filename order.
  const added = discoveredChapters
    .filter((c) => !seen.has(c.filename))
    .sort((a, b) => a.filename.localeCompare(b.filename));
  ordered.push(...added);

  return ordered;
}

async function writeIndex(indexPath, index) {
  const tempPath = `${indexPath}.tmp-${Date.now()}`;
  await writeFile(tempPath, JSON.stringify(index, null, 2));
  try {
    await rename(tempPath, indexPath);
  } catch (renameError) {
    await unlink(tempPath).catch(() => {});
    throw renameError;
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

    const existingIndex = readExistingIndex(indexPath);

    // Scan directories
    const discoveredChapters = await scanDirectory(manuscriptPath, true);
    const chapters = mergeChapterOrder(discoveredChapters, existingIndex);
    const wiki = await scanDirectory(wikiPath, false);

    const index = {
      chapters,
      wiki,
      lastRebuild: new Date().toISOString(),
    };

    await writeIndex(indexPath, index);

    return {
      status: 'ok',
      data: index,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError('SUBPROCESS_FAILED', `Failed to rebuild index: ${err.message}`);
  }
}

/**
 * Set manuscript chapter order. Filenames must exist in manuscript/*.md.
 * Preserves chapter metadata (title/wordCount) by rebuilding entries.
 * @param {string} novelPath
 * @param {string[]} orderedFilenames
 */
export async function setChapterOrder(novelPath, orderedFilenames) {
  try {
    if (!fs.existsSync(novelPath)) {
      return createError('ENOENT', `Novel directory not found at ${novelPath}`);
    }
    if (!Array.isArray(orderedFilenames) || orderedFilenames.some((f) => typeof f !== 'string' || !f.endsWith('.md'))) {
      return createError('INVALID_INPUT', 'orderedFilenames must be an array of .md filenames');
    }

    const manuscriptPath = path.join(novelPath, 'manuscript');
    const metaPath = path.join(novelPath, 'meta');
    const indexPath = path.join(metaPath, 'index.json');
    const existingIndex = readExistingIndex(indexPath) || { chapters: [], wiki: [] };

    // Build metadata for requested order; also validate files exist.
    const requested = [];
    const seen = new Set();
    for (const filename of orderedFilenames) {
      if (seen.has(filename)) continue;
      seen.add(filename);
      const filePath = path.join(manuscriptPath, filename);
      if (!fs.existsSync(filePath) || isSymlink(filePath)) {
        return createError('ENOENT', `Chapter file not found: ${filename}`);
      }
      try {
        const entry = await readMarkdownEntry(manuscriptPath, filename, true);
        if (entry) requested.push(entry);
      } catch (err) {
        return createError('SUBPROCESS_FAILED', `Failed to read chapter ${filename}: ${err.message}`);
      }
    }

    // Append any discovered chapters not included (safety: don't hide files).
    const discovered = await scanDirectory(manuscriptPath, true);
    for (const entry of discovered) {
      if (!seen.has(entry.filename)) requested.push(entry);
    }

    const index = {
      chapters: requested,
      wiki: Array.isArray(existingIndex.wiki) ? existingIndex.wiki : await scanDirectory(path.join(novelPath, 'wiki'), false),
      lastRebuild: new Date().toISOString(),
    };
    await writeIndex(indexPath, index);

    return { status: 'ok', data: index, timestamp: new Date().toISOString() };
  } catch (err) {
    return createError('SUBPROCESS_FAILED', `Failed to set chapter order: ${err.message}`);
  }
}
