import React, { useState, useRef, useCallback, useEffect } from 'react'
import Manuscript from './components/Manuscript'
import Sidebar from './components/Sidebar'
import { NovelSelector } from './components/Navigation/NovelSelector'
import { gitHandlers } from './lib/ipc-client'
import { useWikiPages } from './hooks/useWikiPages'

export default function App(){
  const [novelPath, setNovelPath] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [wikiPageToOpen, setWikiPageToOpen] = useState(null);
  const sidebarRef = useRef(null);
  const wikiPageTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (wikiPageTimeoutRef.current !== null) {
        clearTimeout(wikiPageTimeoutRef.current);
      }
    };
  }, []);

  // Get wiki pages for the manuscript component
  const { pages: wikiPages } = useWikiPages(novelPath);

  const handleNovelCreated = (path) => {
    setNovelPath(path);
  };

  const handleNovelOpened = (path) => {
    setNovelPath(path);
  };

  const handleCloseNovel = () => {
    setNovelPath(null);
  };

  const handleBackup = async () => {
    if (!novelPath || isBackingUp) {
      return;
    }

    setIsBackingUp(true);
    try {
      await gitHandlers.push(novelPath);
    } catch (error) {
      console.error('Backup failed:', error);
      window.alert(error?.message || 'Backup failed. Check the console for details.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Handle opening a wiki page from the manuscript
  const handleOpenWikiPage = useCallback((slug) => {
    if (wikiPageTimeoutRef.current !== null) {
      clearTimeout(wikiPageTimeoutRef.current);
    }
    setWikiPageToOpen(slug);
    // Reset after a brief moment to allow Sidebar to detect the change
    wikiPageTimeoutRef.current = setTimeout(() => {
      setWikiPageToOpen(null);
      wikiPageTimeoutRef.current = null;
    }, 100);
  }, []);

  // Show novel selector if no novel is loaded
  if (!novelPath) {
    return (
      <div className="app-shell" data-testid="app-shell">
        <header className="topbar" data-testid="topbar">
          <div className="brand">Netwriter</div>
        </header>
        <main className="main-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <NovelSelector 
            onNovelCreated={handleNovelCreated}
            onNovelOpened={handleNovelOpened}
          />
        </main>
      </div>
    );
  }

  // Show main editor interface when novel is loaded
  return (
    <div className="app-shell" data-testid="app-shell">
      <header className="topbar" data-testid="topbar">
        <div className="brand">Netwriter</div>
        <div className="top-actions">
          <button className="btn ghost" data-testid="close-novel-button" onClick={handleCloseNovel}>Close Novel</button>
          <button className="btn primary" data-testid="push-button" onClick={handleBackup} disabled={isBackingUp}>
            {isBackingUp ? 'Backing up...' : 'Backup'}
          </button>
        </div>
      </header>
      <main className="main-grid">
        <section className="manuscript" data-testid="manuscript-section">
          <Manuscript 
            novelPath={novelPath} 
            wikiPages={wikiPages} 
            onOpenWikiPage={handleOpenWikiPage}
          />
        </section>
        <aside className="sidebar" data-testid="sidebar-section">
          <Sidebar 
            ref={sidebarRef}
            novelPath={novelPath} 
            openPageSlug={wikiPageToOpen}
          />
        </aside>
      </main>
    </div>
  )
}
