/**
 * Tests for App component
 * Covers service startup flow, novel lifecycle, and LLM Chat integration
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockStartNovelServices = vi.fn();
const mockStopNovelServices = vi.fn();
const mockListNovels = vi.fn();
const mockLlmHealth = vi.fn();
const mockMcpHealth = vi.fn();

vi.mock('../../../src/lib/ipc-client', () => ({
  appHandlers: {
    startNovelServices: (...args) => mockStartNovelServices(...args),
    stopNovelServices: (...args) => mockStopNovelServices(...args),
    listNovels: (...args) => mockListNovels(...args),
    selectNovelDirectory: vi.fn().mockResolvedValue({ novelPath: '/tmp/new-novel' }),
    markNovelOpened: vi.fn().mockResolvedValue({}),
  },
  llmHandlers: {
    health: (...args) => mockLlmHealth(...args),
    getConfig: vi.fn().mockResolvedValue({}),
    startRuntime: vi.fn().mockResolvedValue({}),
    stopRuntime: vi.fn().mockResolvedValue({}),
    chat: vi.fn().mockResolvedValue(''),
  },
  mcpHandlers: {
    health: (...args) => mockMcpHealth(...args),
    callTool: vi.fn().mockResolvedValue({ status: 'ok', data: { results: [] } }),
    startServer: vi.fn().mockResolvedValue({}),
    stopServer: vi.fn().mockResolvedValue({}),
    getLogs: vi.fn().mockResolvedValue([]),
  },
  wikiHandlers: {
    list: vi.fn().mockResolvedValue({ pages: [] }),
    create: vi.fn().mockResolvedValue({}),
    read: vi.fn().mockResolvedValue({ content: '', tags: [] }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    rename: vi.fn().mockResolvedValue({}),
    rebuildDict: vi.fn().mockResolvedValue({}),
    getSpellcheckDict: vi.fn().mockResolvedValue({}),
    addToDict: vi.fn().mockResolvedValue({}),
  },
  gitHandlers: {
    commit: vi.fn().mockResolvedValue({}),
    getConfig: vi.fn().mockResolvedValue({ remoteUrl: '', branch: 'main' }),
    listChanges: vi.fn().mockResolvedValue([]),
    manualCommit: vi.fn().mockResolvedValue({}),
    push: vi.fn().mockResolvedValue({}),
    saveConfig: vi.fn().mockResolvedValue({}),
    history: vi.fn().mockResolvedValue([]),
    pull: vi.fn().mockResolvedValue({}),
  },
  statsHandlers: {
    wordCount: vi.fn().mockResolvedValue({ wordCount: 0 }),
    manuscriptCount: vi.fn().mockResolvedValue(0),
    todayCount: vi.fn().mockResolvedValue(0),
  },
  exportHandlers: {
    pdf: vi.fn().mockResolvedValue({}),
    validateDeps: vi.fn().mockResolvedValue({}),
    getLogs: vi.fn().mockResolvedValue([]),
  },
  backupHandlers: {
    createSnapshot: vi.fn().mockResolvedValue({}),
    listSnapshots: vi.fn().mockResolvedValue({ snapshots: [] }),
    deleteSnapshot: vi.fn().mockResolvedValue({}),
    restore: vi.fn().mockResolvedValue({}),
  },
  indexHandlers: {
    createNovel: vi.fn().mockResolvedValue({}),
    getIndex: vi.fn().mockResolvedValue({}),
    validateNovel: vi.fn().mockResolvedValue({}),
    rebuildIndex: vi.fn().mockResolvedValue({}),
  },
  chapterHandlers: {
    readChapter: vi.fn().mockResolvedValue({ content: '' }),
    writeChapter: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../../src/hooks/useWikiPages', () => ({
  useWikiPages: vi.fn(() => ({
    pages: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  })),
}));

vi.mock('../../../src/components/Sidebar', () => ({
  default: React.forwardRef((props, ref) => (
    <div data-testid="sidebar-mock">Sidebar</div>
  )),
}));

vi.mock('../../../src/components/Manuscript', () => ({
  default: (props) => <div data-testid="manuscript-mock">Manuscript</div>,
}));

vi.mock('../../../src/components/CommitButton', () => ({
  CommitButton: (props) => <div data-testid="commit-button-mock">Commit</div>,
}));

vi.mock('../../../src/components/PushButton', () => ({
  PushButton: (props) => <div data-testid="push-button-mock">Push</div>,
}));

vi.mock('../../../src/components/ExportDialog', () => ({
  ExportDialog: (props) => <div data-testid="export-dialog-mock">Export</div>,
}));

vi.mock('../../../src/components/SnapshotButton', () => ({
  SnapshotButton: (props) => <div data-testid="snapshot-button-mock">Snapshot</div>,
}));

vi.mock('../../../src/components/DiagnosticsPanel', () => ({
  DiagnosticsPanel: (props) => <div data-testid="diagnostics-panel-mock">Diagnostics</div>,
}));

vi.mock('../../../src/components/Navigation/NovelSelector', () => ({
  NovelSelector: (props) => (
    <div data-testid="novel-selector-mock">
      <button onClick={() => props.onNovelOpened('/tmp/test-novel')}>Open Novel</button>
    </div>
  ),
}));

vi.mock('../../../src/components/LlmChatWindow', () => ({
  LlmChatWindow: (props) => (
    <div data-testid="llm-chat-mock">
      <span>LLM Chat</span>
      <span>novelPath={props.novelPath}</span>
      <span>loading={String(props.servicesLoading)}</span>
    </div>
  ),
}));

import App from '../../../src/App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartNovelServices.mockResolvedValue({
      status: 'ok',
      neo4j: { status: 'running' },
      mcp: { status: 'running' },
      llm: { status: 'running' },
    });
    mockLlmHealth.mockResolvedValue({ status: 'stopped' });
    mockMcpHealth.mockResolvedValue({ status: 'stopped' });
  });

  it('renders novel selector when no novel is loaded', () => {
    render(<App />);
    expect(screen.getByTestId('novel-selector-mock')).toBeInTheDocument();
    expect(screen.getByText('作家')).toBeInTheDocument();
  });

  it('opens novel and starts services', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Open Novel'));
    await waitFor(() => {
      expect(mockStartNovelServices).toHaveBeenCalledWith('/tmp/test-novel');
    });
  });

  it('shows LLM Chat component after novel is loaded', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Open Novel'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-mock')).toBeInTheDocument();
    });
  });

  it('passes novelPath to LlmChatWindow', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Open Novel'));
    await waitFor(() => {
      expect(screen.getByText('novelPath=/tmp/test-novel')).toBeInTheDocument();
    });
  });

  it('passes servicesLoading to LlmChatWindow during startup', async () => {
    mockStartNovelServices.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Open Novel'));
    await waitFor(() => {
      expect(screen.getByText('loading=true')).toBeInTheDocument();
    });
  });

  it('handles service start failure gracefully', async () => {
    mockStartNovelServices.mockRejectedValue(new Error('Neo4j not found'));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Open Novel'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-mock')).toBeInTheDocument();
    });
  });

  it('closes novel and stops services', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Open Novel'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-chat-mock')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('close-novel-button'));
    await waitFor(() => {
      expect(mockStopNovelServices).toHaveBeenCalled();
      expect(screen.getByTestId('novel-selector-mock')).toBeInTheDocument();
    });
  });

  it('shows theme toggle', () => {
    render(<App />);
    expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
  });

  it('toggles theme on click', async () => {
    const user = userEvent.setup();
    render(<App />);
    const btn = screen.getByTestId('theme-toggle-button');
    expect(btn).toHaveTextContent('Dark Mode');
    await user.click(btn);
    expect(btn).toHaveTextContent('Light Mode');
    await user.click(btn);
    expect(btn).toHaveTextContent('Dark Mode');
  });
});
