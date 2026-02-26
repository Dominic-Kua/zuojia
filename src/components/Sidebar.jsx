import React, { useState, useCallback, useEffect, useRef } from 'react'
import WikiPageList from './WikiSidebar/WikiPageList'
import { useWikiPages } from '../hooks/useWikiPages'
import { wikiHandlers } from '../lib/ipc-client'
import { resolveSlug } from '../lib/wiki-link-parser'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const escapeHtml = (value) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
};

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
  const [isPreviewMode, setIsPreviewMode] = useState(true);

  const buildAssetUrl = useCallback((fileName) => {
    const trimmed = fileName.trim();
    if (!trimmed || !novelPath) {
      return '';
    }

    if (/^(https?:)?\/\//i.test(trimmed)) {
      return trimmed;
    }

    const normalizedPath = trimmed.replace(/\\/g, '/');
    const basePath = novelPath.replace(/\\/g, '/');
    return `file://${basePath}/wiki/${encodeURI(normalizedPath)}`;
  }, [novelPath]);

  const renderWikiContent = useCallback((rawContent) => {
    if (!rawContent) {
      return '<p>No content yet.</p>';
    }
    let markdown = rawContent;

    // Obsidian-style embeds: ![[image.png|Caption]]
    markdown = markdown.replace(/!\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, file, _, caption) => {
      const src = buildAssetUrl(file);
      const safeCaption = caption ? escapeHtml(caption.trim()) : '';
      const alt = safeCaption || escapeHtml(file.trim());
      return `<figure class="wiki-embed"><img src="${src}" alt="${alt}" />${safeCaption ? `<figcaption class="wiki-embed-caption">${safeCaption}</figcaption>` : ''}</figure>`;
    });

    // MediaWiki-style files: [[File:name|Caption]] or [[Image:name|Caption]]
    markdown = markdown.replace(/\[\[(file|image):([^\]|]+)(\|([^\]]+))?\]\]/gi, (match, _type, file, _, caption) => {
      const src = buildAssetUrl(file);
      const safeCaption = caption ? escapeHtml(caption.trim()) : '';
      const alt = safeCaption || escapeHtml(file.trim());
      return `<figure class="wiki-embed"><img src="${src}" alt="${alt}" />${safeCaption ? `<figcaption class="wiki-embed-caption">${safeCaption}</figcaption>` : ''}</figure>`;
    });

    // Wiki links: [[Page]] or [[Page|Label]]
    markdown = markdown.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, page, _, label) => {
      const pageName = page.trim();
      if (!pageName) {
        return match;
      }
      const displayText = (label || pageName).trim();
      const slug = resolveSlug(pageName);
      return `<a href="#" class="wiki-link" data-wiki-link="${slug}">${escapeHtml(displayText)}</a>`;
    });

    const html = marked.parse(markdown, {
      breaks: true,
      gfm: true,
    });

    return DOMPurify.sanitize(html, {
      ADD_ATTR: ['data-wiki-link'],
      ADD_TAGS: ['figure', 'figcaption'],
    });
  }, [buildAssetUrl]);

  const handleSelectPage = useCallback((slug) => {
    setSelectedSlug(slug);
    setIsPreviewMode(true);
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
        setIsPreviewMode(true);
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

  const handlePreviewClick = (event) => {
    const link = event.target.closest('[data-wiki-link]');
    if (!link) {
      return;
    }

    event.preventDefault();
    const slug = link.getAttribute('data-wiki-link');
    if (!slug) {
      return;
    }

    const page = pages.find((item) => item.slug === slug);
    if (!page) {
      setWikiLoadError('Wiki page not found');
      return;
    }

    setSelectedSlug(slug);
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
              <div className="wiki-view-toggle" role="tablist" aria-label="Wiki view mode">
                <button
                  type="button"
                  className={`btn ghost ${isPreviewMode ? 'active' : ''}`}
                  onClick={() => setIsPreviewMode(true)}
                  disabled={!selectedSlug}
                >
                  Preview
                </button>
                <button
                  type="button"
                  className={`btn ghost ${!isPreviewMode ? 'active' : ''}`}
                  onClick={() => setIsPreviewMode(false)}
                  disabled={!selectedSlug}
                >
                  Edit
                </button>
              </div>
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
          {!isPreviewMode && (
            <textarea
              className="wiki-editor-textarea"
              placeholder={selectedSlug ? 'Write your wiki content...' : 'Select a wiki page to edit'}
              value={wikiContent}
              onChange={handleWikiContentChange}
              disabled={!selectedSlug || isLoadingWiki}
              rows={12}
              data-testid="wiki-editor"
            />
          )}
          {isPreviewMode && (
            <div className="wiki-preview">
              <div className="wiki-preview-header">Preview</div>
              <div
                className="wiki-preview-body markdown-body"
                data-testid="wiki-preview"
                onClick={handlePreviewClick}
                dangerouslySetInnerHTML={{ __html: renderWikiContent(wikiContent) }}
              />
            </div>
          )}
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

