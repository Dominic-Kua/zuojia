import React from 'react';

/**
 * Modal dialog used to create a labeled or unlabeled snapshot.
 */
export function SnapshotDialog({
  label,
  submitting,
  onLabelChange,
  onSubmit,
  onCancel,
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" data-testid="snapshot-dialog">
      <div className="modal-box snapshot-dialog-box">
        <h3 className="modal-title">Take Snapshot</h3>
        <p className="modal-description">
          Save the current state of your novel as a local backup.
        </p>
        <form onSubmit={onSubmit}>
          <label className="input-label" htmlFor="snapshot-label">
            Label <span className="input-hint">(optional)</span>
          </label>
          <input
            id="snapshot-label"
            className="text-input"
            type="text"
            placeholder="e.g. End of Chapter 5"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            data-testid="snapshot-label-input"
            autoFocus
            maxLength={100}
          />
          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              data-testid="snapshot-cancel-button"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              data-testid="snapshot-submit-button"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Take Snapshot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}