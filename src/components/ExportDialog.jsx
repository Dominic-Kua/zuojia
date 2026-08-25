import React, { useEffect, useRef, useState } from 'react';
import { exportHandlers, indexHandlers } from '../lib/ipc-client';

function getDefaultMetadata() {
  return {
    title: '',
    author: '',
    date: new Date().toISOString().slice(0, 10),
  };
}

export function ExportDialog({ novelPath, onBeforeExport }) {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [selectedFilenames, setSelectedFilenames] = useState(new Set());
  const [metadata, setMetadata] = useState(getDefaultMetadata);
  const [error, setError] = useState(null);
  // Separate error for "View Logs" failures so a logs problem can't clobber
  // or masquerade as an export/chapter-loading failure.
  const [logError, setLogError] = useState(null);
  const [dependencyError, setDependencyError] = useState(null);
  const [dependencyStatus, setDependencyStatus] = useState(null);
  const [toast, setToast] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const dragIndexRef = useRef(null);

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

  const handleChange = (field) => (event) => {
    setMetadata((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handleOpen = async () => {
    setShowDialog(true);
    setIsLoading(true);
    setError(null);
    setLogError(null);
    setDependencyError(null);
    setDependencyStatus(null);
    setShowLogs(false);
    setLogs([]);
    setMetadata(getDefaultMetadata());
    try {
      // Flush any pending editor autosave before reading chapters from disk.
      if (onBeforeExport) {
        await onBeforeExport();
      }
      const index = await indexHandlers.getIndex(novelPath);
      const loaded = index.chapters || [];
      setChapters(loaded);
      setSelectedFilenames(new Set(loaded.map((c) => c.filename)));
      setMetadata((current) => ({
        ...current,
        title: current.title || novelPath.split(/[\\/]/).filter(Boolean).at(-1) || '',
      }));

      try {
        const status = await exportHandlers.validateDeps();
        setDependencyStatus(status);
      } catch (err) {
        setDependencyError({
          message: err.message || 'Export dependencies are unavailable',
          suggestion: err.suggestion || 'Install Pandoc and a TeX engine, then try again.',
        });
      }
    } catch (err) {
      setError({
        message: err.message || 'Failed to load chapters for export',
        suggestion: err.suggestion || null,
      });
      setChapters([]);
      setSelectedFilenames(new Set());
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isExporting) {
      return;
    }
    setShowDialog(false);
    setError(null);
    setLogError(null);
    setShowLogs(false);
  };

  const handleViewLogs = async () => {
    setShowLogs(true);
    setIsLogsLoading(true);
    setLogError(null);
    try {
      const logEntries = await exportHandlers.getLogs(novelPath);
      setLogs(logEntries);
    } catch (err) {
      setLogs([]);
      setLogError({ message: err.message || 'Failed to load export logs', suggestion: null });
    } finally {
      setIsLogsLoading(false);
    }
  };

  const handleToggleChapter = (filename) => {
    setSelectedFilenames((current) => {
      const next = new Set(current);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const handleDragStart = (index) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (dropIndex) => {
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      return;
    }
    setChapters((current) => {
      const next = [...current];
      const [dragged] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, dragged);
      return next;
    });
    dragIndexRef.current = null;
  };

  const selectedCount = chapters.filter((c) => selectedFilenames.has(c.filename)).length;
  const displayError = error || dependencyError;

  const handleExport = async () => {
    if (isExporting || dependencyError) {
      return;
    }

    setIsExporting(true);
    setError(null);
    try {
      // Flush any pending editor autosave so the export includes the latest text.
      if (onBeforeExport) {
        await onBeforeExport();
      }
      const chapterOrder = chapters
        .filter((c) => selectedFilenames.has(c.filename))
        .map(({ filename, title }) => ({ filename, title }));

      const result = await exportHandlers.pdf(novelPath, { ...metadata, chapterOrder });
      const engine = result.texEngine ? ` (${result.texEngine})` : '';
      setToast(`PDF exported${engine}: ${result.outputPath}`);
      setShowDialog(false);
    } catch (err) {
      setError({
        message: err.message || 'PDF export failed',
        suggestion: err.suggestion || 'Review the export log and your local dependencies.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <button className="btn ghost" data-testid="export-button" onClick={handleOpen}>
        Export
      </button>

      {showDialog && (
        <div className="snapshot-overlay" data-testid="export-overlay" onClick={handleClose}>
          <div
            className="snapshot-dialog settings-dialog"
            data-testid="export-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="export-dialog-title">Export PDF</h3>
            <p>Create a publication-ready PDF from your current manuscript.</p>

            {isLoading ? (
              <div className="commit-loading" data-testid="export-loading">Loading chapters...</div>
            ) : (
              <>
                <label className="settings-field" htmlFor="export-title-input">
                  <span>Title</span>
                  <input
                    id="export-title-input"
                    data-testid="export-title-input"
                    className="snapshot-label-input"
                    type="text"
                    value={metadata.title}
                    onChange={handleChange('title')}
                  />
                </label>

                <label className="settings-field" htmlFor="export-author-input">
                  <span>Author</span>
                  <input
                    id="export-author-input"
                    data-testid="export-author-input"
                    className="snapshot-label-input"
                    type="text"
                    value={metadata.author}
                    onChange={handleChange('author')}
                  />
                </label>

                <label className="settings-field" htmlFor="export-date-input">
                  <span>Publication date</span>
                  <input
                    id="export-date-input"
                    data-testid="export-date-input"
                    className="snapshot-label-input"
                    type="date"
                    value={metadata.date}
                    onChange={handleChange('date')}
                  />
                </label>

                <div className="settings-field">
                  <span>Chapters included</span>
                  <div className="export-chapter-list" data-testid="export-chapter-list">
                    {chapters.map((chapter, index) => (
                      <div
                        key={chapter.filename}
                        className="export-chapter-item"
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(index)}
                        data-testid={`export-chapter-item-${encodeURIComponent(chapter.filename)}`}
                      >
                        <input
                          type="checkbox"
                          id={`export-chapter-${index}`}
                          checked={selectedFilenames.has(chapter.filename)}
                          onChange={() => handleToggleChapter(chapter.filename)}
                        />
                        <label htmlFor={`export-chapter-${index}`} className="export-chapter-label">
                          {chapter.title}
                        </label>
                      </div>
                    ))}
                    {chapters.length === 0 && (
                      <div className="commit-empty-state">No chapters available.</div>
                    )}
                  </div>
                </div>

                {dependencyStatus && !dependencyError && (
                  <div className="push-guidance export-guidance" data-testid="export-preflight-ready">
                    Ready to export with {dependencyStatus.tex.engine} ({dependencyStatus.pandoc.version})
                  </div>
                )}
              </>
            )}

            {displayError && (
              <div className="snapshot-error" data-testid="export-error">
                <div>{displayError.message}</div>
                {displayError.suggestion && <div className="push-guidance export-guidance">{displayError.suggestion}</div>}
              </div>
            )}

            <div className="snapshot-dialog-actions">
              <button className="btn ghost" data-testid="export-view-logs-button" onClick={handleViewLogs}>
                View Logs
              </button>
              <button className="btn ghost" data-testid="export-cancel" onClick={handleClose} disabled={isExporting}>
                Cancel
              </button>
              <button
                className="btn primary"
                data-testid="export-confirm"
                onClick={handleExport}
                disabled={isLoading || isExporting || selectedCount === 0 || Boolean(dependencyError)}
              >
                {isExporting ? 'Exporting...' : 'Export to PDF'}
              </button>
            </div>

            {showLogs && (
              <div className="export-logs-panel" data-testid="export-logs-panel">
                {isLogsLoading ? (
                  <div className="commit-loading" data-testid="export-logs-loading">Loading logs...</div>
                ) : logError ? (
                  <div className="snapshot-error" data-testid="export-logs-error">
                    <div>{logError.message}</div>
                    {logError.suggestion && <div className="push-guidance export-guidance">{logError.suggestion}</div>}
                  </div>
                ) : logs.length === 0 ? (
                  <div className="commit-empty-state">No export logs yet.</div>
                ) : (
                  logs.map((log) => (
                    <details key={log.filename} className="export-log-entry">
                      <summary className="export-log-filename">{log.filename}</summary>
                      <pre className="export-log-content">{log.content}</pre>
                    </details>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className="snapshot-toast" data-testid="export-toast">{toast}</div>}
    </>
  );
}