import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LlmChatWindow } from '../../../src/components/LlmChatWindow';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('../../../src/lib/ipc-client', () => ({
  llmHandlers: {
    health: vi.fn(),
    getConfig: vi.fn(),
    startRuntime: vi.fn(),
    stopRuntime: vi.fn(),
  },
}));

describe('LlmChatWindow', () => {
  const novelPath = '/path/to/novel';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the LLM Chat button', () => {
    render(<LlmChatWindow novelPath={novelPath} />);
    expect(screen.getByTestId('llm-chat-button')).toBeInTheDocument();
    expect(screen.getByTestId('llm-chat-button')).toHaveTextContent('LLM Chat');
  });

  it('does not render when novelPath is null', () => {
    const { container } = render(<LlmChatWindow novelPath={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('opens chat window when button is clicked', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'stopped', uptimeMs: 0 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    expect(screen.queryByTestId('llm-chat-overlay')).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    expect(screen.getByTestId('llm-chat-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('llm-chat-window')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes chat window when overlay is clicked', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'stopped', uptimeMs: 0 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    expect(screen.getByTestId('llm-chat-overlay')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-overlay'));
    });

    expect(screen.queryByTestId('llm-chat-overlay')).not.toBeInTheDocument();
  });

  it('shows LLM status indicator', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'running', uptimeMs: 5000 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('can collapse and expand the chat window', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'stopped', uptimeMs: 0 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    const chatWindow = screen.getByTestId('llm-chat-window');
    expect(chatWindow).not.toHaveClass('collapsed');

    const collapseButtons = screen.getAllByRole('button');
    const collapseButton = collapseButtons.find(btn => btn.textContent === '◥');
    
    await act(async () => {
      await user.click(collapseButton);
    });

    expect(chatWindow).toHaveClass('collapsed');
  });

  it('shows start LLM button when LLM is stopped', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'stopped', uptimeMs: 0 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    expect(screen.getByTestId('llm-start-button')).toBeInTheDocument();
    expect(screen.getByTestId('llm-start-button')).toHaveTextContent('Start LLM');
  });

  it('shows stop LLM button when LLM is running', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'running', uptimeMs: 5000 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    expect(screen.getByTestId('llm-stop-button')).toBeInTheDocument();
    expect(screen.getByTestId('llm-stop-button')).toHaveTextContent('Stop LLM');
  });

  it('starts LLM when start button is clicked', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'stopped', uptimeMs: 0 } 
    });
    llmHandlers.getConfig.mockResolvedValue({
      status: 'ok',
      data: {
        executablePath: '/usr/local/bin/llama.cpp',
        modelPath: '/path/to/model.gguf',
        threads: 4,
        contextSize: 4096,
        temperature: 0.7,
        host: '127.0.0.1',
        port: 8080,
        extraArgs: [],
      },
      timestamp: new Date().toISOString(),
    });
    llmHandlers.startRuntime.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('llm-start-button'));
    });

    await waitFor(() => {
      expect(llmHandlers.startRuntime).toHaveBeenCalledWith({
        executablePath: '/usr/local/bin/llama.cpp',
        modelPath: '/path/to/model.gguf',
        threads: 4,
        contextSize: 4096,
        temperature: 0.7,
        host: '127.0.0.1',
        port: 8080,
        extraArgs: [],
      });
    });
  });

  it('stops LLM when stop button is clicked', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'running', uptimeMs: 5000 } 
    });
    llmHandlers.stopRuntime.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('llm-stop-button'));
    });

    await waitFor(() => {
      expect(llmHandlers.stopRuntime).toHaveBeenCalled();
    });
  });

  it('sends a message when send button is clicked', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'running', uptimeMs: 5000 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    const input = screen.getByTestId('llm-chat-input');
    await user.type(input, 'Hello LLM');

    await act(async () => {
      await user.click(screen.getByTestId('llm-send-button'));
    });

    expect(screen.getByTestId('llm-message-user')).toBeInTheDocument();
    expect(screen.getByText('Hello LLM')).toBeInTheDocument();
  });

  it('sends a message when Enter key is pressed', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'running', uptimeMs: 5000 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    const input = screen.getByTestId('llm-chat-input');
    await user.type(input, 'Hello LLM');

    await act(async () => {
      await user.keyboard('{Enter}');
    });

    expect(screen.getByTestId('llm-message-user')).toBeInTheDocument();
    expect(screen.getByText('Hello LLM')).toBeInTheDocument();
  });

  it('does not send empty messages', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'running', uptimeMs: 5000 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    const input = screen.getByTestId('llm-chat-input');
    await user.type(input, '   ');

    await act(async () => {
      await user.click(screen.getByTestId('llm-send-button'));
    });

    expect(screen.queryByTestId('llm-message-user')).not.toBeInTheDocument();
  });

  it('clears messages when clear button is clicked', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'running', uptimeMs: 5000 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    const input = screen.getByTestId('llm-chat-input');
    await user.type(input, 'Test message');

    await act(async () => {
      await user.click(screen.getByTestId('llm-send-button'));
    });

    await new Promise(resolve => setTimeout(resolve, 1100));

    expect(screen.getByTestId('llm-message-user')).toBeInTheDocument();
    expect(screen.getByTestId('llm-message-assistant')).toBeInTheDocument();

    const clearButton = screen.getByTestId('llm-clear-messages');
    expect(clearButton).not.toBeDisabled();

    await act(async () => {
      await user.click(clearButton);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('llm-message-user')).not.toBeInTheDocument();
      expect(screen.queryByTestId('llm-message-assistant')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Ask me anything about your novel/)).toBeInTheDocument();
  });

  it('shows error message when LLM fails to start', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'stopped', uptimeMs: 0 } 
    });
    llmHandlers.getConfig.mockRejectedValue(new Error('Config not found'));

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('llm-start-button'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to start LLM/)).toBeInTheDocument();
    });
  });

  it('disables input when LLM is not running', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'stopped', uptimeMs: 0 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    const input = screen.getByTestId('llm-chat-input');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Start LLM first to chat...');
  });

  it('enables input when LLM is running', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'running', uptimeMs: 5000 } 
    });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    const input = screen.getByTestId('llm-chat-input');
    expect(input).not.toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Ask about your novel...');
  });

  it('checks LLM status periodically', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ 
      status: 'ok', 
      data: { status: 'stopped', uptimeMs: 0 } 
    });

    vi.useFakeTimers();
    render(<LlmChatWindow novelPath={novelPath} />);

    expect(llmHandlers.health).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    expect(llmHandlers.health).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(5000);
    expect(llmHandlers.health).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });
});