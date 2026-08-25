/**
 * Wiki link utilities for parsing, resolving, and disambiguating wiki links
 * Syntax: [[page-name]] or [[page-name|display text]]
 */

/**
 * Parse a single wiki link
 * @param {string} text - Raw wiki link text (e.g., "[[alice]]" or "[[alice|Alice]]")
 * @returns {{target: string, display: string, raw: string} | null}
 */
export function parseWikiLink(text) {
  // Match [[target]] or [[target|display]]
  const match = text.match(/^\[\[\s*([^\]|]*?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]$/);
  
  if (!match) {
    return null;
  }

  const target = normalizeSlug(match[1]);
  
  // Reject empty targets
  if (!target) {
    return null;
  }

  const display = match[2]?.trim() || match[1].trim();

  return {
    target,
    display,
    raw: text,
  };
}

/**
 * Extract all wiki links from content
 * @param {string} content - Manuscript or wiki content
 * @returns {Array<{target: string, display: string, raw: string, position: number}>}
 */
export function extractWikiLinks(content) {
  const links = [];
  let match;

  // Instantiated per call so shared lastIndex state can never leak between
  // concurrent/interleaved invocations.
  const WIKI_LINK_REGEX = /\[\[([^\]|]*?)(?:\|([^\]]*?))?\]\]/g;

  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    const target = normalizeSlug(match[1]);

    // Skip links with empty targets to match parseWikiLink behavior
    if (!target) {
      continue;
    }
    const display = match[2]?.trim() || match[1].trim();

    links.push({
      target,
      display,
      raw: match[0],
      position: match.index,
    });
  }

  return links;
}

/**
 * Normalize a single path segment to a slug
 * @param {string} segment - Title or text segment to normalize
 * @returns {string} Normalized slug segment (lowercase, hyphenated)
 */
function normalizeSlugSegment(segment) {
  return segment
    .toLowerCase()
    .trim()
    // Remove non-letter, non-number chars (preserve unicode letters/numbers, spaces, hyphens, underscores)
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    // Replace spaces, hyphens, underscores with single hyphen
    .replace(/[-\s_]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalize a title to a slug, preserving path separators
 * @param {string} title - Title or text to normalize
 * @returns {string} Normalized slug (lowercase, hyphenated, path-aware)
 */
export function normalizeSlug(title) {
  return title
    .split('/')
    .map(normalizeSlugSegment)
    .filter(Boolean)
    .join('/');
}

/**
 * Resolve a wiki link target to actual wiki pages
 * @param {string} target - Slug to resolve
 * @param {Array} wikiPages - List of wiki pages from index
 * @returns {{found: boolean, matches: Array}} Exact match or ambiguous options
 */
export function resolveWikiLink(target, wikiPages) {
  // Check for exact match
  const exactMatch = wikiPages.find(page => page.slug === target);
  
  if (exactMatch) {
    return {
      found: true,
      matches: [exactMatch],
    };
  }

  // Find partial/ambiguous matches
  const partialMatches = findAmbiguousMatches(target, wikiPages);

  return {
    found: false,
    matches: partialMatches,
  };
}

/**
 * Score how strongly a page matches a link target.
 * Counts overlapping slug words plus a bonus when the title contains the target.
 * @param {string} target - Slug to match
 * @param {Object} page - Wiki page ({slug, title})
 * @returns {{matchedWords: number, pageWordCount: number, titleMatch: boolean, score: number}}
 */
export function scorePageMatch(target, page) {
  const targetWords = target.split('-').filter(Boolean);
  const pageWords = page.slug.split('-');

  // Count matching words
  const matchedWords = targetWords.filter(word =>
    pageWords.some(pword => pword.includes(word) || word === pword)
  ).length;

  // Also check title similarity
  const titleMatch = page.title.toLowerCase().includes(target.toLowerCase());

  return {
    matchedWords,
    pageWordCount: pageWords.length,
    titleMatch,
    score: matchedWords + (titleMatch ? 10 : 0),
  };
}

/**
 * Find pages that might match a partial or ambiguous slug
 * @param {string} target - Partial slug or title fragment
 * @param {Array} wikiPages - List of wiki pages
 * @returns {Array} Matching pages (sorted by relevance)
 */
export function findAmbiguousMatches(target, wikiPages) {
  return wikiPages
    .map(page => ({
      page,
      ...scorePageMatch(target, page),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.page);
}

/**
 * Check if two slugs are similar (for disambiguation)
 * @param {string} slug1
 * @param {string} slug2
 * @returns {boolean}
 */
export function areSlugsAmbiguous(slug1, slug2) {
  const words1 = slug1.split('-');
  const words2 = slug2.split('-');

  // Share at least one word
  const commonWords = words1.filter(w => words2.includes(w));
  return commonWords.length > 0;
}

/**
 * Create a wiki link from a page
 * @param {string} slug - Page slug
 * @param {string} displayText - Optional custom display text
 * @returns {string} Wiki link syntax
 */
export function createWikiLink(slug, displayText = null) {
  if (displayText && displayText !== slug) {
    return `[[${slug}|${displayText}]]`;
  }
  return `[[${slug}]]`;
}
