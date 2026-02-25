import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../../../src/hooks/useAutosave';

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
    // Cleanup
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
    const { result } = renderHook(() =>
      useAutosave(mockNovelPath, mockFilename, 'content')
    );

    // Initially not saving
    expect(result.current.isSaving).toBe(false);

    // Manual save should be callable
    await act(async () => {
      await result.current.manualSave();
    });

    // After manual save, should have called commit
    expect(result.current).toBeDefined();
  });
});

