import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../../../src/hooks/useAutosave';
import { gitHandlers } from '../../../src/lib/ipc-client';

// Mock the IPC client
vi.mock('../../../src/lib/ipc-client', () => ({
  gitHandlers: {
    commit: vi.fn(() => Promise.resolve({ status: 'ok' })),
  },
}));

describe('useAutosave Hook', () => {
  const mockNovelPath = '/path/to/novel';
  const mockFilename = 'chapter-01.md';
  const initialContent = '# Chapter 1\n\nInitial content';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with unsaved changes = false', () => {
    const { result } = renderHook(() =>
      useAutosave(mockNovelPath, mockFilename, initialContent)
    );

    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.saveError).toBeNull();
  });

  it('should mark as unsaved when content changes', async () => {
    const { rerender, result } = renderHook(
      ({ content }) => useAutosave(mockNovelPath, mockFilename, content),
      { initialProps: { content: initialContent } }
    );

    await act(async () => {
      rerender({ content: '# Updated content' });
    });

    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('should have manual save function', () => {
    const { result } = renderHook(() =>
      useAutosave(mockNovelPath, mockFilename, initialContent)
    );

    expect(result.current.manualSave).toBeDefined();
    expect(typeof result.current.manualSave).toBe('function');
  });

  it('should provide commit state tracking', () => {
    const { result } = renderHook(() =>
      useAutosave(mockNovelPath, mockFilename, initialContent)
    );

    expect(result.current.isSaving).toBeDefined();
    expect(result.current.saveError).toBeDefined();
  });

  it('should handle missing required props', () => {
    const { result } = renderHook(() =>
      useAutosave(null, null, null)
    );

    expect(result.current).toBeDefined();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() =>
      useAutosave(mockNovelPath, mockFilename, 'content')
    );

    // Should unmount without errors
    expect(() => unmount()).not.toThrow();
  });

  it('should provide save tracking state', async () => {
    const { result, rerender } = renderHook(
      ({ content }) => useAutosave(mockNovelPath, mockFilename, content),
      { initialProps: { content: initialContent } }
    );

    // Initially not saving
    expect(result.current.isSaving).toBe(false);

    // Change content to mark as unsaved before manual save
    await act(async () => {
      rerender({ content: 'Updated content for save test' });
    });

    // Manual save should be callable
    await act(async () => {
      await result.current.manualSave();
    });

    // After manual save, should have called commit with correct parameters
    expect(gitHandlers.commit).toHaveBeenCalledWith(mockNovelPath, mockFilename, expect.any(String));
  });

  it('should not auto-commit before debounce delay elapses', async () => {
    vi.useFakeTimers();
    const debounceMs = 100;
    const autocommitMs = 1000;

    const { rerender } = renderHook(
      ({ content }) => useAutosave(mockNovelPath, mockFilename, content, debounceMs, autocommitMs),
      { initialProps: { content: initialContent } }
    );

    await act(async () => {
      rerender({ content: 'Changed content' });
    });

    // Advance time to just before the autocommit fires
    act(() => {
      vi.advanceTimersByTime(autocommitMs - 1);
    });

    expect(gitHandlers.commit).not.toHaveBeenCalled();
  });

  it('should auto-commit after debounce and autocommit delays elapse', async () => {
    vi.useFakeTimers();
    const debounceMs = 100;
    const autocommitMs = 1000;
    const updatedContent = 'Auto-saved content';

    const { rerender } = renderHook(
      ({ content }) => useAutosave(mockNovelPath, mockFilename, content, debounceMs, autocommitMs),
      { initialProps: { content: initialContent } }
    );

    await act(async () => {
      rerender({ content: updatedContent });
    });

    // Advance time past the full autocommit delay and flush async callbacks
    await act(async () => {
      vi.advanceTimersByTime(autocommitMs);
    });

    expect(gitHandlers.commit).toHaveBeenCalledWith(mockNovelPath, mockFilename, updatedContent);
  });

  it('should reset debounce timer on rapid successive content changes', async () => {
    vi.useFakeTimers();
    const debounceMs = 100;
    const autocommitMs = 1000;

    const { rerender } = renderHook(
      ({ content }) => useAutosave(mockNovelPath, mockFilename, content, debounceMs, autocommitMs),
      { initialProps: { content: initialContent } }
    );

    // Trigger multiple rapid changes within the debounce window
    await act(async () => {
      rerender({ content: 'Draft 1' });
    });
    act(() => { vi.advanceTimersByTime(50); });

    await act(async () => {
      rerender({ content: 'Draft 2' });
    });
    act(() => { vi.advanceTimersByTime(50); });

    await act(async () => {
      rerender({ content: 'Draft 3' });
    });

    // Not yet past autocommit from the last change
    act(() => { vi.advanceTimersByTime(autocommitMs - 1); });

    // Commit should not have fired yet (debounce was reset by each change)
    expect(gitHandlers.commit).not.toHaveBeenCalled();

    // Now advance past the remaining time
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(gitHandlers.commit).toHaveBeenCalledTimes(1);
    expect(gitHandlers.commit).toHaveBeenCalledWith(mockNovelPath, mockFilename, 'Draft 3');
  });
});

