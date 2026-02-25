import React, { useState } from 'react';
import { indexHandlers } from '../../lib/ipc-client';
import './NovelSelector.css';

/**
 * NovelSelector Component
 * Manages novel creation and selection
 */
export function NovelSelector({ onNovelCreated }) {
  const [showDialog, setShowDialog] = useState(false);
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
      setShowDialog(false);
      setNovelName('');
      
      // Close dialog and notify parent
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

  return (
    <div className="novel-selector">
      <button
        className="novel-selector-btn"
        onClick={() => setShowDialog(true)}
      >
        + New Novel
      </button>

      {showDialog && (
        <div className="modal-overlay" onClick={() => setShowDialog(false)}>
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
                  onClick={() => setShowDialog(false)}
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
