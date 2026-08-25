import React, { useEffect, useMemo, useState } from 'react';
import { gitHandlers } from '../lib/ipc-client';

export function CommitButton({ novelPath }) {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const hasFiles = files.length > 0;
  const canCommit = !isCommitting && hasFiles && selectedFiles.length > 0 && message.trim().length > 0;

  const selectedSet = useMemo(() => new Set(selectedFiles), [selectedFiles]);

  useEffect(() => {
    if (!showDialog) {
      return undefined;
    }

    let cancelled = false;

    const loadChanges = async () => {
      setIsLoading(true);
      try {
        const result = await gitHandlers.listChanges(novelPath);
        if (cancelled) {
          return;
        }
        const nextFiles = result.files || [];
        setFiles(nextFiles);
        setSelectedFiles(nextFiles);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setFiles([]);
        setSelectedFiles([]);
        setError(err.message || 'Failed to load changed files');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadChanges();

    return () => {
      cancelled = true;
    };
  }, [novelPath, showDialog]);

  if (!novelPath) {
    return null;
  }

  const closeDialog = () => {
    if (isCommitting) {
      return;
    }
    setShowDialog(false);
    setError(null);
    setMessage('');
    setFiles([]);
    setSelectedFiles([]);
    setIsLoading(false);
  };

  const openDialog = () => {
    setShowDialog(true);
    setError(null);
    setMessage('');
  };

  const toggleFile = (file) => {
    setSelectedFiles((current) => (
      current.includes(file)
        ? current.filter((entry) => entry !== file)
        : [...current, file]
    ));
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    setError(null);
    try {
      const result = await gitHandlers.manualCommit(novelPath, selectedFiles, message.trim());
      setToast(`Committed ${result.hash}: ${result.message}`);
      setShowDialog(false);
      setMessage('');
      window.dispatchEvent(new CustomEvent('zuojia:git-history-updated', {
        detail: { novelPath },
      }));
    } catch (err) {
      setError(err.message || 'Failed to create commit');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <>
      <button className="btn ghost" data-testid="commit-button" onClick={openDialog}>
        Commit
      </button>

      {showDialog && (
        <div className="snapshot-overlay" data-testid="commit-overlay" onClick={closeDialog}>
          <div
            className="snapshot-dialog commit-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="commit-dialog-title"
            data-testid="commit-dialog"
          >
            <h3 id="commit-dialog-title">Create Commit</h3>
            <p>Select the changed chapters to include and write a meaningful commit message.</p>
            {isLoading && <div className="commit-loading">Loading changed chapters...</div>}
            {!isLoading && error && <div className="snapshot-error" data-testid="commit-error">{error}</div>}
            {!isLoading && !error && !hasFiles && (
              <div className="commit-empty-state" data-testid="commit-empty-state">No changed chapters to commit.</div>
            )}
            {!isLoading && hasFiles && (
              <div className="commit-file-list" data-testid="commit-file-list">
                {files.map((file) => (
                  <label key={file} className="commit-file-option">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(file)}
                      onChange={() => toggleFile(file)}
                    />
                    <span>{file}</span>
                  </label>
                ))}
              </div>
            )}
            <textarea
              className="commit-message-input"
              data-testid="commit-message-input"
              placeholder="Commit message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              disabled={isLoading || isCommitting || !hasFiles}
            />
            <div className="snapshot-dialog-actions">
              <button className="btn ghost" data-testid="commit-cancel" onClick={closeDialog} disabled={isCommitting}>
                Cancel
              </button>
              <button className="btn primary" data-testid="commit-confirm" onClick={handleCommit} disabled={!canCommit}>
                {isCommitting ? 'Committing...' : 'Create Commit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="snapshot-toast" data-testid="commit-toast">{toast}</div>}
    </>
  );
}
