import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDialog } from '../../../src/components/ExportDialog';

let consoleErrorSpy;
const originalConsoleError = console.error;

vi.mock('../../../src/lib/ipc-client', () => ({
  exportHandlers: {
    pdf: vi.fn(),
  },
  indexHandlers: {
    getIndex: vi.fn(),
  },
}));

describe('ExportDialog', () => {
  const novelPath = '/path/to/novel';

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      const [firstArg] = args;
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('renders the Export button', () => {
    render(<ExportDialog novelPath={novelPath} />);
    expect(screen.getByTestId('export-button')).toBeInTheDocument();
  });

  it('loads chapters and opens the export dialog', async () => {
    const { indexHandlers } = await import('../../../src/lib/ipc-client');
    indexHandlers.getIndex.mockResolvedValue({
      chapters: [
        { filename: 'chapter-01.md', title: 'Chapter 1' },
        { filename: 'chapter-02.md', title: 'Chapter 2' },
      ],
    });

    const user = userEvent.setup();
    render(<ExportDialog novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('export-button'));
    });

    expect(indexHandlers.getIndex).toHaveBeenCalledWith(novelPath);
    expect(await screen.findByTestId('export-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('export-chapter-list')).toHaveTextContent('Chapter 1');
    expect(screen.getByTestId('export-chapter-list')).toHaveTextContent('Chapter 2');
  });

  it('submits metadata to the PDF export handler', async () => {
    const { indexHandlers, exportHandlers } = await import('../../../src/lib/ipc-client');
    indexHandlers.getIndex.mockResolvedValue({
      chapters: [{ filename: 'chapter-01.md', title: 'Chapter 1' }],
    });
    exportHandlers.pdf.mockResolvedValue({ outputPath: '/tmp/novel.pdf' });

    const user = userEvent.setup();
    render(<ExportDialog novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('export-button'));
    });

    await user.clear(await screen.findByTestId('export-title-input'));
    await user.type(screen.getByTestId('export-title-input'), 'My Novel');
    await user.type(screen.getByTestId('export-author-input'), 'Dom');

    await act(async () => {
      await user.click(screen.getByTestId('export-confirm'));
    });

    await waitFor(() => {
      expect(exportHandlers.pdf).toHaveBeenCalledWith(novelPath, {
        title: 'My Novel',
        author: 'Dom',
        date: expect.any(String),
      });
    });
  });

  it('shows helper guidance when export fails', async () => {
    const { indexHandlers, exportHandlers } = await import('../../../src/lib/ipc-client');
    indexHandlers.getIndex.mockResolvedValue({
      chapters: [{ filename: 'chapter-01.md', title: 'Chapter 1' }],
    });
    const error = new Error('TeX is not installed');
    error.suggestion = 'Install via: brew install --cask mactex-no-gui';
    exportHandlers.pdf.mockRejectedValue(error);

    const user = userEvent.setup();
    render(<ExportDialog novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('export-button'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('export-confirm'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toHaveTextContent('TeX is not installed');
      expect(screen.getByTestId('export-error')).toHaveTextContent('mactex-no-gui');
    });
  });
});