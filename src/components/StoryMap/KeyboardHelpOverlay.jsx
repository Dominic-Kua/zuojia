import React, { useEffect } from 'react';

const SHORTCUTS = [
  { key: 'n', description: 'Add a new scene at the center of the view' },
  { key: 'Esc', description: 'Close the topmost panel or modal' },
  { key: 'Delete / Backspace', description: 'Remove the selected scene (with confirmation)' },
  { key: '?', description: 'Show this keyboard shortcut help' },
];

export function KeyboardHelpOverlay({ onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="storymap-overlay-backdrop"
      role="dialog"
      aria-label="Keyboard shortcuts"
      data-testid="keyboard-help-overlay"
      onClick={onClose}
    >
      <div className="storymap-overlay-content" onClick={(e) => e.stopPropagation()}>
        <div className="storymap-overlay-header">
          <h3>Keyboard Shortcuts</h3>
          <button
            type="button"
            className="btn ghost btn-sm"
            aria-label="Close help"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <dl className="storymap-shortcut-list">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.key} className="storymap-shortcut-row">
              <dt>{shortcut.key}</dt>
              <dd>{shortcut.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
