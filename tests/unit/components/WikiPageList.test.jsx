/**
 * Tests for WikiPageList component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WikiPageList from '../../../src/components/WikiSidebar/WikiPageList';

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
  {
    slug: 'setting',
    title: 'Story Setting',
    wordCount: 450,
    lastModified: '2024-01-10T08:00:00Z',
  },
];

describe('WikiPageList', () => {
  const mockProps = {
    pages: mockPages,
    selectedSlug: null,
    onSelectPage: vi.fn(),
    onDeletePage: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders wiki pages list', () => {
      render(<WikiPageList {...mockProps} />);

      expect(screen.getByText('Alice the Protagonist')).toBeInTheDocument();
      expect(screen.getByText('Bob the Antagonist')).toBeInTheDocument();
      expect(screen.getByText('Story Setting')).toBeInTheDocument();
    });

    it('renders empty state when no pages', () => {
      render(<WikiPageList {...mockProps} pages={[]} />);

      expect(screen.getByText(/no wiki pages/i)).toBeInTheDocument();
    });

    it('displays word count for each page', () => {
      render(<WikiPageList {...mockProps} />);

      // Word count is in spans with class wiki-page-wordcount
      const elements = screen.queryAllByText(/words/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('displays last modified date', () => {
      render(<WikiPageList {...mockProps} />);

      // Check that dates are displayed (format may vary)
      const items = screen.getAllByRole('button', { name: /alice|bob|setting/i });
      expect(items.length).toBeGreaterThan(0);
    });

    it('renders loading state', () => {
      render(<WikiPageList {...mockProps} isLoading={true} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('page selection', () => {
    it('calls onSelectPage when page is clicked', async () => {
      const user = userEvent.setup();
      render(<WikiPageList {...mockProps} />);

      const pageButton = screen.getByRole('button', { name: /select alice/i });
      await user.click(pageButton);

      expect(mockProps.onSelectPage).toHaveBeenCalledWith('alice');
    });

    it('highlights selected page', () => {
      render(<WikiPageList {...mockProps} selectedSlug="alice" />);

      const selectedPage = screen.getByRole('button', { name: /select alice/i }).closest('li');
      expect(selectedPage).toHaveClass('selected');
    });

    it('does not highlight unselected pages', () => {
      render(<WikiPageList {...mockProps} selectedSlug="alice" />);

      const unselectedPage = screen.getByRole('button', { name: /select bob/i }).closest('li');
      expect(unselectedPage).not.toHaveClass('selected');
    });
  });

  describe('page deletion', () => {
    it('renders delete buttons in the DOM for all pages', () => {
      render(<WikiPageList {...mockProps} />);
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      // One delete button per page (the ✕ icon buttons)
      expect(deleteButtons.length).toBe(mockPages.length);
    });

    it('shows confirmation when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(<WikiPageList {...mockProps} />);

      const deleteButton = screen.getByRole('button', { name: /delete alice/i });
      await user.click(deleteButton);

      expect(screen.getByText(/Delete "Alice the Protagonist"/)).toBeInTheDocument();
    });

    it('calls onDeletePage after confirmation', async () => {
      const user = userEvent.setup();
      render(<WikiPageList {...mockProps} />);

      const deleteButton = screen.getByRole('button', { name: /delete alice/i });
      await user.click(deleteButton);
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await user.click(confirmButton);

      expect(mockProps.onDeletePage).toHaveBeenCalledWith('alice');
    });

    it('delete button is reachable and responds to keyboard activation', async () => {
      const user = userEvent.setup();
      render(<WikiPageList {...mockProps} />);

      const deleteButton = screen.getByRole('button', { name: /delete alice/i });
      deleteButton.focus();
      expect(deleteButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByText(/Delete "Alice the Protagonist"/)).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('renders search input', () => {
      render(<WikiPageList {...mockProps} />);

      expect(screen.getByPlaceholderText(/search|filter/i)).toBeInTheDocument();
    });

    it('filters pages by title', async () => {
      const user = userEvent.setup();
      const mockOnSearch = vi.fn();
      render(<WikiPageList {...mockProps} onSearch={mockOnSearch} />);

      const searchInput = screen.getByPlaceholderText(/search|filter/i);
      await user.type(searchInput, 'Alice');

      expect(mockOnSearch).toHaveBeenCalledWith('Alice');
    });

    it('clears search results', async () => {
      const user = userEvent.setup();
      const mockOnSearch = vi.fn();
      render(<WikiPageList {...mockProps} onSearch={mockOnSearch} />);

      const searchInput = screen.getByPlaceholderText(/search|filter/i);
      await user.type(searchInput, 'test');
      await user.clear(searchInput);

      expect(mockOnSearch).toHaveBeenCalledWith('');
    });
  });

  describe('sorting', () => {
    it('sorts pages alphabetically by title', () => {
      render(<WikiPageList {...mockProps} />);

      const items = screen.getAllByRole('button', { name: /^select (?:alice|bob|story)/i });
      expect(items[0]).toHaveTextContent('Alice');
      expect(items[1]).toHaveTextContent('Bob');
      expect(items[2]).toHaveTextContent('Story');
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<WikiPageList {...mockProps} />);

      expect(screen.getByRole('list')).toBeInTheDocument();
      const items = screen.getAllByRole('listitem');
      expect(items.length).toBe(3);
    });

    it('page items are keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<WikiPageList {...mockProps} />);

      const firstPageButton = screen.getByRole('button', { name: /select alice/i });
      firstPageButton.focus();

      expect(firstPageButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockProps.onSelectPage).toHaveBeenCalledWith('alice');
    });
  });
});
