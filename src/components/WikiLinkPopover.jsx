import React from 'react';
import './WikiLinkPopover.css';

/**
 * Popover component for wiki link interactions
 * Shows disambiguations, link previews, and create dialogs
 */
export function WikiLinkPopover({
  type, // 'preview' | 'disambiguation' | 'create'
  position, // { x, y }
  data, // Content specific to type
  onSelectPage, // (page) => void
  onCreatePage, // (title) => void
  onClose, // () => void
}) {
  if (!type || !position) {
    return null;
  }

  const style = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 1000,
  };

  return (
    <div className="wiki-link-popover" style={style} data-type={type} data-testid="wiki-link-popover">      {type === 'preview' && (
        <div className="popover-content preview" data-testid="wiki-link-preview">
          <div className="preview-title">{data.title}</div>
          <div className="preview-text">{data.preview}</div>
        </div>
      )}

      {type === 'disambiguation' && (
        <div className="popover-content disambiguation" data-testid="wiki-link-disambiguation">
          <div className="popover-header">Which page?</div>
          <ul className="disambiguation-list" data-testid="disambiguation-list">
            {data.options.map((page) => (
              <li key={page.slug} onClick={() => onSelectPage(page)}>
                {page.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {type === 'create' && (
        <div className="popover-content create" data-testid="wiki-link-create-dialog">
          <div className="popover-header">Create "{data.target}"?</div>
          <div className="popover-actions">
            <button className="btn-primary" onClick={() => onCreatePage(data.target)} data-testid="create-wiki-button">
              Create
            </button>
            <button className="btn-secondary" onClick={onClose} data-testid="cancel-create-button">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
