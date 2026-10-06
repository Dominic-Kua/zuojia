import React from 'react';

export function EmptyCanvasState({ onAddScene }) {
  return (
    <div className="storymap-empty-state" data-testid="storymap-empty-state">
      <p>No scenes yet. Drop your first idea here.</p>
      <button
        type="button"
        className="btn primary btn-sm"
        data-testid="empty-add-scene-button"
        onClick={onAddScene}
      >
        Add Scene
      </button>
    </div>
  );
}
