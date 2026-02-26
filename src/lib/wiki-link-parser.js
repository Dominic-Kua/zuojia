/**
 * Wiki Link Parser
 * Parses [[page-name]] and [[page-name|display text]] syntax
 */

/**
 * A single wiki link match found in text.
 * @typedef {Object} WikiLinkMatch
 * @property {number} start - Start index of the match in the original text.
 * @property {number} end - End index (exclusive) of the match in the original text.
 * @property {string} pageName - The raw page name referenced by the link.
 * @property {string} displayText - The display text for the link (may be the same as pageName).
 * @property {string} fullMatch - The full matched wiki link string, including brackets.
 */

/**
 * Parse wiki links from text.
 * @param {string} text - Text content to scan for wiki link syntax.
 * @returns {WikiLinkMatch[]} Array of wiki link match objects.
 */
export function parseWikiLinks(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const links = [];
  let i = 0;

  while (i < text.length) {
    // Look for [[
    if (text[i] === '[' && text[i + 1] === '[') {
      // Check for triple bracket (not valid)
      if (text[i + 2] === '[') {
        i++;
        continue;
      }

      const start = i;
      i += 2;
      const contentStart = i;

      // Find the closing ]]
      let foundClosing = false;

      while (i < text.length - 1) {
        if (text[i] === ']' && text[i + 1] === ']') {
          // Check for triple bracket at end (not valid)
          if (text[i + 2] === ']') {
            break;
          }
          foundClosing = true;
          const content = text.substring(contentStart, i).trim();
          i += 2;
          
          if (content) {
            const fullMatch = text.substring(start, i);

            // Split by pipe to separate page name and display text
            const parts = content.split('|');
            const pageName = parts[0].trim();
            const displayText = parts.length > 1 ? parts.slice(1).join('|').trim() : pageName;

            links.push({
              start,
              end: i,
              pageName,
              displayText,
              fullMatch,
            });
          }
          break;
        }
        i++;
      }
      
      if (!foundClosing) {
        i = start + 1; // Skip past opening [[ if no closing found
      }
    } else {
      i++;
    }
  }

  return links;
}

/**
 * Convert page name to URL-safe slug
 * @param {string} pageName - Page name
 * @returns {string} - Slug
 */
export function resolveSlug(pageName) {
  if (!pageName || typeof pageName !== 'string') {
    return '';
  }

  return pageName
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
 * Check if a string is a valid wiki link
 * @param {string} text - Text to check
 * @returns {boolean} - True if valid wiki link format
 */
export function isValidLink(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Must start with [[ and end with ]]
  if (!text.startsWith('[[') || !text.endsWith(']]')) {
    return false;
  }

  // Must not be triple brackets
  if (text.startsWith('[[[') || text.endsWith(']]]')) {
    return false;
  }

  // Extract content between brackets
  const content = text.slice(2, -2).trim();

  // Content must not be empty
  if (!content) {
    return false;
  }

  return true;
}
