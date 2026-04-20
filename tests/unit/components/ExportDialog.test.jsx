import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDialog } from '../../../src/components/ExportDialog';

let consoleErrorSpy;
const originalConsoleError = console.error;

vi.mock('../../../src/lib/ipc-client', () => ({
  exportHandlers: {
    pdf: vi.fn(),
    getLogs: vi.fn(),
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

    await screen.findByText('Chapter 1');

    await user.clear(await screen.findByTestId('export-title-input'));
    await user.type(screen.getByTestId('export-title-input'), 'My Novel');
    await user.type(screen.getByTestId('export-author-input'), 'Dom');

    await act(async () => {
      await user.click(screen.getByTestId('export-confirm'));
    });

    await waitFor(() => {
      expect(exportHandlers.pdf).toHaveBeenCalledWith(
        novelPath,
        expect.objectContaining({
          title: 'My Novel',
          author: 'Dom',
          date: expect.any(String),
        })
      );
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

    await screen.findByText('Chapter 1');

    await act(async () => {
      await user.click(screen.getByTestId('export-confirm'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toHaveTextContent('TeX is not installed');
      expect(screen.getByTestId('export-error')).toHaveTextContent('mactex-no-gui');
    });
  });

  it('renders checkboxes for each chapter, all checked by default', async () => {
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

    await screen.findByText('Chapter 1');

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });

  it('disables Export button when all chapters are deselected', async () => {
    const { indexHandlers } = await import('../../../src/lib/ipc-client');
    indexHandlers.getIndex.mockResolvedValue({
      chapters: [{ filename: 'chapter-01.md', title: 'Chapter 1' }],
    });

    const user = userEvent.setup();
    render(<ExportDialog novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('export-button'));
    });

    await screen.findByText('Chapter 1');
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();

    expect(screen.getByTestId('export-confirm')).toBeDisabled();
  });

  it('includes only selected chapters in chapterOrder payload', async () => {
    const { indexHandlers, exportHandlers } = await import('../../../src/lib/ipc-client');
    indexHandlers.getIndex.mockResolvedValue({
      chapters: [
        { filename: 'chapter-01.md', title: 'Chapter 1' },
        { filename: 'chapter-02.md', title: 'Chapter 2' },
        { filename: 'chapter-03.md', title: 'Chapter 3' },
      ],
    });
    exportHandlers.pdf.mockResolvedValue({ outputPath: '/tmp/novel.pdf' });

    const user = userEvent.setup();
    render(<ExportDialog novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('export-button'));
    });

    await screen.findByText('Chapter 2');

    // Deselect chapter 2 (second checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    await act(async () => {
      await user.click(screen.getByTestId('export-confirm'));
    });

    await waitFor(() => {
      expect(exportHandlers.pdf).toHaveBeenCalledWith(
        novelPath,
        expect.objectContaining({
          chapterOrder: [
            { filename: 'chapter-01.md', title: 'Chapter 1' },
            { filename: 'chapter-03.md', title: 'Chapter 3' },
          ],
        })
      );
    });
  });

  it('sends chapterOrder in reordered sequence after drag-and-drop', async () => {
    const { indexHandlers, exportHandlers } = await import('../../../src/lib/ipc-client');
    indexHandlers.getIndex.mockResolvedValue({
      chapters: [
        { filename: 'chapter-01.md', title: 'Chapter 1' },
        { filename: 'chapter-02.md', title: 'Chapter 2' },
      ],
    });
    exportHandlers.pdf.mockResolvedValue({ outputPath: '/tmp/novel.pdf' });

    const user = userEvent.setup();
    render(<ExportDialog novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('export-button'));
    });

    await screen.findByText('Chapter 1');

    // Drag chapter-01 (index 0) onto chapter-02 (index 1) — result: [chapter-02, chapter-01]
    const item1 = screen.getByTestId(`export-chapter-item-${encodeURIComponent('chapter-01.md')}`);
    const item2 = screen.getByTestId(`export-chapter-item-${encodeURIComponent('chapter-02.md')}`);
    fireEvent.dragStart(item1);
    fireEvent.dragOver(item2);
    fireEvent.drop(item2);

    await act(async () => {
      await user.click(screen.getByTestId('export-confirm'));
    });

    await waitFor(() => {
      expect(exportHandlers.pdf).toHaveBeenCalledWith(
        novelPath,
        expect.objectContaining({
          chapterOrder: [
            { filename: 'chapter-02.md', title: 'Chapter 2' },
            { filename: 'chapter-01.md', title: 'Chapter 1' },
          ],
        })
      );
    });
  });
});

describe('ExportDialog — logs viewer', () => {
  const novelPath = '/path/to/novel';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function openDialogWithChapters() {
    const { indexHandlers } = await import('../../../src/lib/ipc-client');
    indexHandlers.getIndex.mockResolvedValue({
      chapters: [{ filename: 'ch-01.md', title: 'Chapter 1' }],
    });
    const user = userEvent.setup();
    render(<ExportDialog novelPath={novelPath} />);
    await act(async () => {
      await user.click(screen.getByTestId('export-button'));
    });
    await screen.findByText('Chapter 1');
    return user;
  }

  it('shows a "View Logs" button in the export dialog', async () => {
    const { exportHandlers } = await import('../../../src/lib/ipc-client');
    exportHandlers.getLogs.mockResolvedValue([]);
    await openDialogWithChapters();
    expect(screen.getByTestId('export-view-logs-button')).toBeInTheDocument();
  });

  it('shows "No export logs yet" when there are no logs', async () => {
    const { exportHandlers } = await import('../../../src/lib/ipc-client');
    exportHandlers.getLogs.mockResolvedValue([]);

    const user = await openDialogWithChapters();
    await act(async () => {
      await user.click(screen.getByTestId('export-view-logs-button'));
    });

    await screen.findByTestId('export-logs-panel');
    expect(screen.getByText(/no export logs yet/i)).toBeInTheDocument();
  });

  it('renders log filenames when logs are available', async () => {
    const { exportHandlers } = await import('../../../src/lib/ipc-client');
    exportHandlers.getLogs.mockResolvedValue([
      { filename: 'export-2026-04-18T12-00-00-000Z.log', content: 'timestamp: ...\nexitCode: 0' },
    ]);

    const user = await openDialogWithChapters();
    await act(async () => {
      await user.click(screen.getByTestId('export-view-logs-button'));
    });

    await screen.findByTestId('export-logs-panel');
    expect(screen.getByText('export-2026-04-18T12-00-00-000Z.log')).toBeInTheDocument();
  });
});