import React, { useEffect, useRef } from 'react';
import { CHAPTER_COLORS, createChapter } from '../../lib/storymap-model';

const TENSION_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'unresolved', label: 'Unresolved' },
];

export function SceneNotesPanel({ scene, chapters = [], isCurrent, onMarkCurrent, onChange, onClose, onCreateChapter }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    function handlePointerDown(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  function updateField(field, value) {
    onChange({ ...scene, [field]: value });
  }

  function handleChapterChange(event) {
    const chapterId = event.target.value || null;
    onChange({ ...scene, chapterId });
  }

  function handleCreateChapter() {
    if (chapters.length >= CHAPTER_COLORS.length) {
      window.alert(`You can create up to ${CHAPTER_COLORS.length} chapters.`);
      return;
    }
    const title = window.prompt('Chapter title:');
    if (!title) return;
    onCreateChapter(title);
  }

  return (
    <div
      ref={panelRef}
      className="scene-notes-panel"
      role="dialog"
      aria-label={`Notes for ${scene.title}`}
      data-testid="scene-notes-panel"
    >
      <div className="scene-notes-header">
        <h3>{scene.title}</h3>
        <button
          type="button"
          className="btn ghost btn-sm"
          aria-label="Close scene notes"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="scene-notes-fields">
        <button
          type="button"
          className="btn secondary btn-sm"
          aria-pressed={isCurrent}
          onClick={onMarkCurrent}
        >
          {isCurrent ? 'Current scene' : 'Mark as current'}
        </button>
        <label>
          <span>Chapter</span>
          <div className="scene-notes-chapter-row">
            <select value={scene.chapterId || ''} onChange={handleChapterChange}>
              <option value="">Unassigned</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn ghost btn-sm"
              onClick={handleCreateChapter}
              disabled={chapters.length >= CHAPTER_COLORS.length}
            >
              +
            </button>
          </div>
        </label>
        <label>
          <span>Location</span>
          <input
            type="text"
            value={scene.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder="Where does this scene happen?"
          />
        </label>
        <label>
          <span>Characters</span>
          <input
            type="text"
            value={scene.characters}
            onChange={(e) => updateField('characters', e.target.value)}
            placeholder="Who appears in this scene?"
          />
        </label>
        <label>
          <span>Tension</span>
          <select
            value={scene.tension}
            onChange={(e) => updateField('tension', e.target.value)}
          >
            {TENSION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Notes</span>
          <textarea
            value={scene.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Anything else about this scene..."
            rows={5}
          />
        </label>
      </div>
    </div>
  );
}
