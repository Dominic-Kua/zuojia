import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChapterEditor } from '../../../src/components/ChapterEditor';

// Mock dependencies
vi.mock('../../../src/hooks/useAutosave', () => ({
  useAutosave: vi.fn(() => ({
    isSaving: false,
    saveError: null,
    hasUnsavedChanges: false,
    manualSave: vi.fn(),
  })),
}));

vi.mock('../../../src/hooks/useChapters', () => ({
  useChapters: vi.fn(() => ({
    chapters: [
      { filename: 'chapter-01.md', title: 'Chapter 1', wordCount: 1500 },
      { filename: 'chapter-02.md', title: 'Chapter 2', wordCount: 2000 },
    ],
    currentChapter: 'chapter-01.md',
    setCurrentChapter: vi.fn(),
    loading: false,
    error: null,
    loadChapter: vi.fn(() => Promise.resolve('# Chapter 1\n\nContent')),
    saveChapter: vi.fn(() => Promise.resolve()),
  })),
}));

describe('ChapterEditor Component', () => {
  const mockNovelPath = '/path/to/novel';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render editor components', () => {
    const { container } = render(<ChapterEditor novelPath={mockNovelPath} initialChapter="chapter-01.md" />);
    
    // Should have basic editor structure
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeInTheDocument();
  });

  it('should initialize autosave hook', async () => {
    const { useAutosave } = await import('../../../src/hooks/useAutosave');
    
    render(<ChapterEditor novelPath={mockNovelPath} initialChapter="chapter-01.md" />);
    
    expect(useAutosave).toHaveBeenCalledWith(
      mockNovelPath,
      'chapter-01.md',
      expect.any(String)
    );
  });

  it('should display saving indicator when autosaving', async () => {
    const { useAutosave } = await import('../../../src/hooks/useAutosave');
    useAutosave.mockReturnValue({
      isSaving: true,
      saveError: null,
      hasUnsavedChanges: true,
      manualSave: vi.fn(),
    });

    render(<ChapterEditor novelPath={mockNovelPath} initialChapter="chapter-01.md" />);
    
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it('should display error toast when autosave fails', async () => {
    const { useAutosave } = await import('../../../src/hooks/useAutosave');
    useAutosave.mockReturnValue({
      isSaving: false,
      saveError: { message: 'Failed to save', code: 'GIT_COMMIT_FAILED' },
      hasUnsavedChanges: true,
      manualSave: vi.fn(),
    });

    render(<ChapterEditor novelPath={mockNovelPath} initialChapter="chapter-01.md" />);
    
    expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
  });

  it('should show unsaved changes indicator', async () => {
    const { useAutosave } = await import('../../../src/hooks/useAutosave');
    useAutosave.mockReturnValue({
      isSaving: false,
      saveError: null,
      hasUnsavedChanges: true,
      manualSave: vi.fn(),
    });

    render(<ChapterEditor novelPath={mockNovelPath} initialChapter="chapter-01.md" />);
    
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });
});
