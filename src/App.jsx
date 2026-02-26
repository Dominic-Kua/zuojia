import React, { useState } from 'react'
import Manuscript from './components/Manuscript'
import Sidebar from './components/Sidebar'
import { NovelSelector } from './components/Navigation/NovelSelector'

export default function App(){
  const [novelPath, setNovelPath] = useState(null);

  const handleNovelCreated = (path) => {
    setNovelPath(path);
  };

  const handleNovelOpened = (path) => {
    setNovelPath(path);
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
          <button className="btn ghost" data-testid="snapshot-button">Snapshot</button>
          <button className="btn primary" data-testid="push-button">Push</button>
        </div>
      </header>
      <main className="main-grid">
        <section className="manuscript" data-testid="manuscript-section"><Manuscript /></section>
        <aside className="sidebar" data-testid="sidebar-section"><Sidebar novelPath={novelPath} /></aside>
      </main>
    </div>
  )
}
