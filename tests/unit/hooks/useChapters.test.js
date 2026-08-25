/**
 * Tests for useChapters hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockIndexHandlers = {
  getIndex: vi.fn(),
};
const mockChapterHandlers = {
  readChapter: vi.fn(),
  writeChapter: vi.fn(),
};

vi.mock('../../../src/lib/ipc-client', () => ({
  indexHandlers: mockIndexHandlers,
  chapterHandlers: mockChapterHandlers,
}));

describe('useChapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads chapters from index on mount', async () => {
    mockIndexHandlers.getIndex.mockResolvedValue({
      chapters: [{ filename: 'ch01.md', title: 'Chapter 1' }],
    });
    const { useChapters } = await import('../../../src/hooks/useChapters');
    const { result } = renderHook(() => useChapters('/tmp/novel'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.chapters).toHaveLength(1);
    expect(result.current.chapters[0].filename).toBe('ch01.md');
  });

  it('sets loading to false when no novelPath', async () => {
    const { useChapters } = await import('../../../src/hooks/useChapters');
    const { result } = renderHook(() => useChapters(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.chapters).toEqual([]);
  });

  it('handles error from getIndex', async () => {
    mockIndexHandlers.getIndex.mockRejectedValue(new Error('Failed to load'));
    const { useChapters } = await import('../../../src/hooks/useChapters');
    const { result } = renderHook(() => useChapters('/tmp/novel'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to load');
    expect(result.current.chapters).toEqual([]);
  });

  it('loadChapter returns content', async () => {
    mockIndexHandlers.getIndex.mockResolvedValue({ chapters: [] });
    mockChapterHandlers.readChapter.mockResolvedValue('# Chapter 1\n\nContent');
    const { useChapters } = await import('../../../src/hooks/useChapters');
    const { result } = renderHook(() => useChapters('/tmp/novel'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const content = await result.current.loadChapter('ch01.md');
    expect(content).toBe('# Chapter 1\n\nContent');
    expect(mockChapterHandlers.readChapter).toHaveBeenCalledWith('/tmp/novel', 'ch01.md');
  });

  it('saveChapter writes content', async () => {
    mockIndexHandlers.getIndex.mockResolvedValue({ chapters: [] });
    const { useChapters } = await import('../../../src/hooks/useChapters');
    const { result } = renderHook(() => useChapters('/tmp/novel'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.saveChapter('ch01.md', 'new content');
    expect(mockChapterHandlers.writeChapter).toHaveBeenCalledWith('/tmp/novel', 'ch01.md', 'new content');
  });

  it('refresh reloads chapters', async () => {
    mockIndexHandlers.getIndex.mockResolvedValueOnce({ chapters: [] });
    const { useChapters } = await import('../../../src/hooks/useChapters');
    const { result } = renderHook(() => useChapters('/tmp/novel'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockIndexHandlers.getIndex.mockResolvedValueOnce({
      chapters: [{ filename: 'ch01.md', title: 'New Chapter' }],
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.chapters).toHaveLength(1);
  });
});
