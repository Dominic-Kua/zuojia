import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AskWikiAssistant } from '../../../src/components/AskWikiAssistant';

vi.mock('../../../src/lib/ipc-client', () => ({
  mcpHandlers: {
    startServer: vi.fn(),
    callTool: vi.fn(),
    getLogs: vi.fn(),
  },
}));

describe('AskWikiAssistant', () => {
  const novelPath = '/tmp/story-novel';

  beforeEach(async () => {
    vi.clearAllMocks();
    const { mcpHandlers } = await import('../../../src/lib/ipc-client');
    mcpHandlers.startServer.mockResolvedValue({ status: 'running' });
    mcpHandlers.getLogs.mockResolvedValue({ logs: [] });
  });

  it('answers a query and renders citations', async () => {
    const { mcpHandlers } = await import('../../../src/lib/ipc-client');
    mcpHandlers.callTool.mockResolvedValue({
      status: 'ok',
      data: {
        results: [
          { slug: 'alice', title: 'Alice', snippet: 'Alice is the main protagonist.' },
          { slug: 'mentor', title: 'Mentor', snippet: 'Mentor guides Alice in chapter 3.' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<AskWikiAssistant novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('ask-wiki-button'));
    });

    await user.type(screen.getByTestId('ask-wiki-input'), 'Who helps Alice?');

    await act(async () => {
      await user.click(screen.getByTestId('ask-wiki-submit'));
    });

    await waitFor(() => {
      expect(mcpHandlers.startServer).toHaveBeenCalledWith(novelPath);
      expect(mcpHandlers.callTool).toHaveBeenCalledWith(
        'wiki_search',
        { query: 'Who helps Alice?', limit: 5 },
        { timeoutMs: 5000, retries: 1 }
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('ask-wiki-answer')).toHaveTextContent('Alice');
      expect(screen.getByTestId('ask-wiki-citations')).toHaveTextContent('Alice');
      expect(screen.getByTestId('ask-wiki-citations')).toHaveTextContent('mentor');
    });
  });

  it('can cancel an in-flight request', async () => {
    const { mcpHandlers } = await import('../../../src/lib/ipc-client');
    mcpHandlers.callTool.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                status: 'ok',
                data: { results: [{ slug: 'alice', title: 'Alice', snippet: 'slow result' }] },
              }),
            150
          );
        })
    );

    const user = userEvent.setup();
    render(<AskWikiAssistant novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('ask-wiki-button'));
    });

    await user.type(screen.getByTestId('ask-wiki-input'), 'Slow question');

    await act(async () => {
      await user.click(screen.getByTestId('ask-wiki-submit'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('ask-wiki-cancel'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('ask-wiki-status')).toHaveTextContent('Cancelled');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 220));
    });

    expect(screen.queryByTestId('ask-wiki-answer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ask-wiki-citations')).not.toBeInTheDocument();
  });

  it('shows actionable error when mcp query fails', async () => {
    const { mcpHandlers } = await import('../../../src/lib/ipc-client');
    const err = new Error('MCP runtime is not running');
    mcpHandlers.callTool.mockRejectedValue(err);

    const user = userEvent.setup();
    render(<AskWikiAssistant novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('ask-wiki-button'));
    });

    await user.type(screen.getByTestId('ask-wiki-input'), 'Why is the sky red?');

    await act(async () => {
      await user.click(screen.getByTestId('ask-wiki-submit'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('ask-wiki-error')).toHaveTextContent('MCP runtime is not running');
    });
  });
});
