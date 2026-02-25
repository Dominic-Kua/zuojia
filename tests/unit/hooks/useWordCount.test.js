/**
 * Tests for useWordCount hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useWordCount } from '../../../src/hooks/useWordCount';
import * as ipcClient from '../../../src/lib/ipc-client';

vi.mock('../../../src/lib/ipc-client');

describe('useWordCount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes with loading state', () => {
    vi.spyOn(ipcClient.statsHandlers, 'wordCount').mockResolvedValue({ wordCount: 0 });
    vi.spyOn(ipcClient.statsHandlers, 'manuscriptCount').mockResolvedValue({ wordCount: 0 });
    vi.spyOn(ipcClient.statsHandlers, 'todayCount').mockResolvedValue({ wordCount: 0 });

    const { result } = renderHook(() =>
      useWordCount('/test/novel', 'chapter-1.md', 'test content')
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.manuscriptCount).toBe(0);
    expect(result.current.chapterCount).toBe(0);
    expect(result.current.todayCount).toBe(0);
  });

  it('loads all counts on mount', async () => {
    vi.spyOn(ipcClient.statsHandlers, 'wordCount').mockResolvedValue({ wordCount: 5 });
    vi.spyOn(ipcClient.statsHandlers, 'manuscriptCount').mockResolvedValue({ wordCount: 100 });
    vi.spyOn(ipcClient.statsHandlers, 'todayCount').mockResolvedValue({ wordCount: 25 });

    const { result } = renderHook(() =>
      useWordCount('/test/novel', 'chapter-1.md', 'test content here today')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.chapterCount).toBe(5);
    expect(result.current.manuscriptCount).toBe(100);
    expect(result.current.todayCount).toBe(25);
    expect(result.current.error).toBeNull();
  });

  it('updates chapter count when content changes', async () => {
    vi.spyOn(ipcClient.statsHandlers, 'wordCount')
      .mockResolvedValueOnce({ wordCount: 5 })
      .mockResolvedValueOnce({ wordCount: 10 });
    vi.spyOn(ipcClient.statsHandlers, 'manuscriptCount').mockResolvedValue({ wordCount: 100 });
    vi.spyOn(ipcClient.statsHandlers, 'todayCount').mockResolvedValue({ wordCount: 25 });

    const { result, rerender } = renderHook(
      ({ content }) => useWordCount('/test/novel', 'chapter-1.md', content),
      { initialProps: { content: 'test content here today' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.chapterCount).toBe(5);

    // Update content
    rerender({ content: 'test content here today with more words added now' });

    // Advance timers to trigger debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.chapterCount).toBe(10);
    });
  });

  it('debounces content changes (300ms)', async () => {
    const wordCountSpy = vi.spyOn(ipcClient.statsHandlers, 'wordCount').mockResolvedValue({ wordCount: 5 });
    vi.spyOn(ipcClient.statsHandlers, 'manuscriptCount').mockResolvedValue({ wordCount: 100 });
    vi.spyOn(ipcClient.statsHandlers, 'todayCount').mockResolvedValue({ wordCount: 25 });

    const { rerender } = renderHook(
      ({ content }) => useWordCount('/test/novel', 'chapter-1.md', content),
      { initialProps: { content: 'initial' } }
    );

    await waitFor(() => {
      expect(wordCountSpy).toHaveBeenCalledTimes(1);
    });

    wordCountSpy.mockClear();

    // Rapidly change content multiple times
    rerender({ content: 'change 1' });
    rerender({ content: 'change 2' });
    rerender({ content: 'change 3' });

    // Should not call immediately
    expect(wordCountSpy).not.toHaveBeenCalled();

    // Advance timers to trigger debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(wordCountSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('handles errors gracefully', async () => {
    vi.spyOn(ipcClient.statsHandlers, 'wordCount').mockRejectedValue(new Error('IPC error'));
    vi.spyOn(ipcClient.statsHandlers, 'manuscriptCount').mockResolvedValue({ wordCount: 100 });
    vi.spyOn(ipcClient.statsHandlers, 'todayCount').mockResolvedValue({ wordCount: 25 });

    const { result } = renderHook(() =>
      useWordCount('/test/novel', 'chapter-1.md', 'test content')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error.message).toContain('IPC error');
  });

  it('provides refresh function to manually reload counts', async () => {
    const manuscriptSpy = vi.spyOn(ipcClient.statsHandlers, 'manuscriptCount')
      .mockResolvedValueOnce({ wordCount: 100 })
      .mockResolvedValueOnce({ wordCount: 150 });
    vi.spyOn(ipcClient.statsHandlers, 'wordCount').mockResolvedValue({ wordCount: 5 });
    vi.spyOn(ipcClient.statsHandlers, 'todayCount').mockResolvedValue({ wordCount: 25 });

    const { result } = renderHook(() =>
      useWordCount('/test/novel', 'chapter-1.md', 'test content')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.manuscriptCount).toBe(100);

    // Call refresh
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.manuscriptCount).toBe(150);
    });

    expect(manuscriptSpy).toHaveBeenCalledTimes(2);
  });

  it('does not reload manuscript count on every content change (cached)', async () => {
    const manuscriptSpy = vi.spyOn(ipcClient.statsHandlers, 'manuscriptCount').mockResolvedValue({ wordCount: 100 });
    vi.spyOn(ipcClient.statsHandlers, 'wordCount').mockResolvedValue({ wordCount: 5 });
    vi.spyOn(ipcClient.statsHandlers, 'todayCount').mockResolvedValue({ wordCount: 25 });

    const { rerender } = renderHook(
      ({ content }) => useWordCount('/test/novel', 'chapter-1.md', content),
      { initialProps: { content: 'initial' } }
    );

    await waitFor(() => {
      expect(manuscriptSpy).toHaveBeenCalledTimes(1);
    });

    // Change content
    rerender({ content: 'changed content' });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Manuscript count should still be called only once (cached)
    await waitFor(() => {
      expect(manuscriptSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('updates today count when chapter changes', async () => {
    const todaySpy = vi.spyOn(ipcClient.statsHandlers, 'todayCount')
      .mockResolvedValueOnce({ wordCount: 25 })
      .mockResolvedValueOnce({ wordCount: 30 });
    vi.spyOn(ipcClient.statsHandlers, 'wordCount').mockResolvedValue({ wordCount: 5 });
    vi.spyOn(ipcClient.statsHandlers, 'manuscriptCount').mockResolvedValue({ wordCount: 100 });

    const { rerender } = renderHook(
      ({ chapter }) => useWordCount('/test/novel', chapter, 'test content'),
      { initialProps: { chapter: 'chapter-1.md' } }
    );

    await waitFor(() => {
      expect(todaySpy).toHaveBeenCalledTimes(1);
    });

    // Change chapter
    rerender({ chapter: 'chapter-2.md' });

    await waitFor(() => {
      expect(todaySpy).toHaveBeenCalledTimes(2);
    });
  });
});
