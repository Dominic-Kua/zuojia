import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SnapshotButton } from '../../../src/components/SnapshotButton';

vi.mock('../../../src/lib/ipc-client', () => ({
  backupHandlers: {
    createSnapshot: vi.fn(),
  },
}));

describe('SnapshotButton', () => {
  const novelPath = '/path/to/novel';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Snapshot button', () => {
    render(<SnapshotButton novelPath={novelPath} />);
    expect(screen.getByTestId('snapshot-button')).toBeInTheDocument();
    expect(screen.getByText('Snapshot')).toBeInTheDocument();
  });

  it('opens the label dialog when clicked', async () => {
    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} />);

    await user.click(screen.getByTestId('snapshot-button'));

    expect(screen.getByTestId('snapshot-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-label-input')).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-cancel')).toBeInTheDocument();
  });

  it('closes the dialog on cancel', async () => {
    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} />);

    await user.click(screen.getByTestId('snapshot-button'));
    expect(screen.getByTestId('snapshot-dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('snapshot-cancel'));
    expect(screen.queryByTestId('snapshot-dialog')).not.toBeInTheDocument();
  });

  it('calls createSnapshot with label on confirm', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.createSnapshot.mockResolvedValue({
      timestamp: 1234567890,
      label: 'End of Chapter 5',
      path: '/path/to/backup',
      files: 10,
      size: 5000,
    });

    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} />);

    await user.click(screen.getByTestId('snapshot-button'));
    await user.type(screen.getByTestId('snapshot-label-input'), 'End of Chapter 5');
    await user.click(screen.getByTestId('snapshot-confirm'));

    expect(backupHandlers.createSnapshot).toHaveBeenCalledWith(novelPath, 'End of Chapter 5');
  });

  it('calls createSnapshot with empty label when none provided', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.createSnapshot.mockResolvedValue({
      timestamp: 1234567890,
      label: null,
      path: '/path/to/backup',
      files: 10,
      size: 5000,
    });

    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} />);

    await user.click(screen.getByTestId('snapshot-button'));
    await user.click(screen.getByTestId('snapshot-confirm'));

    expect(backupHandlers.createSnapshot).toHaveBeenCalledWith(novelPath, null);
  });

  it('shows success toast after snapshot creation', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.createSnapshot.mockResolvedValue({
      timestamp: 1234567890,
      label: 'My snapshot',
      path: '/path/to/backup',
      files: 10,
      size: 5000,
    });

    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} />);

    await user.click(screen.getByTestId('snapshot-button'));
    await user.type(screen.getByTestId('snapshot-label-input'), 'My snapshot');
    await user.click(screen.getByTestId('snapshot-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-toast')).toBeInTheDocument();
      expect(screen.getByTestId('snapshot-toast')).toHaveTextContent('Snapshot created');
    });
  });

  it('closes dialog after successful snapshot', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.createSnapshot.mockResolvedValue({
      timestamp: 1234567890,
      label: null,
      path: '/path/to/backup',
      files: 10,
      size: 5000,
    });

    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} />);

    await user.click(screen.getByTestId('snapshot-button'));
    await user.click(screen.getByTestId('snapshot-confirm'));

    await waitFor(() => {
      expect(screen.queryByTestId('snapshot-dialog')).not.toBeInTheDocument();
    });
  });

  it('shows error message when snapshot fails', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    backupHandlers.createSnapshot.mockRejectedValue(new Error('Disk full'));

    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} />);

    await user.click(screen.getByTestId('snapshot-button'));
    await user.click(screen.getByTestId('snapshot-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('snapshot-error')).toBeInTheDocument();
      expect(screen.getByTestId('snapshot-error')).toHaveTextContent('Disk full');
    });
  });

  it('disables confirm button while creating snapshot', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    let resolveSnapshot;
    backupHandlers.createSnapshot.mockReturnValue(
      new Promise((resolve) => { resolveSnapshot = resolve; })
    );

    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} />);

    await user.click(screen.getByTestId('snapshot-button'));
    await user.click(screen.getByTestId('snapshot-confirm'));

    expect(screen.getByTestId('snapshot-confirm')).toBeDisabled();

    resolveSnapshot({ timestamp: 123, label: null, path: '/x', files: 1, size: 100 });

    await waitFor(() => {
      expect(screen.queryByTestId('snapshot-dialog')).not.toBeInTheDocument();
    });
  });

  it('does not render when novelPath is null', () => {
    render(<SnapshotButton novelPath={null} />);
    expect(screen.queryByTestId('snapshot-button')).not.toBeInTheDocument();
  });

  it('closes the dialog when clicking the overlay backdrop', async () => {
    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} />);

    await user.click(screen.getByTestId('snapshot-button'));

    const dialog = screen.getByTestId('snapshot-dialog');
    expect(dialog).toBeInTheDocument();

    // Clicking inside the dialog should not close it
    await user.click(dialog);
    expect(screen.getByTestId('snapshot-dialog')).toBeInTheDocument();

    // Clicking the overlay/backdrop should close it
    const overlay = screen.getByTestId('snapshot-overlay');
    await user.click(overlay);
    expect(screen.queryByTestId('snapshot-dialog')).not.toBeInTheDocument();
  });

  it('closes the dialog on Escape key', async () => {
    const user = userEvent.setup();
    render(<SnapshotButton novelPath={novelPath} />);

    await user.click(screen.getByTestId('snapshot-button'));
    expect(screen.getByTestId('snapshot-dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('snapshot-dialog')).not.toBeInTheDocument();
  });
});
