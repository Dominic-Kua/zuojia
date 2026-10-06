import React from 'react';

export function StoryMapToolbar({ onAddScene, onShowHelp, viewControls, arcControls }) {
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
        {viewControls}
      </div>
      <div className="storymap-toolbar-slot" data-slot="arc">
        {arcControls}
      </div>
      <div className="storymap-toolbar-slot" data-slot="end">
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
