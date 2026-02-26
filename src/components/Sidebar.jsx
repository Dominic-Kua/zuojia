import React, { useState, useCallback } from 'react'
import WikiPageList from './WikiSidebar/WikiPageList'
import { useWikiPages } from '../hooks/useWikiPages'

export default function Sidebar({ novelPath }){
  const { pages, loading, error, deletePage, search } = useWikiPages(novelPath);
  const [selectedSlug, setSelectedSlug] = useState(null);

  const handleSelectPage = useCallback((slug) => {
    setSelectedSlug(slug);
    // TODO: Store selectedSlug in App state and update manuscript view
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

  return (
    <div className="sidebar-inner">
      <div className="sidebar-section">
        <h3>Wiki</h3>
        {error && <div className="error-message">Error loading wiki pages</div>}
        <WikiPageList 
          pages={pages}
          selectedSlug={selectedSlug}
          onSelectPage={handleSelectPage}
          onDeletePage={handleDeletePage}
          onSearch={handleSearch}
          isLoading={loading}
        />
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

