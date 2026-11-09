import React, { useEffect, useRef, useState } from 'react';
import { createWikiLink } from '../../lib/wiki-link';
import { WikiNotesRenderer } from './WikiNotesRenderer';

export function SceneNotesPanel({
  scene,
  chapters = [],
  wikiPages = [],
  isCurrent,
  onMarkCurrent,
  onChange,
  onClose,
  onOpenWikiPage,
  onOpenChapter,
}) {
  const panelRef = useRef(null);
  const charactersInputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

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

  const filteredPages = (wikiPages || [])
    .filter((page) => {
      const q = query.trim().toLowerCase();
      if (!q) return false;
      return page.title.toLowerCase().includes(q) || page.slug.toLowerCase().includes(q);
    })
    .slice(0, 8);

  function handleCharactersChange(event) {
    const value = event.target.value;
    updateField('characters', value);
    setQuery(value);
    setShowDropdown(true);
    setHighlightedIndex(0);
  }

  function insertWikiLink(page) {
    const linkText = createWikiLink(page.slug, page.title);
    const currentNotes = scene.notes || '';
    const separator = currentNotes.length > 0 && !currentNotes.endsWith(' ') ? ' ' : '';
    updateField('notes', `${currentNotes}${separator}${linkText}`);
    setQuery('');
    setShowDropdown(false);
    if (charactersInputRef.current) {
      charactersInputRef.current.focus();
    }
  }

  function handleCharactersKeyDown(event) {
    if (!showDropdown || filteredPages.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((i) => (i + 1) % filteredPages.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((i) => (i - 1 + filteredPages.length) % filteredPages.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      insertWikiLink(filteredPages[highlightedIndex]);
    } else if (event.key === 'Escape') {
      setShowDropdown(false);
    }
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
          <span>Draft chapter</span>
          <select value={scene.chapterId || ''} onChange={handleChapterChange} data-testid="scene-chapter-select">
            <option value="">Unassigned</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.title}
              </option>
            ))}
          </select>
        </label>
        {scene.chapterId && typeof onOpenChapter === 'function' && (
          <button
            type="button"
            className="btn ghost btn-sm"
            data-testid="scene-open-draft"
            onClick={() => onOpenChapter(scene.chapterId)}
          >
            Open draft in manuscript
          </button>
        )}
        <label>
          <span>Location</span>
          <input
            type="text"
            value={scene.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder="Where does this scene happen?"
          />
        </label>
        <label className="scene-notes-characters-wrap">
          <span>Characters</span>
          <input
            ref={charactersInputRef}
            type="text"
            value={scene.characters}
            onChange={handleCharactersChange}
            onKeyDown={handleCharactersKeyDown}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Who appears in this scene?"
            data-testid="scene-characters-input"
          />
          {showDropdown && filteredPages.length > 0 && (
            <ul className="scene-notes-wiki-dropdown" role="listbox" data-testid="scene-wiki-dropdown">
              {filteredPages.map((page, index) => (
                <li
                  key={page.slug}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  className={index === highlightedIndex ? 'highlighted' : ''}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertWikiLink(page);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {page.title}
                </li>
              ))}
            </ul>
          )}
        </label>
        <label>
          <span>POV</span>
          <input
            type="text"
            value={scene.pov || ''}
            onChange={(event) => updateField('pov', event.target.value)}
            placeholder="Point of view character"
            data-testid="scene-pov-input"
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={scene.status || 'planned'}
            onChange={(event) => updateField('status', event.target.value)}
            data-testid="scene-status-select"
          >
            <option value="planned">Planned</option>
            <option value="drafting">Drafting</option>
            <option value="revised">Revised</option>
            <option value="done">Done</option>
          </select>
        </label>
        <label>
          <span>Scene goal</span>
          <input
            type="text"
            value={scene.sceneGoal || ''}
            onChange={(event) => updateField('sceneGoal', event.target.value)}
            placeholder="What should this scene accomplish?"
            data-testid="scene-goal-input"
          />
        </label>
        <label>
          <span>Tension</span>
          <input
            type="text"
            value={scene.tension}
            onChange={(event) => updateField('tension', event.target.value)}
            placeholder="What issue does this scene resolve, create, or explore?"
          />
        </label>
        <label>
          <span>Notes</span>
          <textarea
            value={scene.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Anything else about this scene..."
            rows={5}
          />
          <WikiNotesRenderer
            text={scene.notes}
            wikiPages={wikiPages}
            onOpenWikiPage={onOpenWikiPage}
          />
        </label>
      </div>
    </div>
  );
}
