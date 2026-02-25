import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NovelSelector } from '../../../src/components/Navigation/NovelSelector';

// Mock IPC
vi.mock('../../../src/lib/ipc-client', () => ({
  indexHandlers: {
    createNovel: vi.fn(),
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
});
