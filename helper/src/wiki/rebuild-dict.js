/**
 * Rebuild spellcheck dictionary from wiki pages
 */

import fs from 'fs/promises';
import path from 'path';

const DICT_FILENAME = 'spellcheck-dict.json';

function normalizeCustomWords(words) {
  if (!Array.isArray(words)) return [];
  const deduped = new Map();
  for (const word of words) {
    if (typeof word !== 'string') continue;
    const trimmed = word.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, trimmed);
    }
  }
  return Array.from(deduped.values());
}

function mergeWords(baseWords, customWords) {
  const merged = Array.from(new Set(baseWords));
  const existingLowercase = new Set(merged.map((word) => word.toLowerCase()));

  for (const word of customWords) {
    const key = word.toLowerCase();
    if (!existingLowercase.has(key)) {
      merged.push(word);
      existingLowercase.add(key);
    }
  }

  return merged.sort((a, b) => a.localeCompare(b));
}

function validateDictionaryWord(word) {
  if (typeof word !== 'string') return null;
  const trimmed = word.trim();
  if (!trimmed) return null;

  // Match the same lexical shape as spellcheck tokenization.
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

async function readExistingDictionary(dictPath) {
  try {
    const raw = await fs.readFile(dictPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      words: Array.isArray(parsed.words) ? parsed.words.filter((w) => typeof w === 'string') : [],
      customWords: normalizeCustomWords(parsed.customWords || []),
    };
  } catch {
    return {
      words: [],
      customWords: [],
    };
  }
}

async function writeDictionary(dictPath, words, customWords) {
  const dictionary = {
    words,
    customWords,
    count: words.length,
    timestamp: Date.now(),
  };

  await fs.writeFile(dictPath, JSON.stringify(dictionary, null, 2), 'utf-8');

  return {
    words: dictionary.words,
    customWords: dictionary.customWords,
    count: dictionary.count,
    timestamp: dictionary.timestamp,
    path: dictPath,
  };
}

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
    const dictPath = path.join(metaDir, DICT_FILENAME);

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

    // Keep any previously added custom words so rebuilds do not discard them.
    const existingDictionary = await readExistingDictionary(dictPath);
    const customWords = existingDictionary.customWords;

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

    // Merge wiki-derived words with persisted custom words.
    const words = mergeWords(Array.from(allWords), customWords);
    const dictionary = await writeDictionary(dictPath, words, customWords);

    return {
      status: 'ok',
      data: {
        words: dictionary.words,
        customWords: dictionary.customWords,
        count: dictionary.count,
        path: dictionary.path,
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

/**
 * Read spellcheck dictionary without rebuilding when possible.
 * Rebuilds only when the dictionary file does not exist or is invalid.
 *
 * @param {string} novelPath - Path to the novel directory
 * @returns {Promise<{status: string, data?: object, error?: object}>}
 */
export async function getSpellcheckDict(novelPath) {
  try {
    const metaDir = path.join(novelPath, 'meta');
    const dictPath = path.join(metaDir, DICT_FILENAME);

    await fs.mkdir(metaDir, { recursive: true });

    const existing = await readExistingDictionary(dictPath);
    if (existing.words.length > 0 || existing.customWords.length > 0) {
      // Merge in memory only — do not write; avoids dirty metadata on every read.
      const words = mergeWords(existing.words, existing.customWords);
      return {
        status: 'ok',
        data: {
          words,
          customWords: existing.customWords,
          count: words.length,
          path: dictPath,
        },
      };
    }

    return await rebuildSpellcheckDict(novelPath);
  } catch (err) {
    return {
      status: 'error',
      error: {
        code: 'GET_DICT_ERROR',
        message: err.message,
      },
    };
  }
}

/**
 * Add a single custom word to spellcheck dictionary.
 * The word is persisted separately as customWords and merged into words.
 *
 * @param {string} novelPath - Path to the novel directory
 * @param {string} word - Word to add
 * @returns {Promise<{status: string, data?: object, error?: object}>}
 */
export async function addWordToSpellcheckDict(novelPath, word) {
  try {
    const normalizedWord = validateDictionaryWord(word);
    if (!normalizedWord) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_DICTIONARY_WORD',
          message: 'Word must start with a letter and contain only letters, apostrophes, or hyphens',
        },
      };
    }

    const base = await getSpellcheckDict(novelPath);
    if (base.status === 'error') {
      return base;
    }

    const metaDir = path.join(novelPath, 'meta');
    const dictPath = path.join(metaDir, DICT_FILENAME);

    const existingCustom = normalizeCustomWords(base.data.customWords || []);
    const existingWords = Array.isArray(base.data.words) ? base.data.words : [];

    const alreadyPresent = existingWords.some((w) => w.toLowerCase() === normalizedWord.toLowerCase());
    let nextCustomWords = existingCustom;
    if (!existingCustom.some((w) => w.toLowerCase() === normalizedWord.toLowerCase())) {
      nextCustomWords = [...existingCustom, normalizedWord];
    }

    const nextWords = mergeWords(existingWords, nextCustomWords);
    const dictionary = await writeDictionary(dictPath, nextWords, nextCustomWords);

    return {
      status: 'ok',
      data: {
        word: normalizedWord,
        added: !alreadyPresent,
        words: dictionary.words,
        customWords: dictionary.customWords,
        count: dictionary.count,
        path: dictionary.path,
      },
    };
  } catch (err) {
    return {
      status: 'error',
      error: {
        code: 'ADD_DICT_WORD_ERROR',
        message: err.message,
      },
    };
  }
}
