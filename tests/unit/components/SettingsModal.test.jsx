/**
 * Tests for SettingsModal component
 * Covers LLM defaults alignment, settings persistence, and tab navigation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGitGetConfig = vi.fn();
const mockGitSaveConfig = vi.fn();
const mockLlmGetConfig = vi.fn();
const mockLlmSaveConfig = vi.fn();
const mockLlmHealth = vi.fn();
const mockLlmStartRuntime = vi.fn();
const mockLlmStopRuntime = vi.fn();

vi.mock('../../../src/lib/ipc-client', () => ({
  gitHandlers: {
    getConfig: (...args) => mockGitGetConfig(...args),
    saveConfig: (...args) => mockGitSaveConfig(...args),
  },
  llmHandlers: {
    getConfig: (...args) => mockLlmGetConfig(...args),
    saveConfig: (...args) => mockLlmSaveConfig(...args),
    health: (...args) => mockLlmHealth(...args),
    startRuntime: (...args) => mockLlmStartRuntime(...args),
    stopRuntime: (...args) => mockLlmStopRuntime(...args),
  },
}));

import { SettingsModal } from '../../../src/components/SettingsModal';

async function openSettings(user) {
  await user.click(screen.getByTestId('settings-button'));
  await waitFor(() => {
    expect(screen.getByTestId('settings-dialog')).toBeInTheDocument();
  });
}

async function switchToLlmTab(user) {
  await user.click(screen.getByRole('button', { name: /LLM Settings/i }));
}

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGitGetConfig.mockResolvedValue({ remoteUrl: 'git@github.com:test/repo.git', branch: 'main', sshKeyPath: '~/.ssh/id_rsa' });
    mockLlmGetConfig.mockResolvedValue({ executablePath: '/opt/homebrew/bin/llama-server', modelName: 'gemma-4-E2B-it-Q3_K_S', host: '127.0.0.1', port: 8080, temperature: 0.7, maxTokens: 4096 });
    mockLlmHealth.mockResolvedValue({ status: 'stopped' });
    mockGitSaveConfig.mockResolvedValue({ status: 'ok' });
    mockLlmSaveConfig.mockResolvedValue({ status: 'ok' });
  });

  it('returns null when novelPath is not set', () => {
    const { container } = render(<SettingsModal novelPath={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows settings button', () => {
    render(<SettingsModal novelPath="/tmp/novel" />);
    expect(screen.getByTestId('settings-button')).toBeInTheDocument();
  });

  it('opens settings dialog on click', async () => {
    const user = userEvent.setup();
    render(<SettingsModal novelPath="/tmp/novel" />);
    await openSettings(user);
    expect(screen.getByTestId('settings-dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows Git Settings and LLM Settings tabs', async () => {
    const user = userEvent.setup();
    render(<SettingsModal novelPath="/tmp/novel" />);
    await openSettings(user);
    expect(screen.getByRole('button', { name: /Git Settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LLM Settings/i })).toBeInTheDocument();
  });

  it('loads and displays git settings', async () => {
    const user = userEvent.setup();
    render(<SettingsModal novelPath="/tmp/novel" />);
    await openSettings(user);
    await waitFor(() => {
      expect(screen.getByDisplayValue('git@github.com:test/repo.git')).toBeInTheDocument();
    });
  });

  it('loads and displays LLM settings with llama-server defaults', async () => {
    const user = userEvent.setup();
    render(<SettingsModal novelPath="/tmp/novel" />);
    await openSettings(user);
    await switchToLlmTab(user);
    await waitFor(() => {
      expect(screen.getByDisplayValue('/opt/homebrew/bin/llama-server')).toBeInTheDocument();
      expect(screen.getByDisplayValue('gemma-4-E2B-it-Q3_K_S')).toBeInTheDocument();
      expect(screen.getByDisplayValue('127.0.0.1')).toBeInTheDocument();
    });
  });

  it('shows LLM port 8080 (not Ollama 11434)', async () => {
    const user = userEvent.setup();
    render(<SettingsModal novelPath="/tmp/novel" />);
    await openSettings(user);
    await switchToLlmTab(user);
    await waitFor(() => {
      expect(screen.getByDisplayValue('8080')).toBeInTheDocument();
    });
  });

  it('shows LLM status indicator', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'running' });
    const user = userEvent.setup();
    render(<SettingsModal novelPath="/tmp/novel" />);
    await openSettings(user);
    await switchToLlmTab(user);
    await waitFor(() => {
      expect(screen.getByText(/running/i)).toBeInTheDocument();
    });
  });

  it('saves git settings', async () => {
    const user = userEvent.setup();
    render(<SettingsModal novelPath="/tmp/novel" />);
    await openSettings(user);
    await waitFor(() => {
      expect(screen.getByDisplayValue('git@github.com:test/repo.git')).toBeInTheDocument();
    });
    const remoteInput = screen.getByDisplayValue('git@github.com:test/repo.git');
    await user.clear(remoteInput);
    await user.type(remoteInput, 'git@github.com:new/repo.git');
    await user.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() => {
      expect(mockGitSaveConfig).toHaveBeenCalledWith('/tmp/novel', expect.objectContaining({
        remoteUrl: 'git@github.com:new/repo.git',
      }));
    });
  });

  it('saves LLM settings', async () => {
    const user = userEvent.setup();
    render(<SettingsModal novelPath="/tmp/novel" />);
    await openSettings(user);
    await switchToLlmTab(user);
    await waitFor(() => {
      expect(screen.getByTestId('llm-port-input')).toHaveValue(8080);
    });
    const portInput = screen.getByTestId('llm-port-input');
    fireEvent.change(portInput, { target: { value: '9090' } });
    await user.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() => {
      expect(mockLlmSaveConfig).toHaveBeenCalledWith(expect.objectContaining({
        port: 9090,
      }));
    });
  });

  it('handles config load failure gracefully', async () => {
    mockGitGetConfig.mockRejectedValue(new Error('IPC error'));
    mockLlmGetConfig.mockRejectedValue(new Error('IPC error'));
    const user = userEvent.setup();
    render(<SettingsModal novelPath="/tmp/novel" />);
    await openSettings(user);
    await waitFor(() => {
      expect(screen.getByTestId('settings-dialog')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });
  });
});
