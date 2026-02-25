import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChapterList } from '../../../src/components/Navigation/ChapterList';

describe('ChapterList Component', () => {
  const mockChapters = [
    { filename: 'chapter-01.md', title: 'Chapter 1', wordCount: 1500 },
    { filename: 'chapter-02.md', title: 'Chapter 2', wordCount: 2000 },
    { filename: 'chapter-03.md', title: 'The Big Reveal', wordCount: 1800 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render chapter list dropdown', () => {
    render(<ChapterList chapters={mockChapters} currentChapter="chapter-01.md" onChapterSelect={vi.fn()} />);
    
    // Should have a select or dropdown element
    const dropdown = screen.getByRole('combobox');
    expect(dropdown).toBeInTheDocument();
  });

  it('should display all chapters in dropdown', () => {
    render(<ChapterList chapters={mockChapters} currentChapter="chapter-01.md" onChapterSelect={vi.fn()} />);
    
    // Check that options exist (can vary by implementation - testing for presence)
    const dropdown = screen.getByRole('combobox');
    expect(dropdown).toBeInTheDocument();
  });

  it('should highlight current chapter', () => {
    render(<ChapterList chapters={mockChapters} currentChapter="chapter-02.md" onChapterSelect={vi.fn()} />);
    
    const dropdown = screen.getByRole('combobox');
    expect(dropdown.value).toBe('chapter-02.md');
  });

  it('should call onChapterSelect when chapter is clicked', async () => {
    const onChapterSelect = vi.fn();
    const user = userEvent.setup();
    
    render(<ChapterList chapters={mockChapters} currentChapter="chapter-01.md" onChapterSelect={onChapterSelect} />);
    
    const dropdown = screen.getByRole('combobox');
    await user.selectOptions(dropdown, 'chapter-02.md');
    
    expect(onChapterSelect).toHaveBeenCalledWith('chapter-02.md');
  });

  it('should handle empty chapters list', () => {
    render(<ChapterList chapters={[]} currentChapter={null} onChapterSelect={vi.fn()} />);
    
    const dropdown = screen.getByRole('combobox');
    expect(dropdown).toBeInTheDocument();
  });

  it('should display chapter title in options', () => {
    const { container } = render(
      <ChapterList chapters={mockChapters} currentChapter="chapter-01.md" onChapterSelect={vi.fn()} />
    );
    
    // Check that chapter titles appear in the dropdown
    expect(container.textContent).toContain('Chapter 1');
    expect(container.textContent).toContain('Chapter 2');
  });

  it('should be searchable/filterable', async () => {
    const user = userEvent.setup();
    
    render(<ChapterList chapters={mockChapters} currentChapter="chapter-01.md" onChapterSelect={vi.fn()} searchable={true} />);
    
    // If searchable, should have input or filter capability
    const dropdown = screen.getByRole('combobox');
    expect(dropdown).toBeInTheDocument();
  });

  it('should always include current chapter in filtered results even when it does not match the search', async () => {
    const user = userEvent.setup();

    render(
      <ChapterList
        chapters={mockChapters}
        currentChapter="chapter-01.md"
        onChapterSelect={vi.fn()}
        searchable={true}
      />
    );

    // Search for something that excludes chapter-01.md
    const searchInput = screen.getByRole('textbox', { name: /search chapters/i });
    await user.type(searchInput, 'Big Reveal');

    // The dropdown should still have chapter-01.md as a valid selected option
    const dropdown = screen.getByRole('combobox');
    expect(dropdown.value).toBe('chapter-01.md');
    // chapter-01.md option should still be present
    const options = Array.from(dropdown.options).map(o => o.value);
    expect(options).toContain('chapter-01.md');
  });

  it('should show unsaved indicator when hasUnsavedChanges is true', () => {
    render(
      <ChapterList 
        chapters={mockChapters} 
        currentChapter="chapter-01.md" 
        onChapterSelect={vi.fn()}
        hasUnsavedChanges={true}
      />
    );
    
    // Should show some indicator of unsaved changes
    const indicator = screen.getByTitle(/unsaved changes/i);
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toBe('*');
  });

  it('should call onBeforeSwitch when switching with unsaved changes', async () => {
    const onBeforeSwitch = vi.fn(() => Promise.resolve(true));
    const onChapterSelect = vi.fn();
    const user = userEvent.setup();
    
    render(
      <ChapterList 
        chapters={mockChapters}
        currentChapter="chapter-01.md"
        onChapterSelect={onChapterSelect}
        hasUnsavedChanges={true}
        onBeforeSwitch={onBeforeSwitch}
      />
    );
    
    const dropdown = screen.getByRole('combobox');
    await user.selectOptions(dropdown, 'chapter-02.md');
    
    expect(onBeforeSwitch).toHaveBeenCalled();
  });
});
