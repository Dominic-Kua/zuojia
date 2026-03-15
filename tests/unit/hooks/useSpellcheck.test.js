/**
 * Tests for useSpellcheck hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSpellcheck } from '../../../src/hooks/useSpellcheck.js';

// Mock IPC client
vi.mock('../../../src/lib/ipc-client.ts', () => ({
  wikiHandlers: {
    rebuildDict: vi.fn(),
  },
}));

import { wikiHandlers } from '../../../src/lib/ipc-client.ts';

describe('useSpellcheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('starts with loading state', () => {
      wikiHandlers.rebuildDict.mockResolvedValue({ words: [] });

      const { result } = renderHook(() => useSpellcheck('/test/novel'));

      expect(result.current.loading).toBe(true);
      expect(result.current.words).toEqual([]);
    });

    it('loads spellcheck dictionary on mount', async () => {
      const mockPages = [
        'Alice',
        'Bob',
        'Smith',
        'The',
        'Shire',
      ];
      wikiHandlers.rebuildDict.mockResolvedValue({ words: mockPages });

      const { result } = renderHook(() => useSpellcheck('/test/novel'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.words).toContain('Alice');
      expect(result.current.words).toContain('Bob');
      expect(result.current.words).toContain('Smith');
      expect(result.current.words).toContain('The');
      expect(result.current.words).toContain('Shire');
    });

    it('handles empty wiki pages list', async () => {
      wikiHandlers.rebuildDict.mockResolvedValue({ words: [] });

      const { result } = renderHook(() => useSpellcheck('/test/novel'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.words).toEqual([]);
    });
  });

  describe('word checking', () => {
    beforeEach(async () => {
      wikiHandlers.rebuildDict.mockResolvedValue({ words: ['Alice', 'Frodo', 'Baggins'] });
    });

    it('checks if word is in dictionary', async () => {
      const { result } = renderHook(() => useSpellcheck('/test/novel'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isWordInDictionary('Alice')).toBe(true);
      expect(result.current.isWordInDictionary('Frodo')).toBe(true);
      expect(result.current.isWordInDictionary('Baggins')).toBe(true);
    });

    it('performs case-insensitive lookup', async () => {
      const { result } = renderHook(() => useSpellcheck('/test/novel'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isWordInDictionary('alice')).toBe(true);
      expect(result.current.isWordInDictionary('ALICE')).toBe(true);
      expect(result.current.isWordInDictionary('Alice')).toBe(true);
    });

    it('returns false for words not in dictionary', async () => {
      const { result } = renderHook(() => useSpellcheck('/test/novel'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isWordInDictionary('NotAWikiPage')).toBe(false);
      expect(result.current.isWordInDictionary('xyz')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('handles fetch error gracefully', async () => {
      wikiHandlers.rebuildDict.mockRejectedValue(new Error('IPC error'));

      const { result } = renderHook(() => useSpellcheck('/test/novel'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.words).toEqual([]);
      expect(result.current.isWordInDictionary('anything')).toBe(false);
    });
  });

  describe('refresh', () => {
    it('allows manual refresh of dictionary', async () => {
      wikiHandlers.rebuildDict
        .mockResolvedValueOnce({ words: ['Alice'] })
        .mockResolvedValueOnce({ words: ['Alice', 'Bob'] });

      const { result } = renderHook(() => useSpellcheck('/test/novel'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.words).toContain('Alice');
      expect(result.current.words).not.toContain('Bob');

      result.current.refresh();

      await waitFor(() => {
        expect(result.current.words).toContain('Bob');
      });
    });
  });

  describe('dependencies', () => {
    it('reloads dictionary when novelPath changes', async () => {
      wikiHandlers.rebuildDict
        .mockResolvedValueOnce({ words: ['Alice'] })
        .mockResolvedValueOnce({ words: ['Bob'] });

      const { result, rerender } = renderHook(
        ({ path }) => useSpellcheck(path),
        { initialProps: { path: '/test/novel1' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.words).toContain('Alice');

      // Change path
      rerender({ path: '/test/novel2' });

      await waitFor(() => {
        expect(result.current.words).toContain('Bob');
      });
    });

    it('reloads dictionary when wiki-change event is dispatched for the current novel', async () => {
      wikiHandlers.rebuildDict
        .mockResolvedValueOnce({ words: ['Alice'] })
        .mockResolvedValueOnce({ words: ['Alice', 'Shadowfax'] });

      const { result } = renderHook(() => useSpellcheck('/test/novel'));

      await waitFor(() => {
        expect(result.current.words).toContain('Alice');
      });

      window.dispatchEvent(new CustomEvent('netwriter:wiki-dictionary-updated', {
        detail: { novelPath: '/test/novel' },
      }));

      await waitFor(() => {
        expect(result.current.words).toContain('Shadowfax');
      });
    });
  });
});
