import React, { useState } from 'react';
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
  const [loading, setLoading] = useState(false);

  // Validate novel name (only lowercase alphanumeric, hyphen, underscore)
  const isValidNovelName = (name) => {
    if (!name || name.trim() === '') return false;
    return /^[a-z0-9_\-]+$/.test(name);
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
      const result = await indexHandlers.createNovel(novelName);
      setShowCreateDialog(false);
      setNovelName('');
      
      // Notify parent
      if (onNovelCreated) {
        onNovelCreated(result.novelPath);
      }
    } catch (err) {
      setError(err.message || 'Failed to create novel');
      console.error('Error creating novel:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNovel = async () => {
    setError(null);
    setLoading(true);
    try {
      const { novelPath } = await appHandlers.selectNovelDirectory();
      
      // Validate the selected directory
      const validation = await indexHandlers.validateNovel(novelPath);
      
      if (validation.isValid) {
        // Get index to confirm it's a valid novel
        await indexHandlers.getIndex(novelPath);
        
        // Notify parent
        if (onNovelOpened) {
          onNovelOpened(novelPath);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to open novel');
      console.error('Error opening novel:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="novel-selector">
      <button
        className="novel-selector-btn"
        onClick={() => setShowCreateDialog(true)}
        disabled={loading}
      >
        + New Novel
      </button>
      <button
        className="novel-selector-btn"
        onClick={handleOpenNovel}
        disabled={loading}
      >
        Open Novel
      </button>

      {showCreateDialog && (
        <div className="modal-overlay" onClick={() => !loading && setShowCreateDialog(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Create a New Novel</h2>
            <form onSubmit={handleCreateNovel}>
              <input
                type="text"
                placeholder="Novel name (lowercase, alphanumeric, - and _)"
                value={novelName}
                onChange={(e) => {
                  setNovelName(e.target.value);
                  setError(null);
                }}
                disabled={loading}
                autoFocus
              />
              {error && <p className="error-message">{error}</p>}
              <div className="dialog-buttons">
                <button
                  type="button"
                  onClick={() => !loading && setShowCreateDialog(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
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
