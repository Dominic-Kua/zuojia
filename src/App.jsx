import React, { useState } from 'react'
import Manuscript from './components/Manuscript'
import Sidebar from './components/Sidebar'
import { NovelSelector } from './components/Navigation/NovelSelector'
import { gitHandlers } from './lib/ipc-client'

export default function App(){
  const [novelPath, setNovelPath] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

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
        <section className="manuscript" data-testid="manuscript-section"><Manuscript novelPath={novelPath} /></section>
        <aside className="sidebar" data-testid="sidebar-section"><Sidebar novelPath={novelPath} /></aside>
      </main>
    </div>
  )
}
