import React, { useState, useEffect } from 'react';
import { backupHandlers } from '../lib/ipc-client';

export function SnapshotButton({ novelPath }) {
  const [showDialog, setShowDialog] = useState(false);
  const [label, setLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!novelPath) return null;

  const handleOpen = () => {
    setLabel('');
    setError(null);
    setShowDialog(true);
  };

  const handleCancel = () => {
    setShowDialog(false);
    setLabel('');
    setError(null);
  };

  const handleConfirm = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const result = await backupHandlers.createSnapshot(novelPath, label);
      const displayLabel = result.label || new Date(result.timestamp).toLocaleString();
      setToast(`Snapshot created: ${displayLabel}`);
      setShowDialog(false);
      setLabel('');
    } catch (err) {
      setError(err.message || 'Snapshot failed');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <button
        className="btn ghost"
        data-testid="snapshot-button"
        onClick={handleOpen}
      >
        Snapshot
      </button>

      {showDialog && (
        <div className="snapshot-overlay" data-testid="snapshot-dialog" onClick={handleCancel}>
          <div className="snapshot-dialog" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') handleCancel(); }}>
            <h3>Create Snapshot</h3>
            <p>Save a local backup of your current manuscript state.</p>
            <input
              type="text"
              data-testid="snapshot-label-input"
              className="snapshot-label-input"
              placeholder="Label (optional, e.g. End of Chapter 5)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isCreating) handleConfirm(); }}
              autoFocus
            />
            {error && (
              <div className="snapshot-error" data-testid="snapshot-error">{error}</div>
            )}
            <div className="snapshot-dialog-actions">
              <button
                className="btn ghost"
                data-testid="snapshot-cancel"
                onClick={handleCancel}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                data-testid="snapshot-confirm"
                onClick={handleConfirm}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="snapshot-toast" data-testid="snapshot-toast">{toast}</div>
      )}
    </>
  );
}
