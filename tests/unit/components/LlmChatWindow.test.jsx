/**
 * Tests for LlmChatWindow component
 * Covers wiki/LLM status indicators, service badges, and chat flow
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockLlmHealth = vi.fn();
const mockMcpHealth = vi.fn();
const mockLlmChat = vi.fn();
const mockLlmGetConfig = vi.fn();
const mockLlmStartRuntime = vi.fn();
const mockLlmStopRuntime = vi.fn();
const mockMcpCallTool = vi.fn();
const mockMcpStartServer = vi.fn();

vi.mock('../../../src/lib/ipc-client', () => ({
  llmHandlers: {
    health: (...args) => mockLlmHealth(...args),
    chat: (...args) => mockLlmChat(...args),
    getConfig: (...args) => mockLlmGetConfig(...args),
    startRuntime: (...args) => mockLlmStartRuntime(...args),
    stopRuntime: (...args) => mockLlmStopRuntime(...args),
  },
  mcpHandlers: {
    health: (...args) => mockMcpHealth(...args),
    callTool: (...args) => mockMcpCallTool(...args),
    startServer: (...args) => mockMcpStartServer(...args),
    stopServer: vi.fn().mockResolvedValue({ status: 'ok' }),
    getLogs: vi.fn().mockResolvedValue([]),
  },
}));

import { LlmChatWindow } from '../../../src/components/LlmChatWindow';

describe('LlmChatWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockLlmHealth.mockResolvedValue({ status: 'stopped' });
    mockMcpHealth.mockResolvedValue({ status: 'stopped' });
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
