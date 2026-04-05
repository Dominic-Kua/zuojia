import { useCallback, useEffect, useState } from 'react';
import { gitHandlers } from '../lib/ipc-client';

export function useGitHistory(novelPath, limit = 5) {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    if (!novelPath) {
      setCommits([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await gitHandlers.history(novelPath, limit);
      setCommits(result.commits || []);
    } catch (err) {
      setError(err.message || 'Failed to load git history');
    } finally {
      setLoading(false);
    }
  }, [limit, novelPath]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const handleUpdated = (event) => {
      if (event.detail?.novelPath && event.detail.novelPath !== novelPath) {
        return;
      }
      loadHistory();
    };

    window.addEventListener('zuojia:git-history-updated', handleUpdated);
    return () => window.removeEventListener('zuojia:git-history-updated', handleUpdated);
  }, [loadHistory, novelPath]);

  return {
    commits,
    loading,
    error,
    reload: loadHistory,
  };
}
