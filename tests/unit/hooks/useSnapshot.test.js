import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSnapshot } from '../../../src/hooks/useSnapshot';

// Mock the IPC client
vi.mock('../../../src/lib/ipc-client', () => ({
  backupHandlers: {
    createSnapshot: vi.fn(),
    listSnapshots: vi.fn(),
    deleteSnapshot: vi.fn(),
    restore: vi.fn(),
  },
}));

const mockSnapshot = (overrides = {}) => ({
  timestamp: 1700000000000,
  label: 'Test snapshot',
  size: 1024,
  created: '2023-11-14T22:13:20.000Z',
  path: '/novels/test/meta/backups/1700000000000-Test_snapshot',
  ...overrides,
});

describe('useSnapshot', () => {
  const novelPath = '/path/to/novel';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty list, no loading, and no error', () => {
    const { result } = renderHook(() => useSnapshot(novelPath));
    expect(result.current.snapshots).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not auto-load snapshots on mount (load is explicit)', async () => {
    const { backupHandlers } = await import('../../../src/lib/ipc-client');
    renderHook(() => useSnapshot(novelPath));
    expect(backupHandlers.listSnapshots).not.toHaveBeenCalled();
  });

  describe('createSnapshot', () => {
    it('calls backupHandlers.createSnapshot with novelPath and label', async () => {
      const { backupHandlers } = await import('../../../src/lib/ipc-client');
      backupHandlers.createSnapshot.mockResolvedValue({ timestamp: 1700000000000, label: 'Before edit' });

      const { result } = renderHook(() => useSnapshot(novelPath));
      let snapshotResult;
      await act(async () => {
        snapshotResult = await result.current.createSnapshot('Before edit');
      });

      expect(backupHandlers.createSnapshot).toHaveBeenCalledWith(novelPath, 'Before edit');
      expect(snapshotResult.timestamp).toBe(1700000000000);
    });

    it('creates a snapshot with no label (null)', async () => {
      const { backupHandlers } = await import('../../../src/lib/ipc-client');
      backupHandlers.createSnapshot.mockResolvedValue({ timestamp: 1700000000001, label: null });

      const { result } = renderHook(() => useSnapshot(novelPath));
      await act(async () => {
        await result.current.createSnapshot(null);
      });

      expect(backupHandlers.createSnapshot).toHaveBeenCalledWith(novelPath, null);
    });

    it('returns null and sets error when createSnapshot fails', async () => {
      const { backupHandlers } = await import('../../../src/lib/ipc-client');
      backupHandlers.createSnapshot.mockRejectedValue(new Error('Disk full'));

      const { result } = renderHook(() => useSnapshot(novelPath));
      let snapshotResult;
      await act(async () => {
        snapshotResult = await result.current.createSnapshot('test');
      });

      expect(snapshotResult).toBeNull();
      expect(result.current.error).toBe('Disk full');
    });
  });

  describe('loadSnapshots', () => {
    it('loads and stores snapshots sorted newest-first', async () => {
      const { backupHandlers } = await import('../../../src/lib/ipc-client');
      const snaps = [
        mockSnapshot({ timestamp: 1700000000002 }),
        mockSnapshot({ timestamp: 1700000000001 }),
      ];
      backupHandlers.listSnapshots.mockResolvedValue({ snapshots: snaps });

      const { result } = renderHook(() => useSnapshot(novelPath));
      await act(async () => {
        await result.current.loadSnapshots();
      });

      expect(result.current.snapshots).toEqual(snaps);
      expect(result.current.loading).toBe(false);
    });

    it('sets error when listSnapshots fails', async () => {
      const { backupHandlers } = await import('../../../src/lib/ipc-client');
      backupHandlers.listSnapshots.mockRejectedValue(new Error('Permission denied'));

      const { result } = renderHook(() => useSnapshot(novelPath));
      await act(async () => {
        await result.current.loadSnapshots();
      });

      expect(result.current.error).toBe('Permission denied');
      expect(result.current.snapshots).toEqual([]);
    });
  });

  describe('deleteSnapshot', () => {
    it('calls backupHandlers.deleteSnapshot and reloads list', async () => {
      const { backupHandlers } = await import('../../../src/lib/ipc-client');
      backupHandlers.deleteSnapshot.mockResolvedValue({ deleted: true });
      backupHandlers.listSnapshots.mockResolvedValue({ snapshots: [] });

      const { result } = renderHook(() => useSnapshot(novelPath));
      await act(async () => {
        await result.current.deleteSnapshot(1700000000000);
      });

      expect(backupHandlers.deleteSnapshot).toHaveBeenCalledWith(novelPath, 1700000000000);
      expect(backupHandlers.listSnapshots).toHaveBeenCalled();
    });
  });

  describe('restoreSnapshot', () => {
    it('calls backupHandlers.restore with correct args', async () => {
      const { backupHandlers } = await import('../../../src/lib/ipc-client');
      backupHandlers.restore.mockResolvedValue({ restored: true });

      const { result } = renderHook(() => useSnapshot(novelPath));
      let restoreResult;
      await act(async () => {
        restoreResult = await result.current.restoreSnapshot(1700000000000);
      });

      expect(backupHandlers.restore).toHaveBeenCalledWith(novelPath, 1700000000000);
      expect(restoreResult.restored).toBe(true);
    });

    it('returns null and sets error when restore fails', async () => {
      const { backupHandlers } = await import('../../../src/lib/ipc-client');
      backupHandlers.restore.mockRejectedValue(new Error('Snapshot corrupt'));

      const { result } = renderHook(() => useSnapshot(novelPath));
      let restoreResult;
      await act(async () => {
        restoreResult = await result.current.restoreSnapshot(1700000000000);
      });

      expect(restoreResult).toBeNull();
      expect(result.current.error).toBe('Snapshot corrupt');
    });
  });
});
