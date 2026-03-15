import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SnapshotManager } from '../../../src/components/EditorToolbar/SnapshotManager';

vi.mock('../../../src/lib/ipc-client', () => ({
  backupHandlers: {
    createSnapshot: vi.fn(),
    listSnapshots: vi.fn(),
    deleteSnapshot: vi.fn(),
    restore: vi.fn(),
  },
}));

const makeSnap = (overrides = {}) => ({
  timestamp: 1700000000000,
  label: 'Chapter 5 done',
  size: 4096,
  created: '2023-11-14T22:13:20.000Z',
  ...overrides,
});

describe('SnapshotManager', () => {
  const novelPath = '/path/to/novel';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the snapshot manager panel', () => {
    render(<SnapshotManager novelPath={novelPath} onClose={vi.fn()} onToast={vi.fn()} />);
    expect(screen.getByTestId('snapshot-manager')).toBeInTheDocument();
  });

  it('shows a loading indicator while fetching snapshots', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.listSnapshots.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    render(<SnapshotManager novelPath={novelPath} onClose={vi.fn()} onToast={vi.fn()} />);
    expect(screen.getByTestId('snapshot-manager-loading')).toBeInTheDocument();
  });

  it('renders snapshot entries with timestamp, label, and size', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.listSnapshots.mockResolvedValue({
      snapshots: [makeSnap()],
    });

    render(<SnapshotManager novelPath={novelPath} onClose={vi.fn()} onToast={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-entry-1700000000000')).toBeInTheDocument();
      expect(screen.getByTestId('snapshot-entry-1700000000000')).toHaveTextContent('Chapter 5 done');
    });
  });

  it('shows empty state when no snapshots exist', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.listSnapshots.mockResolvedValue({ snapshots: [] });

    render(<SnapshotManager novelPath={novelPath} onClose={vi.fn()} onToast={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-manager-empty')).toBeInTheDocument();
    });
  });

  it('deletes a snapshot and refreshes the list', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.listSnapshots
      .mockResolvedValueOnce({ snapshots: [makeSnap()] })
      .mockResolvedValueOnce({ snapshots: [] });
    backupHandlers.deleteSnapshot.mockResolvedValue({ deleted: true });

    const user = userEvent.setup();
    render(<SnapshotManager novelPath={novelPath} onClose={vi.fn()} onToast={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-entry-1700000000000')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('snapshot-delete-1700000000000'));

    await waitFor(() => {
      expect(backupHandlers.deleteSnapshot).toHaveBeenCalledWith(novelPath, 1700000000000);
      expect(screen.getByTestId('snapshot-manager-empty')).toBeInTheDocument();
    });
  });

  it('restores a snapshot and calls onToast with success', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.listSnapshots.mockResolvedValue({ snapshots: [makeSnap()] });
    backupHandlers.restore.mockResolvedValue({ restored: true });

    const onToast = vi.fn();
    const user = userEvent.setup();
    render(<SnapshotManager novelPath={novelPath} onClose={vi.fn()} onToast={onToast} />);

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-restore-1700000000000')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('snapshot-restore-1700000000000'));

    await waitFor(() => {
      expect(backupHandlers.restore).toHaveBeenCalledWith(novelPath, 1700000000000);
      expect(onToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      );
    });
  });

  it('calls onToast with error when restore fails', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.listSnapshots.mockResolvedValue({ snapshots: [makeSnap()] });
    backupHandlers.restore.mockRejectedValue(new Error('Restore failed'));

    const onToast = vi.fn();
    const user = userEvent.setup();
    render(<SnapshotManager novelPath={novelPath} onClose={vi.fn()} onToast={onToast} />);

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-restore-1700000000000')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('snapshot-restore-1700000000000'));

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.listSnapshots.mockResolvedValue({ snapshots: [] });

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SnapshotManager novelPath={novelPath} onClose={onClose} onToast={vi.fn()} />);

    await waitFor(() => screen.getByTestId('snapshot-manager-close'));
    await user.click(screen.getByTestId('snapshot-manager-close'));

    expect(onClose).toHaveBeenCalled();
  });
});
