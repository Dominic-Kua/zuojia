import React, { useState } from 'react';
import { exportHandlers, backupHandlers, indexHandlers } from '../lib/ipc-client';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(ts) {
  return new Date(typeof ts === 'number' ? ts : ts).toLocaleString();
}

export function DiagnosticsPanel({ novelPath, onIndexRebuilt }) {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isRefreshingDeps, setIsRefreshingDeps] = useState(false);
  const [logs, setLogs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [indexInfo, setIndexInfo] = useState(null);
  const [deps, setDeps] = useState(null);
  const [error, setError] = useState(null);

  if (!novelPath) {
    return null;
  }

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [logsResult, snapshotsResult, indexResult, depsResult] = await Promise.allSettled([
        exportHandlers.getLogs(novelPath),
        backupHandlers.listSnapshots(novelPath),
        indexHandlers.getIndex(novelPath),
        exportHandlers.validateDeps(),
      ]);

      setLogs(logsResult.status === 'fulfilled' ? (logsResult.value ?? []) : []);
      setSnapshots(snapshotsResult.status === 'fulfilled' ? (snapshotsResult.value ?? []) : []);
      setIndexInfo(indexResult.status === 'fulfilled' ? indexResult.value : null);
      setDeps(depsResult.status === 'fulfilled' ? depsResult.value : null);
    } catch (err) {
      setError(err.message || 'Failed to load diagnostics data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = async () => {
    setShowDialog(true);
    await loadData();
  };

  const handleClose = () => {
    setShowDialog(false);
    setError(null);
  };

  const handleDeleteBackup = async (snapshotId) => {
    try {
      await backupHandlers.deleteSnapshot(novelPath, snapshotId);
      const updated = await backupHandlers.listSnapshots(novelPath);
      setSnapshots(updated ?? []);
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
                        <li key={snap.id} className="diagnostics-backup-item">
                          <div className="diagnostics-backup-info">
                            <span className="diagnostics-backup-label">{snap.label || '(unlabelled)'}</span>
                            <span className="diagnostics-muted">{formatTimestamp(snap.timestamp)} · {formatBytes(snap.size)}</span>
                          </div>
                          <button
                            className="btn ghost btn-sm btn-danger"
                            data-testid={`diagnostics-delete-backup-${snap.id}`}
                            onClick={() => handleDeleteBackup(snap.id)}
                          >
                            Delete
                          </button>
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
    </>
  );
}
