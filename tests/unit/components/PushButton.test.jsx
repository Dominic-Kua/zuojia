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
      expect(gitHandlers.push).toHaveBeenCalledWith(novelPath);
      expect(screen.getByTestId('push-toast')).toHaveTextContent('Pushed 3 commits');
    });
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
