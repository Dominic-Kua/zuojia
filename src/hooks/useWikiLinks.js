import { useState, useCallback, useEffect } from 'react';
import { extractWikiLinks, resolveWikiLink } from '../lib/wiki-link.js';
import { wikiHandlers } from '../lib/ipc-client.ts';

/**
 * Hook for handling wiki link interactions in the manuscript editor
 * @param {string} novelPath - Path to the novel
 * @param {string} content - Current manuscript content
 * @param {Array} wikiPages - List of wiki pages from context
 * @returns {Object} Wiki link handlers and state
 */
export function useWikiLinks(novelPath, content = '', wikiPages = []) {
  const [wikiLinks, setWikiLinks] = useState([]);
  const [selectedLink, setSelectedLink] = useState(null);
  const [showDisambiguation, setShowDisambiguation] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [linkPreview, setLinkPreview] = useState(null);

  // Extract wiki links from content
  useEffect(() => {
    const links = extractWikiLinks(content);
    setWikiLinks(links);
  }, [content]);

  // Handle clicking a wiki link
  const handleLinkClick = useCallback(
    (target, display) => {
      const resolution = resolveWikiLink(target, wikiPages);

      if (resolution.found) {
        // Open the exact match
        setSelectedLink(resolution.matches[0]);
        return { action: 'open', page: resolution.matches[0] };
      } else if (resolution.matches.length > 1) {
        // Show disambiguation menu
        setSelectedLink({ target, display });
        setShowDisambiguation(true);
        return { action: 'disambiguate', options: resolution.matches };
      } else if (resolution.matches.length === 1) {
        // Single partial match - open it
        setSelectedLink(resolution.matches[0]);
        return { action: 'open', page: resolution.matches[0] };
      } else {
        // No match - show create dialog
        setSelectedLink({ target, display });
        setShowCreateDialog(true);
        return { action: 'create', target, display };
      }
    },
    [wikiPages]
  );

  // Handle hovering over a wiki link
  const handleLinkHover = useCallback(
    (target) => {
      const resolution = resolveWikiLink(target, wikiPages);
      if (resolution.found) {
        const page = resolution.matches[0];
        // Return first 100 chars for preview
        setLinkPreview({
          target,
          title: page.title,
          preview: `${page.title} - ${page.filepath}`,
        });
      }
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

        setShowCreateDialog(false);
        setSelectedLink(null);

        return result;
      } catch (err) {
        console.error('Failed to create wiki page:', err);
        throw err;
      }
    },
    [novelPath]
  );

  // Handle selecting a disambiguation option
  const handleSelectDisambiguation = useCallback((page) => {
    setShowDisambiguation(false);
    setSelectedLink(page);
    return { action: 'open', page };
  }, []);

  // Clear preview on mouse leave
  const handleLinkMouseLeave = useCallback(() => {
    setLinkPreview(null);
  }, []);

  return {
    wikiLinks,
    selectedLink,
    showDisambiguation,
    showCreateDialog,
    linkPreview,
    handleLinkClick,
    handleLinkHover,
    handleLinkMouseLeave,
    handleCreatePageFromLink,
    handleSelectDisambiguation,
    setShowDisambiguation,
    setShowCreateDialog,
  };
}
