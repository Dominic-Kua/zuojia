import React from 'react'
import Manuscript from './components/Manuscript'
import Sidebar from './components/Sidebar'

export default function App(){
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Netwriter</div>
        <div className="top-actions">
          <button className="btn ghost">Snapshot</button>
          <button className="btn primary">Push</button>
        </div>
      </header>
      <main className="main-grid">
        <section className="manuscript"><Manuscript /></section>
        <aside className="sidebar"><Sidebar /></aside>
      </main>
    </div>
  )
}
