import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LlmChatWindow } from '../../src/components/LlmChatWindow';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

vi.mock('../../src/lib/ipc-client', () => ({
  gitHandlers: {},
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
  mcpHandlers: {
    health: vi.fn().mockResolvedValue({ status: 'stopped' }),
    startServer: vi.fn(),
    callTool: vi.fn(),
  },
}));

describe('LLM Chat Integration', () => {
  const novelPath = '/path/to/novel';
  
  beforeEach(async () => {
    vi.clearAllMocks();
    // Import after clearing mocks to get fresh module
    const { llmHandlers } = await import('../../src/lib/ipc-client');
    // Set up default mocks
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
  });

  it('should update LLM status when started from within chat window', async () => {
    const { llmHandlers } = await import('../../src/lib/ipc-client');
    
    render(<LlmChatWindow novelPath={novelPath} />);
    
    // Open chat window
    const chatButton = screen.getByTestId('llm-chat-button');
    await userEvent.click(chatButton);

    // Wait for chat window to open
    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-window')).toBeInTheDocument();
    });

    // Check status shows "LLM: Stopped"
    await waitFor(() => {
      expect(screen.getByText('LLM: Stopped')).toBeInTheDocument();
    });

    // Input should be disabled
    const input = screen.getByTestId('llm-chat-input');
    expect(input).toBeDisabled();

    // Start button should be visible
    expect(screen.getByTestId('llm-start-button')).toBeInTheDocument();

    // Mock startRuntime to succeed
    llmHandlers.startRuntime.mockResolvedValue({
      status: 'running',
      host: '127.0.0.1',
      port: 11434,
      modelName: 'gemma4:e2b',
    });

    // After starting, health should return 'running'
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 1000 });

    // Click Start LLM button
    await userEvent.click(screen.getByTestId('llm-start-button'));

    // Verify startRuntime was called with correct config
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

    // Status should update to "LLM: Running"
    await waitFor(() => {
      expect(screen.getByText('LLM: Running')).toBeInTheDocument();
    });

    // Input should now be enabled
    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-input')).toBeEnabled();
    });

    // Start button should be replaced with Stop button
    expect(screen.getByTestId('llm-stop-button')).toBeInTheDocument();
    expect(screen.queryByTestId('llm-start-button')).not.toBeInTheDocument();
  });

  it('should show Stop button when LLM is already running', async () => {
    const { llmHandlers } = await import('../../src/lib/ipc-client');
    
    // Mock: LLM is already running
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 5000 });

    render(<LlmChatWindow novelPath={novelPath} />);
    
    // Open chat window
    const chatButton = screen.getByTestId('llm-chat-button');
    await userEvent.click(chatButton);

    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-window')).toBeInTheDocument();
    });

    // Check status shows "LLM: Running"
    await waitFor(() => {
      expect(screen.getByText('LLM: Running')).toBeInTheDocument();
    });

    // Input should be enabled
    const input = screen.getByTestId('llm-chat-input');
    expect(input).toBeEnabled();

    // Stop button should be visible
    expect(screen.getByTestId('llm-stop-button')).toBeInTheDocument();
    expect(screen.queryByTestId('llm-start-button')).not.toBeInTheDocument();
  });

  it('should allow sending messages when LLM is running', async () => {
    const { llmHandlers } = await import('../../src/lib/ipc-client');
    
    // Mock: LLM is running
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 5000 });

    render(<LlmChatWindow novelPath={novelPath} />);
    
    // Open chat window
    const chatButton = screen.getByTestId('llm-chat-button');
    await userEvent.click(chatButton);

    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-window')).toBeInTheDocument();
    });

    // Input should be enabled
    const input = screen.getByTestId('llm-chat-input');
    expect(input).toBeEnabled();

    // Type a message
    await userEvent.type(input, 'Hello, LLM!');

    // Send button should be enabled
    const sendButton = screen.getByTestId('llm-send-button');
    expect(sendButton).not.toBeDisabled();

    // Click send
    await userEvent.click(sendButton);

    // Message should appear in chat
    await waitFor(() => {
      expect(screen.getByText('Hello, LLM!')).toBeInTheDocument();
    });
  });
});