import React, { useState, useCallback, useEffect, useRef } from 'react'
import WikiPageList from './WikiSidebar/WikiPageList'
import { useWikiPages } from '../hooks/useWikiPages'
import { wikiHandlers } from '../lib/ipc-client'

export default function Sidebar({ novelPath }){
  const { pages, loading, error, createPage, deletePage, search } = useWikiPages(novelPath);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [createError, setCreateError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [wikiContent, setWikiContent] = useState('');
  const [wikiLoadError, setWikiLoadError] = useState(null);
  const [isLoadingWiki, setIsLoadingWiki] = useState(false);
  const [isSavingWiki, setIsSavingWiki] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef(null);

  const handleSelectPage = useCallback((slug) => {
    setSelectedSlug(slug);
  }, []);

  const handleDeletePage = useCallback(async (slug) => {
    try {
      await deletePage(slug);
    } catch (err) {
      console.error('Error deleting wiki page:', err);
    }
  }, [deletePage]);

  const handleSearch = useCallback((query) => {
    search(query);
  }, [search]);

  const handleCreateToggle = useCallback(() => {
    setShowCreateForm((prev) => !prev);
    setCreateError(null);
  }, []);

  const handleCreateSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Please enter a wiki page title');
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);
      const result = await createPage(newTitle.trim(), '');
      const createdSlug = result?.data?.data?.slug || result?.data?.slug;
      setNewTitle('');
      setShowCreateForm(false);
      if (createdSlug) {
        setSelectedSlug(createdSlug);
      }
    } catch (err) {
      setCreateError(err.message || 'Failed to create wiki page');
      console.error('Error creating wiki page:', err);
    } finally {
      setIsCreating(false);
    }
  }, [createPage, newTitle]);

  useEffect(() => {
    const loadWikiContent = async () => {
      if (!selectedSlug || !novelPath) {
        setWikiContent('');
        setWikiLoadError(null);
        setIsDirty(false);
        return;
      }

      try {
        setIsLoadingWiki(true);
        setWikiLoadError(null);
        const result = await wikiHandlers.read(novelPath, selectedSlug);
        const content = result?.content || '';
        setWikiContent(content);
        setIsDirty(false);
      } catch (err) {
        setWikiLoadError(err.message || 'Failed to load wiki page');
        setWikiContent('');
      } finally {
        setIsLoadingWiki(false);
      }
    };

    loadWikiContent();
  }, [novelPath, selectedSlug]);

  useEffect(() => {
    if (!selectedSlug || !novelPath) {
      return;
    }

    if (!isDirty) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        setIsSavingWiki(true);
        await wikiHandlers.update(novelPath, selectedSlug, wikiContent);
        setIsDirty(false);
        setLastSavedAt(new Date());
      } catch (err) {
        setWikiLoadError(err.message || 'Failed to autosave wiki page');
      } finally {
        setIsSavingWiki(false);
      }
    }, 800);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isDirty, novelPath, selectedSlug, wikiContent]);

  const handleWikiContentChange = (e) => {
    setWikiContent(e.target.value);
    setIsDirty(true);
  };

  const handleSaveWiki = async () => {
    if (!selectedSlug || !novelPath) {
      return;
    }

    try {
      setIsSavingWiki(true);
      setWikiLoadError(null);
      await wikiHandlers.update(novelPath, selectedSlug, wikiContent);
      setIsDirty(false);
      setLastSavedAt(new Date());
    } catch (err) {
      setWikiLoadError(err.message || 'Failed to save wiki page');
    } finally {
      setIsSavingWiki(false);
    }
  };

  return (
    <div className="sidebar-inner">
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3>Wiki</h3>
          <button
            type="button"
            className="btn"
            data-testid="wiki-create-button"
            onClick={handleCreateToggle}
            disabled={isCreating || loading}
            aria-label="Create wiki page"
            title="Create wiki page"
          >
            +
          </button>
        </div>
        {showCreateForm && (
          <form className="wiki-create-form" onSubmit={handleCreateSubmit}>
            <input
              type="text"
              className="wiki-create-input"
              placeholder="New wiki page title"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                setCreateError(null);
              }}
              disabled={isCreating}
              aria-label="New wiki page title"
            />
            {createError && <div className="error-message">{createError}</div>}
            <div className="wiki-create-actions">
              <button type="button" className="btn" onClick={handleCreateToggle} disabled={isCreating}>Cancel</button>
              <button type="submit" className="btn primary" disabled={isCreating || !newTitle.trim()}>
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        )}
        {error && <div className="error-message">Error loading wiki pages</div>}
        <WikiPageList 
          pages={pages}
          selectedSlug={selectedSlug}
          onSelectPage={handleSelectPage}
          onDeletePage={handleDeletePage}
          onSearch={handleSearch}
          isLoading={loading}
        />
        <div className="wiki-editor">
          <div className="wiki-editor-header">
            <h4>Wiki Editor</h4>
            <div className="wiki-editor-actions">
              {lastSavedAt && (
                <span className="wiki-editor-status">Saved {lastSavedAt.toLocaleTimeString()}</span>
              )}
              <button
                type="button"
                className="btn primary"
                onClick={handleSaveWiki}
                disabled={!selectedSlug || isSavingWiki || !isDirty}
                data-testid="wiki-save-button"
              >
                {isSavingWiki ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          {wikiLoadError && <div className="error-message">{wikiLoadError}</div>}
          <textarea
            className="wiki-editor-textarea"
            placeholder={selectedSlug ? 'Write your wiki content...' : 'Select a wiki page to edit'}
            value={wikiContent}
            onChange={handleWikiContentChange}
            disabled={!selectedSlug || isLoadingWiki}
            rows={10}
            data-testid="wiki-editor"
          />
        </div>
      </div>
      <div className="sidebar-section">
        <button className="btn">Export PDF</button>
      </div>
      <div className="sidebar-section muted">
        <h3>Sync Status</h3>
        <div>Last synced: 2h ago</div>
        <div className="conflict-note">No conflicts</div>
      </div>
    </div>
  )
}

