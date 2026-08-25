/**
 * Tests for Sidebar component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPages = [
  { slug: 'hero', title: 'Hero', wordCount: 100, lastModified: '2024-01-15T10:30:00Z' },
  { slug: 'villain', title: 'Villain', wordCount: 50, lastModified: '2024-01-14T15:45:00Z' },
];

const mockCreatePage = vi.fn().mockResolvedValue({ status: 'ok', data: { slug: 'new-page' } });
const mockDeletePage = vi.fn().mockResolvedValue({ status: 'ok' });
const mockRenamePage = vi.fn().mockResolvedValue({ status: 'ok' });
const mockSearch = vi.fn().mockResolvedValue({ status: 'ok', data: { results: [] } });

vi.mock('../../../src/hooks/useWikiPages', () => ({
  useWikiPages: vi.fn(() => ({
    pages: mockPages,
    loading: false,
    error: null,
    createPage: mockCreatePage,
    deletePage: mockDeletePage,
    renamePage: mockRenamePage,
    search: mockSearch,
  })),
}));

vi.mock('../../../src/hooks/useGitHistory', () => ({
  useGitHistory: vi.fn(() => ({
    commits: [],
    loading: false,
    error: null,
  })),
}));

vi.mock('../../../src/lib/ipc-client', () => ({
  wikiHandlers: {
    update: vi.fn().mockResolvedValue({ status: 'ok' }),
    read: vi.fn().mockResolvedValue({ status: 'ok', data: { content: 'Test content', tags: [], title: 'Test' } }),
  },
}));

vi.mock('../../../src/lib/wiki-link-parser', () => ({
  resolveSlug: vi.fn((slug) => slug),
}));

vi.mock('marked', () => ({
  marked: {
    parse: vi.fn((content) => `<p>${content}</p>`),
    setOptions: vi.fn(),
  },
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html) => html),
  },
}));

import Sidebar from '../../../src/components/Sidebar';

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders wiki section header', () => {
    render(<Sidebar novelPath="/tmp/novel" />);
    expect(screen.getByText('Wiki')).toBeInTheDocument();
  });

  it('shows create button', () => {
    render(<Sidebar novelPath="/tmp/novel" />);
    expect(screen.getByTestId('wiki-create-button')).toBeInTheDocument();
  });

  it('opens create form when clicking + button', async () => {
    const user = userEvent.setup();
    render(<Sidebar novelPath="/tmp/novel" />);
    await user.click(screen.getByTestId('wiki-create-button'));
    expect(screen.getByTestId('create-wiki-dialog')).toBeInTheDocument();
  });

  it('shows wiki page list', () => {
    render(<Sidebar novelPath="/tmp/novel" />);
    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(screen.getByText('Villain')).toBeInTheDocument();
  });

  it('shows editor section', () => {
    render(<Sidebar novelPath="/tmp/novel" />);
    expect(screen.getByText('Wiki Editor')).toBeInTheDocument();
  });
});
