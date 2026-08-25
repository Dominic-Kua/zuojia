/**
 * Tests for LlmChatWindow component
 * Covers wiki/LLM status indicators, service badges, and chat flow
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Shared vi.fn instances: usable both via these aliases (beforeEach defaults)
// and via the dynamically imported llmHandlers/mcpHandlers objects (which are
// the same functions), so either mocking style works in test bodies.
const { mockLlmHealth, mockMcpHealth, mockLlmChat, mockLlmGetConfig, mockLlmStartRuntime, mockLlmStopRuntime, mockMcpCallTool, mockMcpStartServer } = vi.hoisted(() => ({
  mockLlmHealth: vi.fn(),
  mockMcpHealth: vi.fn(),
  mockLlmChat: vi.fn(),
  mockLlmGetConfig: vi.fn(),
  mockLlmStartRuntime: vi.fn(),
  mockLlmStopRuntime: vi.fn(),
  mockMcpCallTool: vi.fn(),
  mockMcpStartServer: vi.fn(),
}));

vi.mock('../../../src/lib/ipc-client', () => ({
  llmHandlers: {
    health: mockLlmHealth,
    chat: mockLlmChat,
    getConfig: mockLlmGetConfig,
    startRuntime: mockLlmStartRuntime,
    stopRuntime: mockLlmStopRuntime,
  },
  mcpHandlers: {
    health: mockMcpHealth,
    callTool: mockMcpCallTool,
    startServer: mockMcpStartServer,
    stopServer: vi.fn().mockResolvedValue({ status: 'ok' }),
    getLogs: vi.fn().mockResolvedValue([]),
  },
}));

import { LlmChatWindow } from '../../../src/components/LlmChatWindow';

describe('LlmChatWindow', () => {
  const novelPath = '/tmp/test-novel';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockLlmHealth.mockResolvedValue({ status: 'stopped' });
    mockMcpHealth.mockResolvedValue({ status: 'stopped' });
  });

  it('renders the LLM Chat button', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });
    
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
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });

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
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });

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
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 5000 });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    expect(screen.getByText('LLM: Running')).toBeInTheDocument();
  });

  it('can collapse and expand the chat window', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });

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
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });

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
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 5000 });

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
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });
    llmHandlers.getConfig.mockResolvedValue({
      executablePath: '/opt/homebrew/bin/ollama',
      modelName: 'gemma4:e2b',
      host: '127.0.0.1',
      port: 11434,
      temperature: 0.7,
      maxTokens: 4096,
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
        executablePath: '/opt/homebrew/bin/ollama',
        modelName: 'gemma4:e2b',
        host: '127.0.0.1',
        port: 11434,
        temperature: 0.7,
        maxTokens: 4096,
      });
    });
  });

  it('stops LLM when stop button is clicked', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 5000 });
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
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 5000 });

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
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 5000 });

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
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 5000 });

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
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 5000 });

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
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });
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
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });

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
    llmHandlers.health.mockResolvedValue({ status: 'running', uptimeMs: 5000 });

    const user = userEvent.setup();
    render(<LlmChatWindow novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('llm-chat-button'));
    });

    const input = screen.getByTestId('llm-chat-input');
    expect(input).not.toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Ask about your novel...');
  });

  it('checks LLM status periodically while the chat window is open', async () => {
    const { llmHandlers } = await import('../../../src/lib/ipc-client');
    llmHandlers.health.mockResolvedValue({ status: 'stopped', uptimeMs: 0 });

    vi.useFakeTimers();
    render(<LlmChatWindow novelPath={novelPath} />);

    // Health polling is gated on the chat window being open.
    expect(llmHandlers.health).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('llm-chat-button'));
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(llmHandlers.health).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(llmHandlers.health).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(llmHandlers.health).toHaveBeenCalledTimes(3);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when novelPath is not set', () => {
    const { container } = render(
      <LlmChatWindow novelPath={null} servicesStatus={null} servicesLoading={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders LLM Chat button', () => {
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    expect(screen.getByTestId('llm-chat-button')).toBeInTheDocument();
    expect(screen.getByText('LLM Chat')).toBeInTheDocument();
  });

  it('disables chat button during services loading', () => {
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={true} />
    );
    expect(screen.getByTestId('llm-chat-button')).toBeDisabled();
  });

  it('shows connecting overlay during services loading', () => {
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={true} />
    );
    expect(screen.getByText('Connecting')).toBeInTheDocument();
  });

  it('opens chat window when clicking LLM Chat button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    expect(screen.getByTestId('llm-chat-window')).toBeInTheDocument();
  });

  it('shows Wiki Offline when MCP is stopped', async () => {
    mockMcpHealth.mockResolvedValue({ status: 'stopped' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await waitFor(() => {
      expect(screen.getByText(/Wiki:.*Offline/)).toBeInTheDocument();
    });
  });

  it('shows Wiki Ready when MCP is running', async () => {
    mockMcpHealth.mockResolvedValue({ status: 'running' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await waitFor(() => {
      expect(screen.getByText(/Wiki:.*Ready/)).toBeInTheDocument();
    });
  });

  it('shows LLM Stopped when LLM is not running', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'stopped' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await waitFor(() => {
      expect(screen.getByText(/LLM:.*Stopped/)).toBeInTheDocument();
    });
  });

  it('shows LLM Running when LLM is running', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'running' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await waitFor(() => {
      expect(screen.getByText(/LLM:.*Running/)).toBeInTheDocument();
    });
  });

  it('shows Neo4j, MCP, LLM service badges during startup', async () => {
    const servicesStatus = {
      status: 'starting',
      neo4j: { status: 'running' },
      mcp: { status: 'running' },
      llm: { status: 'running' },
    };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={servicesStatus} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    expect(screen.getByText(/Neo4j:.*Ready/)).toBeInTheDocument();
    expect(screen.getByText(/MCP:.*Ready/)).toBeInTheDocument();
    expect(screen.getByText(/LLM:.*Ready/)).toBeInTheDocument();
  });

  it('shows error badges for failed services', async () => {
    const servicesStatus = {
      status: 'starting',
      neo4j: { status: 'error', error: 'Failed to start' },
      mcp: { status: 'skipped' },
      llm: { status: 'running' },
    };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={servicesStatus} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    expect(screen.getByText(/Neo4j:.*Error/)).toBeInTheDocument();
    expect(screen.getByText(/MCP:.*N\/A/)).toBeInTheDocument();
    expect(screen.getByText(/LLM:.*Ready/)).toBeInTheDocument();
  });

  it('shows starting badges when services loading', async () => {
    const servicesStatus = {
      status: 'starting',
      neo4j: { status: 'starting' },
      mcp: { status: 'starting' },
      llm: { status: 'starting' },
    };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={servicesStatus} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-startup-status')).toBeInTheDocument();
    });
    expect(screen.getByText(/Neo4j:.*Starting/)).toBeInTheDocument();
    expect(screen.getByText(/MCP:.*Starting/)).toBeInTheDocument();
    expect(screen.getByText(/LLM:.*Starting/)).toBeInTheDocument();
  });

  it('disables send button when LLM is stopped', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'stopped' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-send-button')).toBeDisabled();
    });
  });

  it('enables send button when LLM is running and input has text', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'running' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-send-button')).toBeDisabled();
    });
    await user.type(screen.getByTestId('llm-chat-input'), 'Hello');
    expect(screen.getByTestId('llm-send-button')).not.toBeDisabled();
  });

  it('sends message and receives response', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'running' });
    mockMcpHealth.mockResolvedValue({ status: 'stopped' });
    mockLlmChat.mockResolvedValue('I can help with your novel!');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-input')).not.toBeDisabled();
    });
    await user.type(screen.getByTestId('llm-chat-input'), 'Tell me about the hero');
    await waitFor(() => {
      expect(screen.getByTestId('llm-send-button')).not.toBeDisabled();
    });
    await user.click(screen.getByTestId('llm-send-button'));
    await waitFor(() => {
      expect(screen.getByText('Tell me about the hero')).toBeInTheDocument();
      expect(screen.getByText('I can help with your novel!')).toBeInTheDocument();
    });
  });

  it('clears messages when clicking Clear button', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'running' });
    mockLlmChat.mockResolvedValue('Response');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await user.type(screen.getByTestId('llm-chat-input'), 'Test');
    await user.click(screen.getByTestId('llm-send-button'));
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('llm-clear-messages'));
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
  });

  it('collapses and expands chat window', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    expect(screen.getByTestId('llm-chat-messages')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Collapse chat'));
    expect(screen.queryByTestId('llm-chat-messages')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Expand chat'));
    expect(screen.getByTestId('llm-chat-messages')).toBeInTheDocument();
  });

  it('closes chat window when clicking overlay', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    expect(screen.getByTestId('llm-chat-window')).toBeInTheDocument();
    await user.click(screen.getByTestId('llm-chat-overlay'));
    expect(screen.queryByTestId('llm-chat-window')).not.toBeInTheDocument();
  });

  it('shows Start LLM button when LLM is stopped', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'stopped' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    expect(screen.getByTestId('llm-start-button')).toBeInTheDocument();
    expect(screen.queryByTestId('llm-stop-button')).not.toBeInTheDocument();
  });

  it('shows Stop LLM button when LLM is running', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'running' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    expect(screen.getByTestId('llm-stop-button')).toBeInTheDocument();
    expect(screen.queryByTestId('llm-start-button')).not.toBeInTheDocument();
  });

  it('shows placeholder when no messages and LLM is stopped', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'stopped' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    expect(screen.getByText('LLM runtime is stopped. Click "Start LLM" to begin.')).toBeInTheDocument();
  });

  it('shows placeholder when no messages and LLM is running', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'running' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    expect(screen.getByText('Ask me anything about your novel...')).toBeInTheDocument();
  });

  it('polls health status periodically', async () => {
    mockLlmHealth.mockResolvedValue({ status: 'stopped' });
    mockMcpHealth.mockResolvedValue({ status: 'stopped' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    expect(mockLlmHealth).toHaveBeenCalledTimes(1);
    expect(mockMcpHealth).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockLlmHealth).toHaveBeenCalledTimes(2);
    expect(mockMcpHealth).toHaveBeenCalledTimes(2);
  });

  it('handles LLM health check failure gracefully', async () => {
    mockLlmHealth.mockRejectedValue(new Error('IPC error'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await waitFor(() => {
      expect(screen.getByText(/LLM:.*Error/)).toBeInTheDocument();
    });
  });

  it('handles MCP health check failure gracefully', async () => {
    mockMcpHealth.mockRejectedValue(new Error('IPC error'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <LlmChatWindow novelPath="/tmp/novel" servicesStatus={null} servicesLoading={false} />
    );
    await user.click(screen.getByTestId('llm-chat-button'));
    await waitFor(() => {
      expect(screen.getByText(/Wiki:.*Offline/)).toBeInTheDocument();
    });
  });
});
