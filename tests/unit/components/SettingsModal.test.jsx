import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsModal } from '../../../src/components/SettingsModal';

let consoleErrorSpy;
const originalConsoleError = console.error;

vi.mock('../../../src/lib/ipc-client', () => ({
  gitHandlers: {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
  },
}));

describe('SettingsModal', () => {
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

  it('renders the Settings button', () => {
    render(<SettingsModal novelPath={novelPath} />);
    expect(screen.getByTestId('settings-button')).toBeInTheDocument();
  });

  it('loads git settings when the dialog opens', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    gitHandlers.getConfig.mockResolvedValue({
      remoteUrl: 'git@github.com:user/repo.git',
      branch: 'main',
      sshKeyPath: '~/.ssh/id_ed25519',
    });

    const user = userEvent.setup();
    render(<SettingsModal novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('settings-button'));
    });

    expect(gitHandlers.getConfig).toHaveBeenCalledWith(novelPath);
    expect(await screen.findByTestId('git-settings-section')).toBeInTheDocument();
    expect(screen.getByTestId('git-remote-url-input')).toHaveValue('git@github.com:user/repo.git');
    expect(screen.getByTestId('git-branch-input')).toHaveValue('main');
    expect(screen.getByTestId('git-ssh-key-input')).toHaveValue('~/.ssh/id_ed25519');
  });

  it('saves git settings from the form', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    gitHandlers.getConfig.mockResolvedValue({
      remoteUrl: '',
      branch: 'main',
      sshKeyPath: '~/.ssh/id_rsa',
    });
    gitHandlers.saveConfig.mockResolvedValue({
      remoteUrl: 'https://github.com/user/repo.git',
      branch: 'drafts',
      sshKeyPath: '~/.ssh/id_rsa',
    });

    const user = userEvent.setup();
    render(<SettingsModal novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('settings-button'));
    });

    await user.clear(await screen.findByTestId('git-remote-url-input'));
    await user.type(screen.getByTestId('git-remote-url-input'), 'https://github.com/user/repo.git');
    await user.clear(screen.getByTestId('git-branch-input'));
    await user.type(screen.getByTestId('git-branch-input'), 'drafts');

    await act(async () => {
      await user.click(screen.getByTestId('git-settings-save'));
    });

    await waitFor(() => {
      expect(gitHandlers.saveConfig).toHaveBeenCalledWith(novelPath, {
        remoteUrl: 'https://github.com/user/repo.git',
        branch: 'drafts',
        sshKeyPath: '~/.ssh/id_rsa',
      });
    });
  });

  it('shows helper validation errors inline', async () => {
    const { gitHandlers } = await import('../../../src/lib/ipc-client');
    gitHandlers.getConfig.mockResolvedValue({
      remoteUrl: '',
      branch: 'main',
      sshKeyPath: '~/.ssh/id_rsa',
    });
    gitHandlers.saveConfig.mockRejectedValue(new Error('Remote could not be reached'));

    const user = userEvent.setup();
    render(<SettingsModal novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('settings-button'));
    });

    await user.type(await screen.findByTestId('git-remote-url-input'), 'https://github.com/user/missing.git');

    await act(async () => {
      await user.click(screen.getByTestId('git-settings-save'));
    });

    expect(await screen.findByTestId('git-settings-error')).toHaveTextContent('Remote could not be reached');
  });
});