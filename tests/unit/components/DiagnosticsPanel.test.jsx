import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiagnosticsPanel } from '../../../src/components/DiagnosticsPanel';

let consoleErrorSpy;
const originalConsoleError = console.error;

vi.mock('../../../src/lib/ipc-client', () => ({
  exportHandlers: {
    getLogs: vi.fn(),
    validateDeps: vi.fn(),
  },
  backupHandlers: {
    listSnapshots: vi.fn(),
    deleteSnapshot: vi.fn(),
    createSnapshot: vi.fn(),
    restore: vi.fn(),
  },
  indexHandlers: {
    getIndex: vi.fn(),
    rebuildIndex: vi.fn(),
  },
}));

describe('DiagnosticsPanel', () => {
  const novelPath = '/path/to/novel';

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      const [firstArg] = args;
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) return;
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  function setupMocks({ logs = [], snapshots = [], index = null, deps = null } = {}) {
    return import('../../../src/lib/ipc-client').then(({ exportHandlers, backupHandlers, indexHandlers }) => {
      exportHandlers.getLogs.mockResolvedValue(logs);
      exportHandlers.validateDeps.mockResolvedValue(
        deps ?? {
          pandoc: { available: true, version: 'pandoc 3.1' },
          tex: { available: true, engine: 'xelatex', version: 'XeTeX 3.14' },
        }
      );
      backupHandlers.listSnapshots.mockResolvedValue({ snapshots });
      indexHandlers.getIndex.mockResolvedValue(
        index ?? { chapters: [{ filename: 'ch-01.md', title: 'Ch 1' }], wiki: [], lastRebuild: '2026-04-18T10:00:00.000Z' }
      );
      indexHandlers.rebuildIndex.mockResolvedValue({ chapters: [], wiki: [] });
    });
  }

  it('renders the Diagnostics button', () => {
    render(<DiagnosticsPanel novelPath={novelPath} />);
    expect(screen.getByTestId('diagnostics-button')).toBeInTheDocument();
  });

  it('opens the diagnostics dialog on button click', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    expect(screen.getByTestId('diagnostics-dialog')).toBeInTheDocument();
  });

  it('shows index status section with chapter count and last rebuild', async () => {
    await setupMocks({
      index: { chapters: [{ filename: 'ch-01.md', title: 'Ch 1' }, { filename: 'ch-02.md', title: 'Ch 2' }], wiki: [{ slug: 'character' }], lastRebuild: '2026-04-18T10:00:00.000Z' },
    });
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-index-section');
    expect(screen.getByTestId('diagnostics-chapter-count')).toHaveTextContent('2');
    expect(screen.getByTestId('diagnostics-wiki-count')).toHaveTextContent('1');
  });

  it('shows dependency check section with available tools', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-deps-section');
    expect(screen.getByTestId('diagnostics-pandoc-status')).toHaveTextContent(/pandoc/i);
    expect(screen.getByTestId('diagnostics-tex-status')).toHaveTextContent(/xelatex/i);
  });

  it('shows backups list with delete button per entry', async () => {
    await setupMocks({
      snapshots: [
        { timestamp: 1713441600000, label: 'Before edit', size: 2048 },
        { timestamp: 1713528000000, label: null, size: 1024 },
      ],
    });
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-backups-section');
    expect(screen.getByText('Before edit')).toBeInTheDocument();
    expect(screen.getAllByTestId(/diagnostics-delete-backup-/)).toHaveLength(2);
  });

  it('deletes a backup when delete button clicked', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    await setupMocks({
      snapshots: [{ timestamp: 1713441600000, label: 'Draft', size: 512 }],
    });
    backupHandlers.deleteSnapshot.mockResolvedValue(undefined);
    backupHandlers.listSnapshots
      .mockResolvedValueOnce({ snapshots: [{ timestamp: 1713441600000, label: 'Draft', size: 512 }] })
      .mockResolvedValueOnce({ snapshots: [] });

    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-delete-backup-1713441600000');
    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-delete-backup-1713441600000'));
    });

    await waitFor(() => {
      expect(backupHandlers.deleteSnapshot).toHaveBeenCalledWith(novelPath, 1713441600000);
    });
  });

  it('shows "No backups yet" when snapshot list is empty', async () => {
    await setupMocks({ snapshots: [] });
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-backups-section');
    expect(screen.getByText(/no backups yet/i)).toBeInTheDocument();
  });

  it('shows export logs section', async () => {
    await setupMocks({
      logs: [{ filename: 'export-2026-04-18T12-00-00-000Z.log', content: 'exitCode: 0' }],
    });
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-logs-section');
    expect(screen.getByText('export-2026-04-18T12-00-00-000Z.log')).toBeInTheDocument();
  });

  it('shows "No export logs yet" when log list is empty', async () => {
    await setupMocks({ logs: [] });
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-logs-section');
    expect(screen.getByText(/no export logs yet/i)).toBeInTheDocument();
  });

  it('triggers rebuild index and calls onIndexRebuilt callback', async () => {
    const { indexHandlers } = await import('../../../src/lib/ipc-client');
    await setupMocks();
    const onIndexRebuilt = vi.fn();

    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} onIndexRebuilt={onIndexRebuilt} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-index-section');
    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-rebuild-index-button'));
    });

    await waitFor(() => {
      expect(indexHandlers.rebuildIndex).toHaveBeenCalledWith(novelPath);
      expect(onIndexRebuilt).toHaveBeenCalled();
    });
  });

  it('shows a Restore button per backup entry', async () => {
    await setupMocks({
      snapshots: [{ timestamp: 1713441600000, label: 'Before edit', size: 2048 }],
    });
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-backups-section');
    expect(screen.getByTestId('diagnostics-restore-backup-1713441600000')).toBeInTheDocument();
  });

  it('shows pre-backup confirmation dialog when Restore clicked', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    await setupMocks({
      snapshots: [{ timestamp: 1713441600000, label: 'Before edit', size: 2048 }],
    });
    backupHandlers.restore.mockResolvedValue({ timestamp: 1713441600000, restored: true });

    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-restore-backup-1713441600000');
    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-restore-backup-1713441600000'));
    });

    expect(screen.getByTestId('restore-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/create backup first/i)).toBeInTheDocument();
  });

  it('creates a safety snapshot then restores when "Yes" clicked', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    await setupMocks({
      snapshots: [{ timestamp: 1713441600000, label: 'Before edit', size: 2048 }],
    });
    backupHandlers.createSnapshot.mockResolvedValue({ timestamp: Date.now() });
    backupHandlers.restore.mockResolvedValue({ timestamp: 1713441600000, restored: true });
    backupHandlers.listSnapshots
      .mockResolvedValueOnce({ snapshots: [{ timestamp: 1713441600000, label: 'Before edit', size: 2048 }] })
      .mockResolvedValueOnce({ snapshots: [] });
    const onIndexRebuilt = vi.fn();
    const onRestored = vi.fn();

    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} onIndexRebuilt={onIndexRebuilt} onRestored={onRestored} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-restore-backup-1713441600000');
    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-restore-backup-1713441600000'));
    });

    await screen.findByTestId('restore-confirm-dialog');
    await act(async () => {
      await user.click(screen.getByTestId('restore-confirm-yes'));
    });

    await waitFor(() => {
      expect(backupHandlers.createSnapshot).toHaveBeenCalledWith(novelPath, 'pre-restore safety backup');
      expect(backupHandlers.restore).toHaveBeenCalledWith(novelPath, 1713441600000);
      expect(onIndexRebuilt).toHaveBeenCalled();
      expect(onRestored).toHaveBeenCalled();
    });

    expect(screen.getByTestId('restore-toast')).toBeInTheDocument();
  });

  it('restores without pre-backup when "No" clicked', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    await setupMocks({
      snapshots: [{ timestamp: 1713441600000, label: 'Draft v1', size: 1024 }],
    });
    backupHandlers.restore.mockResolvedValue({ timestamp: 1713441600000, restored: true });
    backupHandlers.listSnapshots
      .mockResolvedValueOnce({ snapshots: [{ timestamp: 1713441600000, label: 'Draft v1', size: 1024 }] })
      .mockResolvedValueOnce({ snapshots: [] });

    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-restore-backup-1713441600000');
    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-restore-backup-1713441600000'));
    });

    await screen.findByTestId('restore-confirm-dialog');
    await act(async () => {
      await user.click(screen.getByTestId('restore-confirm-no'));
    });

    await waitFor(() => {
      expect(backupHandlers.createSnapshot).not.toHaveBeenCalled();
      expect(backupHandlers.restore).toHaveBeenCalledWith(novelPath, 1713441600000);
    });
  });

  it('dismisses restore confirmation when Cancel clicked', async () => {
    await setupMocks({
      snapshots: [{ timestamp: 1713441600000, label: 'Test', size: 512 }],
    });

    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-restore-backup-1713441600000');
    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-restore-backup-1713441600000'));
    });

    await screen.findByTestId('restore-confirm-dialog');
    await act(async () => {
      await user.click(screen.getByTestId('restore-confirm-cancel'));
    });

    expect(screen.queryByTestId('restore-confirm-dialog')).not.toBeInTheDocument();
  });

  it('dismisses restore confirmation when backdrop is clicked', async () => {
    await setupMocks({
      snapshots: [{ timestamp: 1713441600000, label: 'Test', size: 512 }],
    });

    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-restore-backup-1713441600000');
    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-restore-backup-1713441600000'));
    });

    await screen.findByTestId('restore-confirm-dialog');
    await act(async () => {
      await user.click(screen.getByTestId('restore-confirm-overlay'));
    });

    expect(screen.queryByTestId('restore-confirm-dialog')).not.toBeInTheDocument();
  });

  it('dispatches zuojia:wiki-dictionary-updated after a successful restore', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    await setupMocks({
      snapshots: [{ timestamp: 1713441600000, label: 'Before edit', size: 2048 }],
    });
    backupHandlers.restore.mockResolvedValue({ timestamp: 1713441600000, restored: true });
    backupHandlers.listSnapshots
      .mockResolvedValueOnce({ snapshots: [{ timestamp: 1713441600000, label: 'Before edit', size: 2048 }] })
      .mockResolvedValueOnce({ snapshots: [] });

    const dispatchedEvents = [];
    const listener = (e) => dispatchedEvents.push(e);
    window.addEventListener('zuojia:wiki-dictionary-updated', listener);

    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath={novelPath} />);

    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-button'));
    });

    await screen.findByTestId('diagnostics-restore-backup-1713441600000');
    await act(async () => {
      await user.click(screen.getByTestId('diagnostics-restore-backup-1713441600000'));
    });

    await screen.findByTestId('restore-confirm-dialog');
    await act(async () => {
      await user.click(screen.getByTestId('restore-confirm-no'));
    });

    await waitFor(() => {
      expect(dispatchedEvents).toHaveLength(1);
      expect(dispatchedEvents[0].detail.novelPath).toBe(novelPath);
    });

    window.removeEventListener('zuojia:wiki-dictionary-updated', listener);
  });
});
