import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommitButton } from '../../../src/components/CommitButton';

let consoleErrorSpy;
const originalConsoleError = console.error;

vi.mock('../../../src/lib/ipc-client', () => ({
  gitHandlers: {
    listChanges: vi.fn(),
    manualCommit: vi.fn(),
  },
}));

describe('CommitButton', () => {
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

  it('renders the Commit button', () => {
    render(<CommitButton novelPath={novelPath} />);
    expect(screen.getByTestId('commit-button')).toBeInTheDocument();
  });

  it('loads changed files when dialog opens', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    gitHandlers.listChanges.mockResolvedValue({ files: ['manuscript/chapter-01.md', 'manuscript/chapter-02.md'] });

    const user = userEvent.setup();
    render(<CommitButton novelPath={novelPath} />);
    await act(async () => {
      await user.click(screen.getByTestId('commit-button'));
    });

    expect(gitHandlers.listChanges).toHaveBeenCalledWith(novelPath);
    expect(await screen.findByLabelText('manuscript/chapter-01.md')).toBeInTheDocument();
  });

  it('commits selected files with the entered message', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    gitHandlers.listChanges.mockResolvedValue({ files: ['manuscript/chapter-01.md', 'manuscript/chapter-02.md'] });
    gitHandlers.manualCommit.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<CommitButton novelPath={novelPath} />);
    await act(async () => {
      await user.click(screen.getByTestId('commit-button'));
    });

    await screen.findByLabelText('manuscript/chapter-01.md');
    await user.click(screen.getByLabelText('manuscript/chapter-02.md'));
    await user.type(screen.getByTestId('commit-message-input'), 'Checkpoint save');
    await act(async () => {
      await user.click(screen.getByTestId('commit-confirm'));
    });

    await waitFor(() => {
      expect(gitHandlers.manualCommit).toHaveBeenCalledWith(novelPath, ['manuscript/chapter-01.md'], 'Checkpoint save');
    });
  });

  it('shows empty state when there are no changed files', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    gitHandlers.listChanges.mockResolvedValue({ files: [] });

    const user = userEvent.setup();
    render(<CommitButton novelPath={novelPath} />);
    await act(async () => {
      await user.click(screen.getByTestId('commit-button'));
    });

    expect(await screen.findByTestId('commit-empty-state')).toBeInTheDocument();
  });

});
