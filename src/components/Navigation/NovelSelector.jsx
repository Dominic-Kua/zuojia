import React, { useEffect, useState } from 'react';
import { indexHandlers, appHandlers } from '../../lib/ipc-client';
import './NovelSelector.css';

/**
 * NovelSelector Component
 * Manages novel creation and opening
 */
export function NovelSelector({ onNovelCreated, onNovelOpened }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [novelName, setNovelName] = useState('');
  const [error, setError] = useState(null);
  const [openError, setOpenError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [novels, setNovels] = useState([]);
  const [isLoadingNovels, setIsLoadingNovels] = useState(false);

  // Validate novel name (accept spaces, capitals, unicode, but not just whitespace)
  const isValidNovelName = (name) => {
    if (!name || name.trim() === '') {
      console.log('Novel name validation: empty');
      return false;
    }
    // Just check that it's not empty after trimming
    const isValid = name.trim().length > 0;
    console.log('Novel name validation:', name, '→', isValid);
    return isValid;
  };

  const loadNovels = async () => {
    setIsLoadingNovels(true);
    try {
      const result = await appHandlers.listNovels();
      setNovels(result.novels || []);
    } catch (err) {
      console.error('Failed to load novels list:', err);
      setNovels([]);
    } finally {
      setIsLoadingNovels(false);
    }
  };

  useEffect(() => {
    loadNovels();
  }, []);

  const openNovelFromPath = async (novelPath) => {
    setOpenError(null);
    setLoading(true);
    try {
      const validation = await indexHandlers.validateNovel(novelPath);

      if (validation.isValid) {
        await indexHandlers.getIndex(novelPath);

        await appHandlers.markNovelOpened(novelPath);

        if (onNovelOpened) {
          onNovelOpened(novelPath);
        }
      }
    } catch (err) {
      setOpenError(err.message || 'Failed to open novel');
      console.error('Error opening novel:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNovel = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isValidNovelName(novelName)) {
      setError('Novel name must contain only lowercase letters, numbers, hyphens, and underscores');
      return;
    }

    setLoading(true);
    try {
      console.log('Creating novel with name:', novelName);
      const result = await indexHandlers.createNovel(novelName);
      console.log('Novel created successfully:', result);
      setShowCreateDialog(false);
      setNovelName('');

      await loadNovels();
      
      // Notify parent
      if (onNovelCreated) {
        onNovelCreated(result.novelPath);
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to create novel';
      setError(errorMsg);
      console.error('Error creating novel:', err, errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNovel = async () => {
    setOpenError(null);
    setLoading(true);
    try {
      const { novelPath } = await appHandlers.selectNovelDirectory();
      await openNovelFromPath(novelPath);
    } catch (err) {
      if (err && err.code === 'DIALOG_CANCELED') {
        console.info('Open novel dialog was canceled by the user.');
      } else {
        setOpenError(err.message || 'Failed to open novel');
        console.error('Error opening novel:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="novel-selector">
      <button
        className="novel-selector-btn"
        data-testid="new-novel-button"
        onClick={() => setShowCreateDialog(true)}
        disabled={loading}
      >
        + New Novel
      </button>
      <button
        className="novel-selector-btn"
        data-testid="open-novel-button"
        onClick={handleOpenNovel}
        disabled={loading}
      >
        Open Novel
      </button>

      {openError && (
        <p className="open-error-message" data-testid="open-novel-error">{openError}</p>
      )}

      <div className="novel-list" data-testid="novel-list">
        <div className="novel-list-header">
          <h3>Recent novels</h3>
          <button
            type="button"
            className="novel-list-refresh"
            onClick={loadNovels}
            disabled={isLoadingNovels || loading}
          >
            Refresh
          </button>
        </div>
        {isLoadingNovels ? (
          <div className="novel-list-empty">Loading novels...</div>
        ) : novels.length === 0 ? (
          <div className="novel-list-empty">No novels found in ~/.ä½å®¶</div>
        ) : (
          <ul className="novel-list-items">
            {novels.map((novel) => (
              <li key={novel.novelPath} className="novel-list-item">
                <div className="novel-list-info">
                  <div className="novel-list-title">{novel.displayName}</div>
                  <div className="novel-list-path">{novel.novelPath}</div>
                </div>
                <button
                  className="novel-list-open"
                  onClick={() => openNovelFromPath(novel.novelPath)}
                  disabled={loading}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreateDialog && (
        <div className="modal-overlay" onClick={() => !loading && setShowCreateDialog(false)}>
          <div className="modal-dialog" data-testid="create-novel-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Create a New Novel</h2>
            <form onSubmit={handleCreateNovel}>
              <input
                type="text"
                data-testid="novel-name-input"
                placeholder="Novel name (e.g., The Winds of Chance)"
                value={novelName}
                onChange={(e) => {
                  const newValue = e.target.value;
                  console.log('Input changed:', newValue);
                  setNovelName(newValue);
                  setError(null);
                }}
                disabled={loading}
                autoFocus
              />
              {novelName && !error && (
                <p className="slug-preview" data-testid="slug-preview">
                  Directory: {novelName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_\-]/g, '')}
                </p>
              )}
              {error && <p className="error-message" data-testid="novel-name-error">{error}</p>}
              <div className="dialog-buttons">
                <button
                  type="button"
                  data-testid="cancel-novel-button"
                  onClick={() => !loading && setShowCreateDialog(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="create-novel-button"
                  disabled={!isValidNovelName(novelName) || loading}
                  className="primary"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
