import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NovelSelector } from '../../../src/components/Navigation/NovelSelector';

// Mock IPC
vi.mock('../../../src/lib/ipc-client', () => ({
  indexHandlers: {
    createNovel: vi.fn(),
    validateNovel: vi.fn(),
    getIndex: vi.fn(),
  },
  appHandlers: {
    selectNovelDirectory: vi.fn(),
  },
  invokeHandler: vi.fn(),
}));

describe('NovelSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render "New Novel" button', () => {
    render(<NovelSelector />);
    expect(screen.getByText(/New Novel/i)).toBeInTheDocument();
  });

  it('should open "New Novel" dialog when button clicked', async () => {
    const user = userEvent.setup();
    render(<NovelSelector />);

    const newButton = screen.getByText(/New Novel/i);
    await user.click(newButton);

    expect(screen.getByText(/Create a New Novel/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Novel name/i)).toBeInTheDocument();
  });

  it('should disable Create button when novel name is empty', async () => {
    const user = userEvent.setup();
    render(<NovelSelector />);

    const newButton = screen.getByText(/New Novel/i);
    await user.click(newButton);

    const createButton = screen.getByRole('button', { name: /Create/i });
    expect(createButton).toBeDisabled();
  });

  it('should enable Create button when novel name is provided', async () => {
    const user = userEvent.setup();
    render(<NovelSelector />);

    const newButton = screen.getByText(/New Novel/i);
    await user.click(newButton);

    const input = screen.getByPlaceholderText(/Novel name/i);
    await user.type(input, 'my-novel');

    const createButton = screen.getByRole('button', { name: /Create/i });
    expect(createButton).not.toBeDisabled();
  });

  it('should show error message for invalid novel name', async () => {
    const user = userEvent.setup();
    render(<NovelSelector />);

    const newButton = screen.getByText(/New Novel/i);
    await user.click(newButton);

    const input = screen.getByPlaceholderText(/Novel name/i);
    await user.type(input, 'novel/invalid');

    const createButton = screen.getByRole('button', { name: /Create/i });
    expect(createButton).toBeDisabled();
  });

  it('should render "Open Novel" button', () => {
    render(<NovelSelector />);
    expect(screen.getByText(/Open Novel/i)).toBeInTheDocument();
  });

  it('should open dialog when "Open Novel" button clicked', async () => {
    const user = userEvent.setup();
    const { appHandlers } = await import('../../../src/lib/ipc-client');
    
    render(<NovelSelector />);

    const openButton = screen.getByText(/Open Novel/i);
    await user.click(openButton);

    expect(appHandlers.selectNovelDirectory).toHaveBeenCalled();
  });

  it('should display inline error when opening a novel fails', async () => {
    const user = userEvent.setup();
    const { appHandlers } = await import('../../../src/lib/ipc-client');
    appHandlers.selectNovelDirectory.mockRejectedValue(new Error('Failed to open novel'));

    render(<NovelSelector />);

    const openButton = screen.getByText(/Open Novel/i);
    await user.click(openButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to open novel')).toBeInTheDocument();
    });
  });

  it('should not display inline error when dialog is canceled', async () => {
    const user = userEvent.setup();
    const { appHandlers } = await import('../../../src/lib/ipc-client');
    const cancelError = new Error('Dialog canceled');
    cancelError.code = 'DIALOG_CANCELED';
    appHandlers.selectNovelDirectory.mockRejectedValue(cancelError);

    render(<NovelSelector />);

    const openButton = screen.getByText(/Open Novel/i);
    await user.click(openButton);

    await waitFor(() => {
      expect(screen.queryByText(/canceled/i)).not.toBeInTheDocument();
    });
  });

  it('should clear inline error when "Open Novel" is clicked again', async () => {
    const user = userEvent.setup();
    const { appHandlers, indexHandlers } = await import('../../../src/lib/ipc-client');
    appHandlers.selectNovelDirectory
      .mockRejectedValueOnce(new Error('Failed to open novel'))
      .mockResolvedValue({ novelPath: '/some/path' });
    indexHandlers.validateNovel.mockResolvedValue({ isValid: true });
    indexHandlers.getIndex.mockResolvedValue({});

    render(<NovelSelector />);

    const openButton = screen.getByText(/Open Novel/i);
    await user.click(openButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to open novel')).toBeInTheDocument();
    });

    await user.click(openButton);

    await waitFor(() => {
      expect(screen.queryByText('Failed to open novel')).not.toBeInTheDocument();
    });
  });
});
