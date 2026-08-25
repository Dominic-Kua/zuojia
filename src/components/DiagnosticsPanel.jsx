import React, { useState, useEffect, useRef } from 'react';
import { exportHandlers, backupHandlers, indexHandlers } from '../lib/ipc-client';

function formatBytes(bytes) {
  const size = Number.isFinite(bytes) ? bytes : 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString();
}

export function DiagnosticsPanel({ novelPath, onIndexRebuilt, onRestored, onBeforeRestore }) {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isRefreshingDeps, setIsRefreshingDeps] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [logs, setLogs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [indexInfo, setIndexInfo] = useState(null);
  const [deps, setDeps] = useState(null);
  const [error, setError] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null); // snapshot being restored
  const [restoreToast, setRestoreToast] = useState(null);
  const [rebuildToast, setRebuildToast] = useState(null);
  // Guards loadData setState calls against stale in-flight loads (e.g. the
  // dialog being closed and reopened quickly).
  const loadDataRequestRef = useRef(0);

  useEffect(() => {
    if (!restoreToast) return undefined;
    const timer = setTimeout(() => setRestoreToast(null), 4000);
    return () => clearTimeout(timer);
  }, [restoreToast]);

  useEffect(() => {
    if (!rebuildToast) return undefined;
    const timer = setTimeout(() => setRebuildToast(null), 4000);
    return () => clearTimeout(timer);
  }, [rebuildToast]);

  if (!novelPath) {
    return null;
  }

  const loadData = async () => {
    const requestId = ++loadDataRequestRef.current;
    setIsLoading(true);
    setError(null);
    const [logsResult, snapshotsResult, indexResult, depsResult] = await Promise.allSettled([
      exportHandlers.getLogs(novelPath),
      backupHandlers.listSnapshots(novelPath),
      indexHandlers.getIndex(novelPath),
      exportHandlers.validateDeps(),
    ]);
    if (requestId !== loadDataRequestRef.current) {
      return;
    }
    setLogs(logsResult.status === 'fulfilled' ? (logsResult.value ?? []) : []);
    setSnapshots(snapshotsResult.status === 'fulfilled' ? (snapshotsResult.value?.snapshots ?? []) : []);
    setIndexInfo(indexResult.status === 'fulfilled' ? indexResult.value : null);
    setDeps(depsResult.status === 'fulfilled' ? depsResult.value : null);
    setIsLoading(false);
  };

  const handleOpen = async () => {
    setShowDialog(true);
    await loadData();
  };

  const handleClose = () => {
    setShowDialog(false);
    setError(null);
  };

  const handleDeleteBackup = async (timestamp) => {
    try {
      await backupHandlers.deleteSnapshot(novelPath, timestamp);
      const updated = await backupHandlers.listSnapshots(novelPath);
      setSnapshots(updated?.snapshots ?? []);
    } catch (err) {
      setError(err.message || 'Failed to delete backup');
    }
  };

  const handleRebuildIndex = async () => {
    setIsRebuilding(true);
    setError(null);
    try {
      await indexHandlers.rebuildIndex(novelPath);
      const updated = await indexHandlers.getIndex(novelPath);
      setIndexInfo(updated);
      if (onIndexRebuilt) {
        onIndexRebuilt();
      }
      const chapterCount = updated?.chapters?.length ?? 0;
      const wikiCount = updated?.wiki?.length ?? 0;
      const chapterLabel = chapterCount === 1 ? 'chapter' : 'chapters';
      const wikiLabel = wikiCount === 1 ? 'wiki page' : 'wiki pages';
      setRebuildToast(`Index rebuilt: ${chapterCount} ${chapterLabel}, ${wikiCount} ${wikiLabel}`);
    } catch (err) {
      setError(err.message || 'Failed to rebuild index');
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleRefreshDeps = async () => {
    setIsRefreshingDeps(true);
    setError(null);
    try {
      const result = await exportHandlers.validateDeps();
      setDeps(result);
    } catch (err) {
      setError(err.message || 'Failed to check dependencies');
    } finally {
      setIsRefreshingDeps(false);
    }
  };

  const handleRestoreClick = (snap) => {
    setRestoreTarget(snap);
  };

  const handleRestoreConfirm = async (createSafetyBackup) => {
    if (!restoreTarget) return;
    const snap = restoreTarget;
    setRestoreTarget(null);
    setIsRestoring(true);
    setError(null);
    try {
      // Flush the editor's pending debounced save and SUSPEND further saves,
      // so neither the safety snapshot nor the restored files can be clobbered
      // by an in-flight autosave. Resume runs even on failure.
      let resumeSaves = null;
      if (onBeforeRestore) {
        resumeSaves = await onBeforeRestore();
      }
      try {
        if (createSafetyBackup) {
          await backupHandlers.createSnapshot(novelPath, 'pre-restore safety backup');
        }
        await backupHandlers.restore(novelPath, snap.timestamp);
        const updated = await backupHandlers.listSnapshots(novelPath);
        setSnapshots(updated?.snapshots ?? []);
        if (onIndexRebuilt) {
          onIndexRebuilt();
        }
        window.dispatchEvent(new CustomEvent('zuojia:wiki-dictionary-updated', {
          detail: { novelPath },
        }));
        if (onRestored) {
          onRestored();
        }
        const label = snap.label || formatTimestamp(snap.timestamp);
        setRestoreToast(`Restored from ${label}`);
      } finally {
        resumeSaves?.();
      }
    } catch (err) {
      setError(err.message || 'Restore failed');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreCancel = () => {
    setRestoreTarget(null);
  };

  return (
    <>
      <button className="btn ghost" data-testid="diagnostics-button" onClick={handleOpen}>
        Diagnostics
      </button>

      {showDialog && (
        <div className="snapshot-overlay" data-testid="diagnostics-overlay" onClick={handleClose}>
          <div
            className="snapshot-dialog diagnostics-dialog"
            data-testid="diagnostics-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="diagnostics-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="diagnostics-dialog-title">Diagnostics</h3>

            {isLoading ? (
              <div className="commit-loading" data-testid="diagnostics-loading">Loading…</div>
            ) : (
              <>
                {/* Index Status */}
                <section className="diagnostics-section" data-testid="diagnostics-index-section">
                  <div className="diagnostics-section-header">
                    <h4>Index Status</h4>
                    <button
                      className="btn ghost btn-sm"
                      data-testid="diagnostics-rebuild-index-button"
                      onClick={handleRebuildIndex}
                      disabled={isRebuilding}
                    >
                      {isRebuilding ? 'Rebuilding…' : 'Rebuild Index'}
                    </button>
                  </div>
                  {indexInfo ? (
                    <div className="diagnostics-index-info">
                      <span>Chapters: <strong data-testid="diagnostics-chapter-count">{indexInfo.chapters?.length ?? 0}</strong></span>
                      <span>Wiki pages: <strong data-testid="diagnostics-wiki-count">{indexInfo.wiki?.length ?? 0}</strong></span>
                      {indexInfo.lastRebuild && (
                        <span className="diagnostics-muted">Last rebuilt: {formatTimestamp(indexInfo.lastRebuild)}</span>
                      )}
                    </div>
                  ) : (
                    <div className="commit-empty-state">Index not available.</div>
                  )}
                </section>

                {/* Dependency Check */}
                <section className="diagnostics-section" data-testid="diagnostics-deps-section">
                  <div className="diagnostics-section-header">
                    <h4>Dependencies</h4>
                    <button
                      className="btn ghost btn-sm"
                      data-testid="diagnostics-refresh-deps-button"
                      onClick={handleRefreshDeps}
                      disabled={isRefreshingDeps}
                    >
                      {isRefreshingDeps ? 'Checking…' : 'Refresh'}
                    </button>
                  </div>
                  {deps ? (
                    <div className="diagnostics-deps-list">
                      <div data-testid="diagnostics-pandoc-status">
                        <span className={deps.pandoc?.available ? 'diagnostics-ok' : 'diagnostics-error'}>●</span>
                        {' Pandoc'}{deps.pandoc?.available ? ` — ${deps.pandoc.version}` : ' — not found'}
                      </div>
                      <div data-testid="diagnostics-tex-status">
                        <span className={deps.tex?.available ? 'diagnostics-ok' : 'diagnostics-error'}>●</span>
                        {' TeX'}{deps.tex?.available ? ` — ${deps.tex.engine} ${deps.tex.version}` : ' — not found'}
                      </div>
                    </div>
                  ) : (
                    <div className="commit-empty-state">Dependency check unavailable.</div>
                  )}
                </section>

                {/* Backups */}
                <section className="diagnostics-section" data-testid="diagnostics-backups-section">
                  <h4>Backups</h4>
                  {snapshots.length === 0 ? (
                    <div className="commit-empty-state">No backups yet.</div>
                  ) : (
                    <ul className="diagnostics-backup-list">
                      {snapshots.map((snap) => (
                        <li key={snap.timestamp} className="diagnostics-backup-item">
                          <div className="diagnostics-backup-info">
                            <span className="diagnostics-backup-label">{snap.label || '(unlabelled)'}</span>
                            <span className="diagnostics-muted">{formatTimestamp(snap.timestamp)} · {formatBytes(snap.size)}</span>
                          </div>
                          <div className="diagnostics-backup-actions">
                            <button
                              className="btn ghost btn-sm"
                              data-testid={`diagnostics-restore-backup-${snap.timestamp}`}
                              onClick={() => handleRestoreClick(snap)}
                              disabled={isRestoring}
                            >
                              Restore
                            </button>
                            <button
                              className="btn ghost btn-sm btn-danger"
                              data-testid={`diagnostics-delete-backup-${snap.timestamp}`}
                              onClick={() => handleDeleteBackup(snap.timestamp)}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Export Logs */}
                <section className="diagnostics-section" data-testid="diagnostics-logs-section">
                  <h4>Export Logs</h4>
                  {logs.length === 0 ? (
                    <div className="commit-empty-state">No export logs yet.</div>
                  ) : (
                    <div className="diagnostics-logs-list">
                      {logs.map((log) => (
                        <details key={log.filename} className="export-log-entry">
                          <summary className="export-log-filename">{log.filename}</summary>
                          <pre className="export-log-content">{log.content}</pre>
                        </details>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {error && (
              <div className="snapshot-error" data-testid="diagnostics-error">{error}</div>
            )}

            <div className="snapshot-dialog-actions">
              <button className="btn ghost" data-testid="diagnostics-close" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore confirmation dialog */}
      {restoreTarget && (
        <div className="snapshot-overlay" data-testid="restore-confirm-overlay" onClick={handleRestoreCancel}>
          <div
            className="snapshot-dialog"
            data-testid="restore-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="restore-confirm-title">Restore Snapshot</h3>
            <p>Restore will replace current manuscript and wiki state with the selected snapshot.</p>
            <p>Create backup first before restoring?</p>
            <div className="snapshot-dialog-actions">
              <button className="btn ghost" data-testid="restore-confirm-cancel" onClick={handleRestoreCancel}>
                Cancel
              </button>
              <button className="btn ghost" data-testid="restore-confirm-no" onClick={() => handleRestoreConfirm(false)}>
                No
              </button>
              <button className="btn primary" data-testid="restore-confirm-yes" onClick={() => handleRestoreConfirm(true)}>
                Yes — Back Up First
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreToast && (
        <div className="snapshot-toast" data-testid="restore-toast">{restoreToast}</div>
      )}

      {rebuildToast && (
        <div className="snapshot-toast" data-testid="rebuild-toast">{rebuildToast}</div>
      )}
    </>
  );
}
