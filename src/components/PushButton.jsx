import React, { useEffect, useState } from 'react';
import { gitHandlers } from '../lib/ipc-client';

export function PushButton({ novelPath }) {
  const [isPushing, setIsPushing] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!novelPath) {
    return null;
  }

  const handlePush = async () => {
    if (isPushing) {
      return;
    }

    setIsPushing(true);
    setError(null);
    try {
      const result = await gitHandlers.push(novelPath);
      const pushedCommits = Number(result.pushedCommits || 0);
      setToast(`Pushed ${pushedCommits} commits to ${result.branch}`);
    } catch (err) {
      setError({
        message: err.message || 'Push failed',
        suggestion: err.suggestion || 'Check your git remote configuration and SSH agent.',
      });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <>
      <button className="btn primary" data-testid="push-button" onClick={handlePush} disabled={isPushing}>
        {isPushing ? 'Pushing...' : 'Push'}
      </button>

      {toast && <div className="snapshot-toast" data-testid="push-toast">{toast}</div>}

      {error && (
        <div className="snapshot-overlay" data-testid="push-error-overlay" onClick={() => setError(null)}>
          <div
            className="snapshot-dialog"
            data-testid="push-error-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-error-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="push-error-title">Push Failed</h3>
            <p>{error.message}</p>
            <div className="push-guidance">{error.suggestion}</div>
            <div className="snapshot-dialog-actions">
              <button className="btn primary" data-testid="push-error-close" onClick={() => setError(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}