import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommitButton } from '../../../src/components/CommitButton';

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
    await user.click(screen.getByTestId('commit-button'));

    await waitFor(() => {
      expect(gitHandlers.listChanges).toHaveBeenCalledWith(novelPath);
      expect(screen.getByLabelText('manuscript/chapter-01.md')).toBeInTheDocument();
    });
  });

  it('commits selected files with the entered message', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    gitHandlers.listChanges.mockResolvedValue({ files: ['manuscript/chapter-01.md', 'manuscript/chapter-02.md'] });
    gitHandlers.manualCommit.mockResolvedValue({ hash: 'abc1234', message: 'Checkpoint save' });

    const user = userEvent.setup();
    render(<CommitButton novelPath={novelPath} />);
    await user.click(screen.getByTestId('commit-button'));

    await waitFor(() => screen.getByLabelText('manuscript/chapter-01.md'));
    await user.click(screen.getByLabelText('manuscript/chapter-02.md'));
    await user.type(screen.getByTestId('commit-message-input'), 'Checkpoint save');
    await user.click(screen.getByTestId('commit-confirm'));

    expect(gitHandlers.manualCommit).toHaveBeenCalledWith(novelPath, ['manuscript/chapter-01.md'], 'Checkpoint save');
  });

  it('shows empty state when there are no changed files', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    gitHandlers.listChanges.mockResolvedValue({ files: [] });

    const user = userEvent.setup();
    render(<CommitButton novelPath={novelPath} />);
    await user.click(screen.getByTestId('commit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('commit-empty-state')).toBeInTheDocument();
    });
  });

  it('shows success toast after commit', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    gitHandlers.listChanges.mockResolvedValue({ files: ['manuscript/chapter-01.md'] });
    gitHandlers.manualCommit.mockResolvedValue({ hash: 'abc1234', message: 'Checkpoint save' });

    const user = userEvent.setup();
    render(<CommitButton novelPath={novelPath} />);
    await user.click(screen.getByTestId('commit-button'));

    await waitFor(() => screen.getByLabelText('manuscript/chapter-01.md'));
    await user.type(screen.getByTestId('commit-message-input'), 'Checkpoint save');
    await user.click(screen.getByTestId('commit-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('commit-toast')).toHaveTextContent('Committed abc1234');
    });
  });
});
