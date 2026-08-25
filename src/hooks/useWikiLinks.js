import { useState, useCallback, useEffect } from 'react';
import { extractWikiLinks, normalizeSlug, resolveWikiLink, scorePageMatch } from '../lib/wiki-link.js';
import { wikiHandlers } from '../lib/ipc-client';

/**
 * Hook for handling wiki link interactions in the manuscript editor
 * @param {string} novelPath - Path to the novel
 * @param {string} content - Current manuscript content
 * @param {Array} wikiPages - List of wiki pages from context
 * @returns {Object} Wiki link handlers and state
 */
export function useWikiLinks(novelPath, content = '', wikiPages = []) {
  const [wikiLinks, setWikiLinks] = useState([]);

  // Extract wiki links from content
  useEffect(() => {
    const links = extractWikiLinks(content);
    setWikiLinks(links);
  }, [content]);

  // Handle clicking a wiki link
  const handleLinkClick = useCallback(
    async (target, display) => {
      const normalizedTarget = normalizeSlug(target || '');
      if (!normalizedTarget) {
        return { action: 'none' };
      }

      let pagesToSearch = wikiPages;
      let resolution = resolveWikiLink(normalizedTarget, pagesToSearch);

      if (!resolution.found && resolution.matches.length === 0 && novelPath) {
        try {
          const latest = await wikiHandlers.list(novelPath);
          pagesToSearch = latest?.pages || [];
          resolution = resolveWikiLink(normalizedTarget, pagesToSearch);
        } catch (err) {
          console.error('Failed to refresh wiki pages for link resolution:', err);
        }
      }

      if (resolution.found) {
        // Open the exact match
        return { action: 'open', page: resolution.matches[0] };
      }

      if (resolution.matches.length > 1) {
        // Show disambiguation menu
        return { action: 'disambiguate', options: resolution.matches };
      }

      if (resolution.matches.length === 1) {
        // A lone partial match only auto-opens when it is a strong match:
        // the query must be meaningful (>= 3 chars) and overlap at least half
        // of the candidate page's slug words. Otherwise ask the user.
        const candidate = resolution.matches[0];
        const { score } = scorePageMatch(normalizedTarget, candidate);
        const pageWordCount = candidate.slug.split('-').filter(Boolean).length;
        const isStrongMatch = normalizedTarget.length >= 3 && score >= pageWordCount / 2;

        return isStrongMatch
          ? { action: 'open', page: candidate }
          : { action: 'disambiguate', options: resolution.matches };
      }

      // No match - show create dialog (use original target, not normalized)
      return { action: 'create', target: target, display };
    },
    [novelPath, wikiPages]
  );

  // Handle hovering over a wiki link
  const handleLinkHover = useCallback(
    (target) => {
      const normalizedTarget = normalizeSlug(target);
      const resolution = resolveWikiLink(normalizedTarget, wikiPages);
      if (resolution.found) {
        return resolution.matches[0].title;
      }
      return null;
    },
    [wikiPages]
  );

  // Handle creating a new wiki page from a wiki link
  const handleCreatePageFromLink = useCallback(
    async (title) => {
      if (!novelPath || !title) return;

      try {
        const result = await wikiHandlers.create(
          novelPath,
          title,
          `# ${title}\n\nStart documenting this wiki page...`,
          []
        );

        return result;
      } catch (err) {
        console.error('Failed to create wiki page:', err);
        throw err;
      }
    },
    [novelPath]
  );

  return {
    wikiLinks,
    handleLinkClick,
    handleLinkHover,
    handleLinkMouseLeave: useCallback(() => {}, []),
    handleCreatePageFromLink,
  };
}
