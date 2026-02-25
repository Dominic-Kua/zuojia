import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorToolbar } from '../../../src/components/EditorToolbar';

// Mock the ChapterList component
vi.mock('../../../src/components/Navigation/ChapterList', () => ({
  ChapterList: ({ chapters, currentChapter, onChapterSelect }) => (
    <select data-testid="chapter-list" value={currentChapter} onChange={(e) => onChapterSelect(e.target.value)}>
      {chapters.map(ch => <option key={ch.filename} value={ch.filename}>{ch.title}</option>)}
    </select>
  )
}));

// Mock the IPC client
vi.mock('../../../src/lib/ipc-client', () => ({
  indexHandlers: {
    getIndex: vi.fn(() => Promise.resolve({
      chapters: [
        { filename: 'chapter-01.md', title: 'Chapter 1', wordCount: 1500 },
        { filename: 'chapter-02.md', title: 'Chapter 2', wordCount: 2000 },
      ],
      wiki: []
    }))
  },
  chapterHandlers: {
    readChapter: vi.fn((novelPath, filename) => 
      Promise.resolve(`Content of ${filename}`)
    ),
    writeChapter: vi.fn(() => Promise.resolve())
  }
}));

describe('EditorToolbar Component', () => {
  const mockNovelPath = '/path/to/novel';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render toolbar with chapter selector', async () => {
    render(<EditorToolbar novelPath={mockNovelPath} currentChapter="chapter-01.md" onChapterChange={vi.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('chapter-list')).toBeInTheDocument();
    });
  });

  it('should load chapters from index on mount', async () => {
    const { indexHandlers } = await import('../../../src/lib/ipc-client');
    
    render(<EditorToolbar novelPath={mockNovelPath} currentChapter="chapter-01.md" onChapterChange={vi.fn()} />);
    
    await waitFor(() => {
      expect(indexHandlers.getIndex).toHaveBeenCalledWith(mockNovelPath);
    });
  });

  it('should call onChapterChange when chapter is selected', async () => {
    const onChapterChange = vi.fn();
    const user = userEvent.setup();
    
    render(<EditorToolbar novelPath={mockNovelPath} currentChapter="chapter-01.md" onChapterChange={onChapterChange} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('chapter-list')).toBeInTheDocument();
    });
    
    const dropdown = screen.getByTestId('chapter-list');
    await user.selectOptions(dropdown, 'chapter-02.md');
    
    expect(onChapterChange).toHaveBeenCalledWith('chapter-02.md');
  });

  it('should handle error state when loading chapters fails', async () => {
    const { indexHandlers } = await import('../../../src/lib/ipc-client');
    indexHandlers.getIndex.mockRejectedValueOnce(new Error('Failed to load index'));
    
    render(<EditorToolbar novelPath={mockNovelPath} currentChapter="chapter-01.md" onChapterChange={vi.fn()} />);
    
    await waitFor(() => {
      // Should show error message instead of chapter list
      expect(screen.getByText(/failed to load index/i)).toBeInTheDocument();
      expect(screen.queryByTestId('chapter-list')).not.toBeInTheDocument();
    });
  });
});
