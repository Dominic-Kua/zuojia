import React, { useState, useCallback } from 'react';
import { useSnapshot } from '../../hooks/useSnapshot';
import { SnapshotManager } from './SnapshotManager';
import { SnapshotDialog } from './SnapshotDialog';

/**
 * Snapshot button shown in the manuscript toolbar.
 * Clicking it opens a small dialog to label and create a snapshot.
 * A "Manage" link opens the SnapshotManager panel for list/restore/delete.
 */
export function SnapshotButton({ novelPath, onToast }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { createSnapshot } = useSnapshot(novelPath);

  const openDialog = useCallback(() => {
    setManagerOpen(false);
    setLabel('');
    setDialogOpen(true);
  }, []);

  const openManager = useCallback(() => {
    setDialogOpen(false);
    setManagerOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const trimmedLabel = label.trim() || null;
      const result = await createSnapshot(trimmedLabel);
      if (result) {
        const displayLabel = result.label || null;
        onToast({
          message: displayLabel ? `Snapshot created: ${displayLabel}` : 'Snapshot created',
          type: 'success',
        });
        setDialogOpen(false);
      } else {
        onToast({ message: 'Snapshot creation failed', type: 'error' });
      }
    } catch (err) {
      onToast({ message: err.message || 'Snapshot creation failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [createSnapshot, label, onToast]);

  return (
    <>
      <button
        className="btn ghost snapshot-btn"
        data-testid="snapshot-button"
        onClick={openDialog}
        title="Take a local snapshot backup"
        type="button"
      >
        Snapshot
      </button>

      <button
        className="btn ghost snapshot-manage-btn"
        data-testid="snapshot-manage-button"
        onClick={openManager}
        title="View and restore snapshots"
        type="button"
      >
        Snapshots ▾
      </button>

      {dialogOpen && (
        <SnapshotDialog
          label={label}
          submitting={submitting}
          onLabelChange={setLabel}
          onSubmit={handleSubmit}
          onCancel={closeDialog}
        />
      )}

      {managerOpen && (
        <SnapshotManager
          novelPath={novelPath}
          onClose={() => setManagerOpen(false)}
          onToast={onToast}
        />
      )}
    </>
  );
}
