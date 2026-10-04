import React, { useEffect, useState } from 'react';
import { gitHandlers } from '../lib/ipc-client';

export function PushButton({ novelPath }) {
  const [isPushing, setIsPushing] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

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

  const runPush = async (confirmRemote = false) => {
    const result = await gitHandlers.push(novelPath, { confirmRemote });
    const pushedCommits = Number(result.pushedCommits || 0);
    setToast(`Pushed ${pushedCommits} commits to ${result.branch}`);
  };

  const handlePush = async () => {
    if (isPushing) {
      return;
    }

    setIsPushing(true);
    setError(null);
    try {
      await runPush(false);
    } catch (err) {
      // First push to an unconfirmed remote stops server-side so the user
      // sees exactly where their novel is about to go before anything moves.
      if (err.code === 'REMOTE_UNCONFIRMED') {
        setConfirmTarget({
          remoteUrl: err.context?.remoteUrl || '(unknown remote)',
          branch: err.context?.branch || '(unknown branch)',
        });
        return;
      }
      setError({
        message: err.message || 'Push failed',
        suggestion:
          err.suggestion ||
          (err.code === 'REMOTE_NOT_CONFIGURED'
            ? 'No git remote found. Open Settings → Git Settings and enter a Remote URL, or run: git remote add origin <url>.'
            : 'Check your git remote configuration and SSH agent. An existing checkout with an upstream is used automatically.'),
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleConfirmPush = async () => {
    setConfirmTarget(null);
    setIsPushing(true);
    setError(null);
    try {
      await runPush(true);
    } catch (err) {
      setError({
        message: err.message || 'Push failed',
        suggestion:
          err.suggestion ||
          'Check your git remote configuration and SSH agent. An existing checkout with an upstream is used automatically.',
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

      {confirmTarget && (
        <div className="snapshot-overlay" data-testid="push-confirm-overlay" onClick={() => setConfirmTarget(null)}>
          <div
            className="snapshot-dialog"
            data-testid="push-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="push-confirm-title">Confirm push destination</h3>
            <p>This remote has not been confirmed for this novel yet.</p>
            <p data-testid="push-confirm-remote">
              Push to <strong>{confirmTarget.remoteUrl}</strong> on branch <strong>{confirmTarget.branch}</strong>?
            </p>
            <div className="snapshot-dialog-actions">
              <button className="btn" data-testid="push-confirm-cancel" onClick={() => setConfirmTarget(null)}>
                Cancel
              </button>
              <button className="btn primary" data-testid="push-confirm-approve" onClick={handleConfirmPush}>
                Push here
              </button>
            </div>
          </div>
        </div>
      )}

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