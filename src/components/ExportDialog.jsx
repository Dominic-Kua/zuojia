import React, { useEffect, useRef, useState } from 'react';
import { exportHandlers, indexHandlers } from '../lib/ipc-client';

function getDefaultMetadata() {
  return {
    title: '',
    author: '',
    date: new Date().toISOString().slice(0, 10),
  };
}

export function ExportDialog({ novelPath }) {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [selectedFilenames, setSelectedFilenames] = useState(new Set());
  const [metadata, setMetadata] = useState(getDefaultMetadata);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
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
    setMetadata(getDefaultMetadata());
    try {
      const index = await indexHandlers.getIndex(novelPath);
      const loaded = index.chapters || [];
      setChapters(loaded);
      setSelectedFilenames(new Set(loaded.map((c) => c.filename)));
      setMetadata((current) => ({
        ...current,
        title: current.title || novelPath.split(/[\\/]/).filter(Boolean).at(-1) || '',
      }));
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

  const handleExport = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    setError(null);
    try {
      const chapterOrder = chapters
        .filter((c) => selectedFilenames.has(c.filename))
        .map(({ filename, title }) => ({ filename, title }));

      const result = await exportHandlers.pdf(novelPath, { ...metadata, chapterOrder });
      setToast(`PDF exported: ${result.outputPath}`);
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
                        data-testid={`export-chapter-item-${chapter.filename}`}
                      >
                        <input
                          type="checkbox"
                          id={`export-chapter-${chapter.filename}`}
                          checked={selectedFilenames.has(chapter.filename)}
                          onChange={() => handleToggleChapter(chapter.filename)}
                        />
                        <label htmlFor={`export-chapter-${chapter.filename}`} className="export-chapter-label">
                          {chapter.title}
                        </label>
                      </div>
                    ))}
                    {chapters.length === 0 && (
                      <div className="commit-empty-state">No chapters available.</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="snapshot-error" data-testid="export-error">
                <div>{error.message}</div>
                {error.suggestion && <div className="push-guidance export-guidance">{error.suggestion}</div>}
              </div>
            )}

            <div className="snapshot-dialog-actions">
              <button className="btn ghost" data-testid="export-cancel" onClick={handleClose} disabled={isExporting}>
                Cancel
              </button>
              <button
                className="btn primary"
                data-testid="export-confirm"
                onClick={handleExport}
                disabled={isLoading || isExporting || selectedCount === 0}
              >
                {isExporting ? 'Exporting...' : 'Export to PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="snapshot-toast" data-testid="export-toast">{toast}</div>}
    </>
  );
}