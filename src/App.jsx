import React, { useState, useRef, useCallback, useEffect } from 'react'
import Manuscript from './components/Manuscript'
import Sidebar from './components/Sidebar'
import { CommitButton } from './components/CommitButton'
import { ExportDialog } from './components/ExportDialog'
import { NovelSelector } from './components/Navigation/NovelSelector'
import { PushButton } from './components/PushButton'
import { SettingsModal } from './components/SettingsModal'
import { DiagnosticsPanel } from './components/DiagnosticsPanel'
import { SnapshotButton } from './components/SnapshotButton'
import { useWikiPages } from './hooks/useWikiPages'

export default function App(){
  const [novelPath, setNovelPath] = useState(null);
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
  const { pages: wikiPages, refresh: refreshWikiPages } = useWikiPages(novelPath);

  const [restoreKey, setRestoreKey] = useState(0);

  const handleRestored = useCallback(() => {
    setRestoreKey((k) => k + 1);
  }, []);

  const handleNovelCreated = (path) => {
    setNovelPath(path);
  };

  const handleNovelOpened = (path) => {
    setNovelPath(path);
  };

  const handleCloseNovel = () => {
    setNovelPath(null);
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
          <div className="brand">作家</div>
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
        <div className="brand">作家</div>
        <div className="top-actions">
          <ExportDialog novelPath={novelPath} />
          <SnapshotButton novelPath={novelPath} />
          <CommitButton novelPath={novelPath} />
          <PushButton novelPath={novelPath} />
          <DiagnosticsPanel novelPath={novelPath} onIndexRebuilt={refreshWikiPages} onRestored={handleRestored} />
          <SettingsModal novelPath={novelPath} />
          <button className="btn ghost" data-testid="close-novel-button" onClick={handleCloseNovel}>Close Novel</button>
        </div>
      </header>
      <main className="main-grid">
        <section className="manuscript" data-testid="manuscript-section">
          <Manuscript 
            key={restoreKey}
            novelPath={novelPath} 
            wikiPages={wikiPages} 
            onOpenWikiPage={handleOpenWikiPage}
          />
        </section>
        <aside className="sidebar" data-testid="sidebar-section">
          <Sidebar 
            key={restoreKey}
            ref={sidebarRef}
            novelPath={novelPath} 
            openPageSlug={wikiPageToOpen}
          />
        </aside>
      </main>
    </div>
  )
}
