/**
 * WikiPageList component
 * Displays a list of wiki pages with search and delete functionality
 */

import React, { useState, useMemo } from 'react';
import './WikiPageList.css';

/**
 * WikiPageList component
 * @param {Object} props
 * @param {Array} props.pages - Array of wiki pages
 * @param {string} props.selectedSlug - Currently selected page slug
 * @param {Function} props.onSelectPage - Callback when page is selected
 * @param {Function} props.onDeletePage - Callback when page is deleted
 * @param {Function} props.onSearch - Callback when search query changes
 * @param {boolean} props.isLoading - Whether pages are loading
 */
function WikiPageList({
  pages = [],
  selectedSlug = null,
  onSelectPage = () => {},
  onDeletePage = () => {},
  onSearch = () => {},
  isLoading = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Filter pages based on search query
  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) {
      return pages;
    }

    const q = searchQuery.toLowerCase();
    return pages.filter((page) => {
      return page.title.toLowerCase().includes(q) || page.slug.toLowerCase().includes(q);
    });
  }, [pages, searchQuery]);

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  // Handle page selection
  const handleSelectPage = (slug) => {
    onSelectPage(slug);
  };

  // Handle delete button click
  const handleDeleteClick = (slug, e) => {
    e.stopPropagation();
    setDeleteConfirm(slug);
  };

  // Handle delete confirmation
  const handleConfirmDelete = (slug, e) => {
    e.stopPropagation();
    setDeleteConfirm(null);
    onDeletePage(slug);
  };

  // Handle delete cancellation
  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setDeleteConfirm(null);
  };

  // Format word count with commas
  const formatWordCount = (count) => {
    return count.toLocaleString();
  };

  // Format last modified date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    if (diffMs < 0) return date.toLocaleDateString();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="wiki-page-list loading">
        <div role="progressbar" className="spinner"></div>
        <p>Loading wiki pages...</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="wiki-page-list empty">
        <p>No wiki pages yet</p>
        <p className="empty-hint">Click the "+" button to create your first wiki page</p>
      </div>
    );
  }

  return (
    <div className="wiki-page-list">
      <div className="wiki-search">
        <input
          type="text"
          placeholder="Search wiki pages..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="wiki-search-input"
          aria-label="Search wiki pages"
        />
      </div>

      {filteredPages.length === 0 ? (
        <div className="wiki-no-results">
          <p>No wiki pages match "{searchQuery}"</p>
        </div>
      ) : (
        <ul className="wiki-pages-list" role="list">
          {filteredPages.map((page) => (
            <li
              key={page.slug}
              className={`wiki-page-item ${selectedSlug === page.slug ? 'selected' : ''}`}
              role="listitem"
            >
              <button
                className="wiki-page-button"
                onClick={() => handleSelectPage(page.slug)}
                aria-label={`Select ${page.title}`}
              >
                <div className="wiki-page-content">
                  <div className="wiki-page-title">{page.title}</div>
                  <div className="wiki-page-meta">
                    <span className="wiki-page-wordcount">{formatWordCount(page.wordCount)} words</span>
                    <span className="wiki-page-modified">{formatDate(page.lastModified)}</span>
                  </div>
                </div>
              </button>

              {deleteConfirm !== page.slug && (
                <button
                  className="wiki-delete-icon"
                  onClick={(e) => handleDeleteClick(page.slug, e)}
                  aria-label={`Delete ${page.title}`}
                  title="Delete page"
                >
                  ✕
                </button>
              )}

              {deleteConfirm === page.slug && (
                <div
                  className="wiki-delete-confirm"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-label={`Confirm delete ${page.title}`}
                >
                  <p>Delete "{page.title}"?</p>
                  <div className="wiki-confirm-buttons">
                    <button
                      className="wiki-confirm-btn wiki-cancel"
                      onClick={handleCancelDelete}
                      aria-label="Cancel delete"
                    >
                      Cancel
                    </button>
                    <button
                      className="wiki-confirm-btn wiki-delete"
                      onClick={(e) => handleConfirmDelete(page.slug, e)}
                      aria-label="Confirm delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default WikiPageList;
