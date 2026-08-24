/**
 * Tests for DiagnosticsPanel component
 * Covers backup management, index info, and dependency validation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockListSnapshots = vi.fn();
const mockDeleteSnapshot = vi.fn();
const mockRestoreSnapshot = vi.fn();
const mockGetLogs = vi.fn();
const mockGetIndex = vi.fn();
const mockValidateDeps = vi.fn();
const mockRebuildIndex = vi.fn();

vi.mock('../../../src/lib/ipc-client', () => ({
  backupHandlers: {
    listSnapshots: (...args) => mockListSnapshots(...args),
    deleteSnapshot: (...args) => mockDeleteSnapshot(...args),
    restore: (...args) => mockRestoreSnapshot(...args),
    createSnapshot: vi.fn().mockResolvedValue({}),
  },
  exportHandlers: {
    getLogs: (...args) => mockGetLogs(...args),
    validateDeps: (...args) => mockValidateDeps(...args),
    pdf: vi.fn().mockResolvedValue({}),
  },
  indexHandlers: {
    getIndex: (...args) => mockGetIndex(...args),
    rebuildIndex: (...args) => mockRebuildIndex(...args),
    validateNovel: vi.fn().mockResolvedValue({}),
    createNovel: vi.fn().mockResolvedValue({}),
  },
}));

import { DiagnosticsPanel } from '../../../src/components/DiagnosticsPanel';

describe('DiagnosticsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSnapshots.mockResolvedValue({ snapshots: [] });
    mockGetLogs.mockResolvedValue([]);
    mockGetIndex.mockResolvedValue({ chapters: [] });
    mockValidateDeps.mockResolvedValue({ pandoc: true, texlive: true });
  });

  it('returns null when novelPath is not set', () => {
    const { container } = render(<DiagnosticsPanel novelPath={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows Diagnostics button', () => {
    render(<DiagnosticsPanel novelPath="/tmp/novel" />);
    expect(screen.getByText('Diagnostics')).toBeInTheDocument();
  });

  it('opens dialog on click', async () => {
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath="/tmp/novel" />);
    await user.click(screen.getByText('Diagnostics'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('loads and displays snapshots', async () => {
    mockListSnapshots.mockResolvedValue({
      snapshots: [
        { timestamp: '2024-01-15T10:30:00Z', label: 'Before edit', fileCount: 5 },
        { timestamp: '2024-01-14T15:45:00Z', label: null, fileCount: 3 },
      ],
    });
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath="/tmp/novel" />);
    await user.click(screen.getByText('Diagnostics'));
    await waitFor(() => {
      expect(screen.getByText('Before edit')).toBeInTheDocument();
    });
  });

  it('loads and displays export logs', async () => {
    mockGetLogs.mockResolvedValue([
      { filename: 'pdf_export_2024.txt', content: 'Export completed successfully' },
    ]);
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath="/tmp/novel" />);
    await user.click(screen.getByText('Diagnostics'));
    await waitFor(() => {
      expect(screen.getByText(/pdf_export/)).toBeInTheDocument();
    });
  });

  it('shows dependency validation results', async () => {
    mockValidateDeps.mockResolvedValue({ pandoc: true, texlive: false });
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath="/tmp/novel" />);
    await user.click(screen.getByText('Diagnostics'));
    await waitFor(() => {
      expect(screen.getByTestId('diagnostics-pandoc-status')).toBeInTheDocument();
      expect(screen.getByTestId('diagnostics-tex-status')).toBeInTheDocument();
    });
  });

  it('shows empty state when no snapshots', async () => {
    mockListSnapshots.mockResolvedValue({ snapshots: [] });
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath="/tmp/novel" />);
    await user.click(screen.getByText('Diagnostics'));
    await waitFor(() => {
      expect(screen.getByText(/No backups yet/i)).toBeInTheDocument();
    });
  });

  it('handles listSnapshots failure gracefully', async () => {
    mockListSnapshots.mockRejectedValue(new Error('IPC error'));
    const user = userEvent.setup();
    render(<DiagnosticsPanel novelPath="/tmp/novel" />);
    await user.click(screen.getByText('Diagnostics'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
