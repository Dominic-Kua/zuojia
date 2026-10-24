import React, { useEffect, useRef, useState } from 'react';
import { exportHandlers, indexHandlers } from '../lib/ipc-client';

function getDefaultMetadata() {
  return {
    title: '',
    author: '',
    date: new Date().toISOString().slice(0, 10),
    format: 'pdf',
    style: 'manuscript',
    chapterBreaks: true,
    includeTableOfContents: true,
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
  const [isCheckingDependencies, setIsCheckingDependencies] = useState(false);
  const [toast, setToast] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const dragIndexRef = useRef(null);
  const dependencyRequestRef = useRef(0);

  const checkDependencies = async (format) => {
    const requestId = ++dependencyRequestRef.current;
    setIsCheckingDependencies(true);
    setDependencyError(null);
    setDependencyStatus(null);
    try {
      const status = await exportHandlers.validateDeps(format);
      if (requestId === dependencyRequestRef.current) {
        setDependencyStatus(status);
      }
    } catch (err) {
      if (requestId === dependencyRequestRef.current) {
        setDependencyError({
          message: err.message || 'Export dependencies are unavailable',
          suggestion: err.suggestion || 'Install Pandoc and the dependencies for the selected format, then try again.',
        });
      }
    } finally {
      if (requestId === dependencyRequestRef.current) {
        setIsCheckingDependencies(false);
      }
    }
  };

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
    const defaultMetadata = getDefaultMetadata();
    setMetadata(defaultMetadata);
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
      await checkDependencies(defaultMetadata.format);
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
    dependencyRequestRef.current += 1;
    setIsCheckingDependencies(false);
    setShowDialog(false);
    setError(null);
    setLogError(null);
    setShowLogs(false);
  };

  const handleFormatChange = (event) => {
    const format = event.target.value;
    setError(null);
    setMetadata((current) => ({ ...current, format }));
    checkDependencies(format);
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
    if (isExporting || isCheckingDependencies || dependencyError) {
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

      const result = await exportHandlers.manuscript(novelPath, { ...metadata, chapterOrder });
      const engine = metadata.format === 'pdf' && result.texEngine ? ` (${result.texEngine})` : '';
      setToast(`${metadata.format.toUpperCase()} exported${engine}: ${result.outputPath}`);
      setShowDialog(false);
    } catch (err) {
      setError({
        message: err.message || `${metadata.format.toUpperCase()} export failed`,
        suggestion: err.suggestion || 'Review the export log and the dependencies for the selected format.',
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
            <h3 id="export-dialog-title">Export {metadata.format.toUpperCase()}</h3>
            <p>Prepare selected manuscript chapters for publication or sharing.</p>

            {isLoading ? (
              <div className="commit-loading" data-testid="export-loading">Loading chapters...</div>
            ) : (
              <>
                <label className="settings-field" htmlFor="export-format-select">
                  <span>Format</span>
                  <select
                    id="export-format-select"
                    data-testid="export-format-select"
                    className="snapshot-label-input"
                    value={metadata.format}
                    onChange={handleFormatChange}
                  >
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                    <option value="epub">EPUB</option>
                  </select>
                </label>

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

                {metadata.format !== 'pdf' && (
                  <>
                    <label className="settings-field" htmlFor="export-style-select">
                      <span>Output style</span>
                      <select
                        id="export-style-select"
                        data-testid="export-style-select"
                        className="snapshot-label-input"
                        value={metadata.style}
                        onChange={handleChange('style')}
                      >
                        <option value="manuscript">Manuscript</option>
                        <option value="reader">Reader-friendly</option>
                      </select>
                    </label>

                    <label className="commit-file-option" htmlFor="export-chapter-breaks">
                      <input
                        id="export-chapter-breaks"
                        data-testid="export-chapter-breaks"
                        type="checkbox"
                        checked={metadata.chapterBreaks}
                        onChange={(event) => setMetadata((current) => ({
                          ...current,
                          chapterBreaks: event.target.checked,
                        }))}
                      />
                      {metadata.format === 'docx'
                        ? 'Start each chapter on a new page'
                        : 'Split each chapter into its own section'}
                    </label>

                    <label className="commit-file-option" htmlFor="export-toc">
                      <input
                        id="export-toc"
                        data-testid="export-toc"
                        type="checkbox"
                        checked={metadata.includeTableOfContents}
                        onChange={(event) => setMetadata((current) => ({
                          ...current,
                          includeTableOfContents: event.target.checked,
                        }))}
                      />
                      Include a table of contents
                    </label>
                  </>
                )}

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

                {isCheckingDependencies && (
                  <div className="commit-loading" data-testid="export-deps-loading">Checking export dependencies...</div>
                )}
                {dependencyStatus && !dependencyError && !isCheckingDependencies && (
                  <div className="push-guidance export-guidance" data-testid="export-preflight-ready">
                    {metadata.format === 'pdf'
                      ? `Ready to export with ${dependencyStatus.tex?.engine} (${dependencyStatus.pandoc.version})`
                      : `Ready to export with ${dependencyStatus.pandoc.version}`}
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
                disabled={isLoading || isExporting || isCheckingDependencies || selectedCount === 0 || Boolean(dependencyError)}
              >
                {isExporting ? 'Exporting...' : `Export to ${metadata.format.toUpperCase()}`}
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
