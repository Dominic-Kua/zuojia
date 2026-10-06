import React from 'react';

export function ViewControls({ view, split, onChangeView, onToggleSplit }) {
  return (
    <div className="storymap-view-controls" role="group" aria-label="View mode">
      <button
        type="button"
        className={`btn btn-sm ${view === 'sequential' ? 'primary' : 'ghost'}`}
        aria-pressed={view === 'sequential'}
        onClick={() => onChangeView('sequential')}
      >
        Sequential
      </button>
      <button
        type="button"
        className={`btn btn-sm ${view === 'temporal' ? 'primary' : 'ghost'}`}
        aria-pressed={view === 'temporal'}
        onClick={() => onChangeView('temporal')}
      >
        Temporal
      </button>
      {view === 'temporal' && (
        <button
          type="button"
          className={`btn btn-sm ${split ? 'primary' : 'ghost'}`}
          aria-pressed={split}
          onClick={onToggleSplit}
        >
          Split
        </button>
      )}
    </div>
  );
}
