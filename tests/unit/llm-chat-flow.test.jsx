import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LlmChatWindow } from '../../src/components/LlmChatWindow';
import { SettingsModal } from '../../src/components/SettingsModal';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

vi.mock('../../src/lib/ipc-client', () => ({
  gitHandlers: {
    getConfig: vi.fn(() => Promise.resolve({ status: 'ok', data: {} })),
    saveConfig: vi.fn(() => Promise.resolve({ status: 'ok' })),
  },
  chapterHandlers: {},
  appHandlers: {},
  statsHandlers: {},
  exportHandlers: {},
  wikiHandlers: {},
  backupHandlers: {},
  llmHandlers: {
    health: vi.fn(),
    getConfig: vi.fn(),
    startRuntime: vi.fn(),
    stopRuntime: vi.fn(),
    chat: vi.fn(),
  },
  mcpHandlers: {},
}));

describe('LLM Chat Flow', () => {
  const novelPath = '/path/to/novel';
  
  beforeEach(async () => {
    vi.clearAllMocks();
    const { gitHandlers } = await import('../../src/lib/ipc-client');
    gitHandlers.getConfig.mockResolvedValue({
      status: 'ok',
      data: {
        userName: 'Test User',
        userEmail: 'test@example.com',
        remoteUrl: 'https://github.com/test/repo.git',
      },
    });
    gitHandlers.saveConfig.mockResolvedValue({ status: 'ok' });
  });

  it('should show LLM as running after starting from settings and allow chat', async () => {
    const { llmHandlers } = await import('../../src/lib/ipc-client');
    
    // Mock initial state: LLM is stopped
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });
    llmHandlers.getConfig.mockResolvedValue({
      status: 'ok',
      data: {
        executablePath: '/opt/homebrew/bin/ollama',
        modelName: 'gemma4:e2b',
        host: '127.0.0.1',
        port: 11434,
        temperature: 0.7,
        maxTokens: 4096,
      },
    });

    // Render SettingsModal
    render(<SettingsModal novelPath={novelPath} />);
    
    // Open settings dialog
    const openButton = screen.getByTestId('settings-button');
    await userEvent.click(openButton);
    
    // Wait for dialog to open
    await waitFor(() => {
      expect(screen.getByTestId('settings-dialog')).toBeInTheDocument();
    });

    // Switch to LLM tab
    await userEvent.click(screen.getByText('LLM Settings'));

    // Wait for LLM settings to load
    await waitFor(() => {
      expect(screen.getByTestId('llm-settings-section')).toBeInTheDocument();
    });

    // Check initial status shows "Stopped"
    expect(screen.getByText(/Status:/)).toBeInTheDocument();
    expect(screen.getByText(/Stopped/)).toBeInTheDocument();

    // Mock startRuntime to succeed
    llmHandlers.startRuntime.mockResolvedValue({
      status: 'running',
      host: '127.0.0.1',
      port: 11434,
      modelName: 'gemma4:e2b',
    });

    // Mock health to return "running" after start
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 1000 });

    // Start LLM
    const startButton = screen.getByTestId('llm-settings-start');
    await userEvent.click(startButton);

    // Wait for status to update
    await waitFor(() => {
      expect(screen.getByText(/Running/)).toBeInTheDocument();
    });

    // Close settings
    await userEvent.click(screen.getByTestId('settings-cancel'));

    // Now render LLM Chat Window
    render(<LlmChatWindow novelPath={novelPath} />);
    
    // Open chat window
    const chatButton = screen.getByTestId('llm-chat-button');
    await userEvent.click(chatButton);

    // Wait for chat window to open
    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-window')).toBeInTheDocument();
    });

    // Check that LLM status shows "Running" in chat window
    await waitFor(() => {
      expect(screen.getByText(/Running/)).toBeInTheDocument();
    });

    // Check that input is enabled (LLM is running)
    const input = screen.getByTestId('llm-chat-input');
    expect(input).toBeEnabled();

    // Mock a chat response
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 2000 });

    // Type a message
    await userEvent.type(input, 'Hello, how are you?');
    
    // Mock send message (we'll need to add this handler)
    // For now, just verify input is enabled and message can be typed
    expect(input).toHaveValue('Hello, how are you?');

    // Send the message
    const sendButton = screen.getByTestId('llm-send-button');
    await userEvent.click(sendButton);

    // Verify the chat window shows the message was sent
    await waitFor(() => {
      expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    });
  });

  it('should disable chat input when LLM is stopped', async () => {
    const { llmHandlers } = await import('../../src/lib/ipc-client');
    
    // Mock LLM as stopped
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });

    render(<LlmChatWindow novelPath={novelPath} />);
    
    // Open chat window
    const chatButton = screen.getByTestId('llm-chat-button');
    await userEvent.click(chatButton);

    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-window')).toBeInTheDocument();
    });

    // Check status shows "Stopped"
    await waitFor(() => {
       expect(screen.getByText('Stopped')).toBeInTheDocument();
    });

    // Input should be disabled
    const input = screen.getByTestId('llm-chat-input');
    expect(input).toBeDisabled();

    // Send button should be disabled or not visible (we show Start LLM button instead)
    expect(screen.getByTestId('llm-start-button')).toBeInTheDocument();
  });

  it('should show Start LLM button when LLM is stopped', async () => {
    const { llmHandlers } = await import('../../src/lib/ipc-client');
    
    // Mock LLM as stopped
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });
    llmHandlers.getConfig.mockResolvedValue({
      status: 'ok',
      data: {
        executablePath: '/opt/homebrew/bin/ollama',
        modelName: 'gemma4:e2b',
        host: '127.0.0.1',
        port: 11434,
        temperature: 0.7,
        maxTokens: 4096,
      },
    });

    render(<LlmChatWindow novelPath={novelPath} />);
    
    // Open chat window
    const chatButton = screen.getByTestId('llm-chat-button');
    await userEvent.click(chatButton);

    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-window')).toBeInTheDocument();
    });

    // Should show Start LLM button
    expect(screen.getByTestId('llm-start-button')).toBeInTheDocument();
    expect(screen.getByTestId('llm-start-button')).toHaveTextContent('Start LLM');

    // Clicking Start LLM should call startRuntime
    llmHandlers.startRuntime.mockResolvedValue({
      status: 'running',
      host: '127.0.0.1',
      port: 11434,
      modelName: 'gemma4:e2b',
    });

    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 1000 });

    await userEvent.click(screen.getByTestId('llm-start-button'));

    await waitFor(() => {
      expect(llmHandlers.startRuntime).toHaveBeenCalledWith({
        executablePath: '/opt/homebrew/bin/ollama',
        modelName: 'gemma4:e2b',
        host: '127.0.0.1',
        port: 11434,
        temperature: 0.7,
        maxTokens: 4096,
      });
    });
  });
});