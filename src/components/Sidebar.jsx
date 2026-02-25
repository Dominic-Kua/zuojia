import React from 'react'

export default function Sidebar(){
  return (
    <div className="sidebar-inner">
      <div className="sidebar-section">
        <h3>Wiki</h3>
        <ul className="wiki-list">
          <li>Characters</li>
          <li>Timeline</li>
          <li>Locations</li>
        </ul>
      </div>
      <div className="sidebar-section">
        <h3>Export</h3>
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
