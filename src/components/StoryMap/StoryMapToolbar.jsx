import React from 'react';

export function StoryMapToolbar({ onAddScene, onShowHelp, children }) {
  return (
    <div className="storymap-toolbar" role="toolbar" aria-label="Story map actions">
      <div className="storymap-toolbar-slot" data-slot="start">
        <button
          type="button"
          className="btn primary btn-sm"
          data-testid="storymap-add-scene-button"
          onClick={onAddScene}
        >
          Add Scene
        </button>
      </div>
      <div className="storymap-toolbar-slot" data-slot="view">
        {/* Epic 2 view controls will mount here */}
      </div>
      <div className="storymap-toolbar-slot" data-slot="arc">
        {/* Epic 3 arc controls will mount here */}
      </div>
      <div className="storymap-toolbar-slot" data-slot="end">
        {children}
        <button
          type="button"
          className="btn ghost btn-sm"
          data-testid="storymap-help-button"
          aria-label="Keyboard shortcuts"
          onClick={onShowHelp}
        >
          ?
        </button>
      </div>
    </div>
  );
}
