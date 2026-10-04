import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PushButton } from '../../../src/components/PushButton';

let consoleErrorSpy;
const originalConsoleError = console.error;

vi.mock('../../../src/lib/ipc-client', () => ({
  gitHandlers: {
    push: vi.fn(),
  },
}));

describe('PushButton', () => {
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

  it('renders the Push button', () => {
    render(<PushButton novelPath={novelPath} />);
    expect(screen.getByTestId('push-button')).toBeInTheDocument();
    expect(screen.getByText('Push')).toBeInTheDocument();
  });

  it('shows success toast after push', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    gitHandlers.push.mockResolvedValue({ pushed: true, pushedCommits: 3, branch: 'main' });

    const user = userEvent.setup();
    render(<PushButton novelPath={novelPath} />);
    await user.click(screen.getByTestId('push-button'));

    await waitFor(() => {
      expect(gitHandlers.push).toHaveBeenCalledWith(novelPath, { confirmRemote: false });
      expect(screen.getByTestId('push-toast')).toHaveTextContent('Pushed 3 commits');
    });
  });

  it('shows confirm dialog on unconfirmed remote and pushes after approval', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    const unconfirmed = new Error('Push remote has not been confirmed for this novel');
    unconfirmed.code = 'REMOTE_UNCONFIRMED';
    unconfirmed.context = { remoteUrl: 'https://evil.example/other.git', branch: 'main' };
    gitHandlers.push
      .mockRejectedValueOnce(unconfirmed)
      .mockResolvedValueOnce({ pushed: true, pushedCommits: 2, branch: 'main' });

    const user = userEvent.setup();
    render(<PushButton novelPath={novelPath} />);
    await user.click(screen.getByTestId('push-button'));

    await waitFor(() => {
      expect(screen.getByTestId('push-confirm-dialog')).toBeInTheDocument();
    });
    expect(screen.getByTestId('push-confirm-remote')).toHaveTextContent('https://evil.example/other.git');
    expect(screen.getByTestId('push-confirm-remote')).toHaveTextContent('main');
    // Nothing pushed yet — the gate stopped it.
    expect(gitHandlers.push).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('push-confirm-approve'));

    await waitFor(() => {
      expect(gitHandlers.push).toHaveBeenCalledWith(novelPath, { confirmRemote: true });
      expect(screen.getByTestId('push-toast')).toHaveTextContent('Pushed 2 commits');
      expect(screen.queryByTestId('push-confirm-dialog')).not.toBeInTheDocument();
    });
  });

  it('cancelling the confirm dialog pushes nothing', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    const unconfirmed = new Error('Push remote has not been confirmed for this novel');
    unconfirmed.code = 'REMOTE_UNCONFIRMED';
    unconfirmed.context = { remoteUrl: 'https://evil.example/other.git', branch: 'main' };
    gitHandlers.push.mockRejectedValue(unconfirmed);

    const user = userEvent.setup();
    render(<PushButton novelPath={novelPath} />);
    await user.click(screen.getByTestId('push-button'));

    await waitFor(() => {
      expect(screen.getByTestId('push-confirm-dialog')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('push-confirm-cancel'));

    expect(screen.queryByTestId('push-confirm-dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('push-error-dialog')).not.toBeInTheDocument();
    expect(gitHandlers.push).toHaveBeenCalledTimes(1);
  });

  it('shows guidance dialog on failure', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    const error = new Error('SSH key not found');
    error.suggestion = 'Run ssh-add ~/.ssh/id_test';
    gitHandlers.push.mockRejectedValue(error);

    const user = userEvent.setup();
    render(<PushButton novelPath={novelPath} />);
    await user.click(screen.getByTestId('push-button'));

    await waitFor(() => {
      expect(screen.getByTestId('push-error-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('push-error-dialog')).toHaveTextContent('SSH key not found');
      expect(screen.getByTestId('push-error-dialog')).toHaveTextContent('Run ssh-add ~/.ssh/id_test');
    });
  });

  it('disables button while push is in progress', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    let resolvePush;
    gitHandlers.push.mockReturnValue(new Promise((resolve) => { resolvePush = resolve; }));

    const user = userEvent.setup();
    render(<PushButton novelPath={novelPath} />);
    await user.click(screen.getByTestId('push-button'));

    expect(screen.getByTestId('push-button')).toBeDisabled();

    resolvePush({ pushed: true, pushedCommits: 1, branch: 'main' });

    await waitFor(() => {
      expect(screen.getByTestId('push-toast')).toBeInTheDocument();
    });
  });
});
