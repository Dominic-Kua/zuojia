/**
 * useWikiPages hook
 * Manages wiki pages state, loading, and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { wikiHandlers } from '../lib/ipc-client';

/**
 * Hook for managing wiki pages
 * @param {string} novelPath - Path to the novel directory
 * @returns {Object} - {pages, loading, error, createPage, deletePage, renamePage, refresh, search, getPageBySlug}
 */
export function useWikiPages(novelPath) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load pages from IPC
  const loadPages = useCallback(async () => {
    if (!novelPath) {
      setPages([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await wikiHandlers.list(novelPath);
      setPages(result.pages || []);
    } catch (err) {
      setError(err);
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [novelPath]);

  // Load pages on mount and when novelPath changes
  useEffect(() => {
    loadPages();
  }, [novelPath, loadPages]);

  // Keep multiple hook instances convergent: when another instance creates,
  // deletes, or renames a page it broadcasts this event and every instance
  // (including this one) refreshes its own page list.
  useEffect(() => {
    if (!novelPath) {
      return undefined;
    }

    const handlePagesUpdated = (event) => {
      if (event.detail?.novelPath && event.detail.novelPath !== novelPath) {
        return;
      }
      loadPages();
    };

    window.addEventListener('zuojia:wiki-pages-updated', handlePagesUpdated);
    return () => window.removeEventListener('zuojia:wiki-pages-updated', handlePagesUpdated);
  }, [novelPath, loadPages]);

  const broadcastPagesUpdated = useCallback(() => {
    window.dispatchEvent(new CustomEvent('zuojia:wiki-pages-updated', {
      detail: { novelPath },
    }));
  }, [novelPath]);

  // Create new wiki page
  const createPage = useCallback(
    async (title, content) => {
      try {
        const result = await wikiHandlers.create(novelPath, title, content);
        // Reload pages to get updated list
        await loadPages();
        broadcastPagesUpdated();
        return { status: 'ok', data: result };
      } catch (err) {
        throw err;
      }
    },
    [novelPath, loadPages, broadcastPagesUpdated]
  );

  // Delete wiki page
  const deletePage = useCallback(
    async (slug) => {
      try {
        await wikiHandlers.delete(novelPath, slug);
        // Reload pages to get updated list
        await loadPages();
        broadcastPagesUpdated();
      } catch (err) {
        throw err;
      }
    },
    [novelPath, loadPages, broadcastPagesUpdated]
  );

  // Rename wiki page
  const renamePage = useCallback(
    async (slug, newTitle) => {
      try {
        const result = await wikiHandlers.rename(novelPath, slug, newTitle);
        // Reload pages to get updated list
        await loadPages();
        broadcastPagesUpdated();
        return result;
      } catch (err) {
        throw err;
      }
    },
    [novelPath, loadPages, broadcastPagesUpdated]
  );

  // Manually refresh pages list
  const refresh = useCallback(async () => {
    await loadPages();
  }, [loadPages]);

  // Search pages by title or slug
  const search = useCallback(
    (query) => {
      if (!query || query.trim() === '') {
        return pages;
      }

      const q = query.toLowerCase();
      return pages.filter((page) => {
        return page.title.toLowerCase().includes(q) || page.slug.toLowerCase().includes(q);
      });
    },
    [pages]
  );

  // Get single page by slug
  const getPageBySlug = useCallback(
    (slug) => {
      return pages.find((page) => page.slug === slug);
    },
    [pages]
  );

  return {
    pages,
    loading,
    error,
    createPage,
    deletePage,
    renamePage,
    refresh,
    search,
    getPageBySlug,
  };
}
