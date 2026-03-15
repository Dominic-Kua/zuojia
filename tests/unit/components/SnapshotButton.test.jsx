import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SnapshotButton } from '../../../src/components/EditorToolbar/SnapshotButton';

// Mock backupHandlers
vi.mock('../../../src/lib/ipc-client', () => ({
  backupHandlers: {
    createSnapshot: vi.fn(),
    listSnapshots: vi.fn(),
    deleteSnapshot: vi.fn(),
    restore: vi.fn(),
  },
}));

describe('SnapshotButton', () => {
  const novelPath = '/path/to/novel';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a snapshot button', () => {
    render(<SnapshotButton novelPath={novelPath} onToast={vi.fn()} />);
    expect(screen.getByTestId('snapshot-button')).toBeInTheDocument();
  });

  it('opens the snapshot dialog when button is clicked', async () => {
    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} onToast={vi.fn()} />);

    await user.click(screen.getByTestId('snapshot-button'));
    expect(screen.getByTestId('snapshot-dialog')).toBeInTheDocument();
  });

  it('dialog has a label input and submit button', async () => {
    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} onToast={vi.fn()} />);

    await user.click(screen.getByTestId('snapshot-button'));
    expect(screen.getByTestId('snapshot-label-input')).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-cancel-button')).toBeInTheDocument();
  });

  it('closes the dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} onToast={vi.fn()} />);

    await user.click(screen.getByTestId('snapshot-button'));
    expect(screen.getByTestId('snapshot-dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('snapshot-cancel-button'));
    expect(screen.queryByTestId('snapshot-dialog')).not.toBeInTheDocument();
  });

  it('creates a snapshot with a label and calls onToast with success message', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.createSnapshot.mockResolvedValue({
      timestamp: 1700000000000,
      label: 'End of chapter 5',
      path: '/path/meta/backups/1700000000000-End_of_chapter_5',
      size: 2048,
    });

    const onToast = vi.fn();
    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} onToast={onToast} />);

    await user.click(screen.getByTestId('snapshot-button'));
    await user.type(screen.getByTestId('snapshot-label-input'), 'End of chapter 5');
    await user.click(screen.getByTestId('snapshot-submit-button'));

    await waitFor(() => {
      expect(backupHandlers.createSnapshot).toHaveBeenCalledWith(novelPath, 'End of chapter 5');
      expect(onToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('End of chapter 5'), type: 'success' })
      );
    });
  });

  it('creates a snapshot without a label when input is empty', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.createSnapshot.mockResolvedValue({
      timestamp: 1700000000000,
      label: null,
      path: '/path/meta/backups/1700000000000',
      size: 512,
    });

    const onToast = vi.fn();
    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} onToast={onToast} />);

    await user.click(screen.getByTestId('snapshot-button'));
    // No label entered — submit immediately
    await user.click(screen.getByTestId('snapshot-submit-button'));

    await waitFor(() => {
      expect(backupHandlers.createSnapshot).toHaveBeenCalledWith(novelPath, null);
      expect(onToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Snapshot created'), type: 'success' })
      );
    });
  });

  it('closes the dialog after successful snapshot creation', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.createSnapshot.mockResolvedValue({ timestamp: 1700000000000, label: null });

    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} onToast={vi.fn()} />);

    await user.click(screen.getByTestId('snapshot-button'));
    await user.click(screen.getByTestId('snapshot-submit-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('snapshot-dialog')).not.toBeInTheDocument();
    });
  });

  it('calls onToast with error type when IPC fails', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.createSnapshot.mockRejectedValue(new Error('No space left'));

    const onToast = vi.fn();
    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} onToast={onToast} />);

    await user.click(screen.getByTestId('snapshot-button'));
    await user.click(screen.getByTestId('snapshot-submit-button'));

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  it('does not block submission with whitespace-only label (treats it as no label)', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.createSnapshot.mockResolvedValue({ timestamp: 1700000000000, label: null });

    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} onToast={vi.fn()} />);

    await user.click(screen.getByTestId('snapshot-button'));
    await user.type(screen.getByTestId('snapshot-label-input'), '   ');
    await user.click(screen.getByTestId('snapshot-submit-button'));

    await waitFor(() => {
      // Whitespace-only label treated as null
      expect(backupHandlers.createSnapshot).toHaveBeenCalledWith(novelPath, null);
    });
  });
});
