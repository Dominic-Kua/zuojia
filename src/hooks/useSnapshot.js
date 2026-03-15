import { useState, useCallback } from 'react';
import { backupHandlers } from '../lib/ipc-client';

/**
 * Hook for managing snapshot (local backup) operations.
 *
 * @param {string} novelPath - Absolute path to the novel directory
 */
export function useSnapshot(novelPath) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSnapshots = useCallback(async () => {
    if (!novelPath) return;
    setLoading(true);
    setError(null);
    try {
      const data = await backupHandlers.listSnapshots(novelPath);
      setSnapshots(data?.snapshots ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [novelPath]);

  const createSnapshot = useCallback(async (label) => {
    if (!novelPath) return null;
    const trimmedLabel = label?.trim() || null;
    try {
      const result = await backupHandlers.createSnapshot(novelPath, trimmedLabel);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [novelPath]);

  const deleteSnapshot = useCallback(async (timestamp) => {
    if (!novelPath) return null;
    try {
      const result = await backupHandlers.deleteSnapshot(novelPath, timestamp);
      await loadSnapshots();
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [novelPath, loadSnapshots]);

  const restoreSnapshot = useCallback(async (timestamp) => {
    if (!novelPath) return null;
    try {
      const result = await backupHandlers.restore(novelPath, timestamp);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [novelPath]);

  return {
    snapshots,
    loading,
    error,
    loadSnapshots,
    createSnapshot,
    deleteSnapshot,
    restoreSnapshot,
  };
}
