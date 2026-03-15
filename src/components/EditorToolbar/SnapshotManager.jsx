import React, { useEffect, useCallback } from 'react';
import { useSnapshot } from '../../hooks/useSnapshot';

/**
 * Modal panel that lists all snapshots with restore and delete actions.
 */
export function SnapshotManager({ novelPath, onClose, onToast }) {
  const { snapshots, loading, error, loadSnapshots, deleteSnapshot, restoreSnapshot } =
    useSnapshot(novelPath);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const handleRestore = useCallback(async (timestamp, label) => {
    const result = await restoreSnapshot(timestamp);
    if (result) {
      onToast({
        message: label ? `Restored snapshot: ${label}` : 'Snapshot restored',
        type: 'success',
      });
    } else {
      onToast({ message: 'Restore failed', type: 'error' });
    }
  }, [restoreSnapshot, onToast]);

  const handleDelete = useCallback(async (timestamp) => {
    const result = await deleteSnapshot(timestamp);
    if (result) {
      onToast({ message: 'Snapshot deleted', type: 'success' });
    } else {
      onToast({ message: 'Delete failed', type: 'error' });
    }
  }, [deleteSnapshot, onToast]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" data-testid="snapshot-manager">
      <div className="modal-box snapshot-manager-box">
        <div className="modal-header">
          <h3 className="modal-title">Snapshots</h3>
          <button
            className="btn ghost modal-close"
            data-testid="snapshot-manager-close"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            x
          </button>
        </div>

        {loading && (
          <div className="snapshot-manager-loading" data-testid="snapshot-manager-loading">
            Loading snapshots...
          </div>
        )}

        {error && (
          <div className="snapshot-manager-error" data-testid="snapshot-manager-error">
            {error}
          </div>
        )}

        {!loading && snapshots.length === 0 && (
          <div className="snapshot-manager-empty" data-testid="snapshot-manager-empty">
            No snapshots yet. Use the Snapshot button to create one.
          </div>
        )}

        {!loading && snapshots.length > 0 && (
          <ul className="snapshot-list" data-testid="snapshot-list">
            {snapshots.map((snap) => (
              <li
                key={snap.timestamp}
                className="snapshot-entry"
                data-testid={`snapshot-entry-${snap.timestamp}`}
              >
                <div className="snapshot-entry-info">
                  <span className="snapshot-label">
                    {snap.label || <em>No label</em>}
                  </span>
                  <span className="snapshot-meta">
                    {formatDate(snap.created)} - {formatSize(snap.size)}
                  </span>
                </div>
                <div className="snapshot-entry-actions">
                  <button
                    className="btn ghost small"
                    data-testid={`snapshot-restore-${snap.timestamp}`}
                    onClick={() => handleRestore(snap.timestamp, snap.label)}
                    type="button"
                  >
                    Restore
                  </button>
                  <button
                    className="btn danger small"
                    data-testid={`snapshot-delete-${snap.timestamp}`}
                    onClick={() => handleDelete(snap.timestamp)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
