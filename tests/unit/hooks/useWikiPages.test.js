/**
 * Tests for useWikiPages hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWikiPages } from '../../../src/hooks/useWikiPages.js';

// Mock IPC client
vi.mock('../../../src/lib/ipc-client.ts', () => ({
  wikiHandlers: {
    list: vi.fn(),
    create: vi.fn(),
    read: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    rename: vi.fn(),
  },
}));

import { wikiHandlers } from '../../../src/lib/ipc-client.ts';

describe('useWikiPages', () => {
  const mockNovelPath = '/test/novel';
  const mockPages = [
    {
      slug: 'alice',
      title: 'Alice the Protagonist',
      wordCount: 1250,
      lastModified: '2024-01-15T10:30:00Z',
    },
    {
      slug: 'bob',
      title: 'Bob the Antagonist',
      wordCount: 980,
      lastModified: '2024-01-14T15:45:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('initializes with empty pages and loading true', () => {
      wikiHandlers.list.mockResolvedValue({ pages: [] });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      expect(result.current.pages).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);
    });
  });

  describe('loading pages', () => {
    it('loads wiki pages on mount', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pages).toEqual(mockPages);
      expect(wikiHandlers.list).toHaveBeenCalledWith(mockNovelPath);
    });

    it('handles empty pages list', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: [] });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pages).toEqual([]);
      expect(result.current.error).toBe(null);
    });

    it('handles error loading pages', async () => {
      const error = new Error('Network error');
      error.code = 'NETWORK_ERROR';
      wikiHandlers.list.mockRejectedValue(error);

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error.message).toBe('Network error');
      expect(result.current.pages).toEqual([]);
    });

    it('reloads pages when novelPath changes', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });

      const { result, rerender } = renderHook(
        ({ novelPath }) => useWikiPages(novelPath),
        { initialProps: { novelPath: '/path/1' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(wikiHandlers.list).toHaveBeenCalledWith('/path/1');

      vi.clearAllMocks();
      wikiHandlers.list.mockResolvedValue({ pages: [] });

      rerender({ novelPath: '/path/2' });

      await waitFor(() => {
        expect(wikiHandlers.list).toHaveBeenCalledWith('/path/2');
      });
    });
  });

  describe('createPage', () => {
    it('creates new wiki page', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });
      wikiHandlers.create.mockResolvedValue({ slug: 'charlie', title: 'Charlie' });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const result2 = await result.current.createPage('Charlie', '# Charlie');
        expect(result2.status).toBe('ok');
      });

      expect(wikiHandlers.create).toHaveBeenCalledWith(mockNovelPath, 'Charlie', '# Charlie');
    });

    it('reloads pages after successful creation', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });
      wikiHandlers.create.mockResolvedValue({ slug: 'charlie' });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newPages = [...mockPages, { slug: 'charlie', title: 'Charlie', wordCount: 0, lastModified: new Date().toISOString() }];
      wikiHandlers.list.mockResolvedValue({ pages: newPages });

      await act(async () => {
        await result.current.createPage('Charlie', '# Charlie');
      });

      await waitFor(() => {
        expect(wikiHandlers.list).toHaveBeenCalledTimes(2);
      });
    });

    it('handles error during creation', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });
      const error = new Error('Page already exists');
      error.code = 'WIKI_PAGE_EXISTS';
      wikiHandlers.create.mockRejectedValue(error);

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let caughtError = null;
      await act(async () => {
        try {
          await result.current.createPage('Alice', '# Alice');
        } catch (err) {
          caughtError = err;
        }
      });

      expect(caughtError).toBeTruthy();
      expect(caughtError.code).toBe('WIKI_PAGE_EXISTS');
    });
  });

  describe('deletePage', () => {
    it('deletes wiki page', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });
      wikiHandlers.delete.mockResolvedValue({});

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deletePage('alice');
      });

      expect(wikiHandlers.delete).toHaveBeenCalledWith(mockNovelPath, 'alice');
    });

    it('reloads pages after deletion', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });
      wikiHandlers.delete.mockResolvedValue({});

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const updatedPages = mockPages.filter(p => p.slug !== 'alice');
      wikiHandlers.list.mockResolvedValue({ pages: updatedPages });

      await act(async () => {
        await result.current.deletePage('alice');
      });

      await waitFor(() => {
        expect(wikiHandlers.list).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('renamePage', () => {
    it('renames wiki page', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });
      wikiHandlers.rename.mockResolvedValue({ newSlug: 'alice-hero' });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const res = await result.current.renamePage('alice', 'Alice the Hero');
        expect(res.newSlug).toBe('alice-hero');
      });

      expect(wikiHandlers.rename).toHaveBeenCalledWith(mockNovelPath, 'alice', 'Alice the Hero');
    });

    it('reloads pages after rename', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });
      wikiHandlers.rename.mockResolvedValue({ newSlug: 'alice-hero' });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const updatedPages = [
        { slug: 'alice-hero', title: 'Alice the Hero', wordCount: 1250, lastModified: mockPages[0].lastModified },
        mockPages[1],
      ];
      wikiHandlers.list.mockResolvedValue({ pages: updatedPages });

      await act(async () => {
        await result.current.renamePage('alice', 'Alice the Hero');
      });

      await waitFor(() => {
        expect(wikiHandlers.list).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('refresh', () => {
    it('manually refreshes pages list', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(wikiHandlers.list).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refresh();
      });

      expect(wikiHandlers.list).toHaveBeenCalledTimes(2);
    });
  });

  describe('search', () => {
    it('filters pages by title', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const filtered = result.current.search('Alice');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toContain('Alice');
    });

    it('returns empty array for no matches', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const filtered = result.current.search('NonExistent');
      expect(filtered).toHaveLength(0);
    });

    it('is case-insensitive', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const filtered = result.current.search('ALICE');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toContain('Alice');
    });

    it('searches by slug', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const filtered = result.current.search('bob');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].slug).toBe('bob');
    });
  });

  describe('getPageBySlug', () => {
    it('returns page by slug', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const page = result.current.getPageBySlug('alice');
      expect(page).toEqual(mockPages[0]);
    });

    it('returns undefined if not found', async () => {
      wikiHandlers.list.mockResolvedValue({ pages: mockPages });

      const { result } = renderHook(() => useWikiPages(mockNovelPath));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const page = result.current.getPageBySlug('nonexistent');
      expect(page).toBeUndefined();
    });
  });
});
