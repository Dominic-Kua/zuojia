import React, { useState } from 'react';
import { ARC_COLORS, getChapterColor } from '../../lib/storymap-model';

export function ArcManagementModal({
  arc,
  arcs,
  scenes,
  assignments,
  onClose,
  onRename,
  onDelete,
  onMerge,
  onSplit,
  onChangeColor,
}) {
  const [mode, setMode] = useState('rename');
  const [name, setName] = useState(arc.name);
  const [targetArcId, setTargetArcId] = useState('');
  const [splitSceneIds, setSplitSceneIds] = useState([]);
  const [splitName, setSplitName] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const arcScenes = assignments
    .filter((a) => a.arcId === arc.id)
    .map((a) => scenes.find((s) => s.id === a.sceneId))
    .filter(Boolean);

  function handleRename(event) {
    event.preventDefault();
    if (!name.trim()) return;
    onRename(arc.id, name.trim());
    onClose();
  }

  function handleMerge(event) {
    event.preventDefault();
    if (!targetArcId || targetArcId === arc.id) return;
    onMerge(arc.id, targetArcId);
    onClose();
  }

  function handleSplit(event) {
    event.preventDefault();
    if (splitSceneIds.length === 0 || !splitName.trim()) return;
    onSplit(arc.id, splitSceneIds, splitName.trim());
    onClose();
  }

  function handleDelete() {
    setConfirmingDelete(true);
  }

  function confirmDelete() {
    onDelete(arc.id);
    onClose();
  }

  const otherArcs = arcs.filter((a) => a.id !== arc.id);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Manage arc" data-testid="arc-management-modal">
      <div className="arc-management-modal">
        <div className="modal-header">
          <h3>Manage Arc: {arc.name}</h3>
          <button type="button" className="btn ghost btn-sm" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-tabs">
          <button type="button" className={`btn btn-sm ${mode === 'rename' ? 'primary' : 'ghost'}`} onClick={() => setMode('rename')}>
            Rename
          </button>
          <button type="button" className={`btn btn-sm ${mode === 'color' ? 'primary' : 'ghost'}`} onClick={() => setMode('color')}>
            Color
          </button>
          <button type="button" className={`btn btn-sm ${mode === 'merge' ? 'primary' : 'ghost'}`} onClick={() => setMode('merge')}>
            Merge
          </button>
          <button type="button" className={`btn btn-sm ${mode === 'split' ? 'primary' : 'ghost'}`} onClick={() => setMode('split')}>
            Split
          </button>
        </div>
        <div className="modal-body">
          {mode === 'rename' && (
            <form onSubmit={handleRename}>
              <label>
                Name
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <div className="modal-actions">
                <button type="submit" className="btn primary btn-sm" data-testid="arc-rename-submit">Rename</button>
                <button type="button" className="btn ghost btn-sm" onClick={onClose}>Cancel</button>
              </div>
            </form>
          )}
          {mode === 'color' && (
            <div className="arc-color-grid">
              {ARC_COLORS.map((color, index) => (
                <button
                  key={index}
                  type="button"
                  className="arc-color-option"
                  style={{ backgroundColor: getChapterColor({ color }) }}
                  aria-label={`Color ${index + 1}`}
                  onClick={() => {
                    onChangeColor(arc.id, color);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
          {mode === 'merge' && (
            <form onSubmit={handleMerge}>
              <label>
                Merge into
                <select value={targetArcId} onChange={(e) => setTargetArcId(e.target.value)}>
                  <option value="">Choose arc</option>
                  {otherArcs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-actions">
                <button type="submit" className="btn primary btn-sm" disabled={!targetArcId}>Merge</button>
                <button type="button" className="btn ghost btn-sm" onClick={onClose}>Cancel</button>
              </div>
            </form>
          )}
          {mode === 'split' && (
            <form onSubmit={handleSplit}>
              <label>
                New arc name
                <input type="text" value={splitName} onChange={(e) => setSplitName(e.target.value)} />
              </label>
              <fieldset>
                <legend>Scenes to move</legend>
                {arcScenes.map((scene) => (
                  <label key={scene.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={splitSceneIds.includes(scene.id)}
                      onChange={(e) => {
                        setSplitSceneIds((ids) =>
                          e.target.checked ? [...ids, scene.id] : ids.filter((id) => id !== scene.id)
                        );
                      }}
                    />
                    {scene.title}
                  </label>
                ))}
              </fieldset>
              <div className="modal-actions">
                <button type="submit" className="btn primary btn-sm" disabled={splitSceneIds.length === 0 || !splitName.trim()}>
                  Split
                </button>
                <button type="button" className="btn ghost btn-sm" onClick={onClose}>Cancel</button>
              </div>
            </form>
          )}
        </div>
        <div className="modal-footer">
          {confirmingDelete ? (
            <div className="arc-delete-confirm" role="group" aria-label={`Confirm delete ${arc.name}`}>
              <span>Delete this arc? Its scenes will remain.</span>
              <button type="button" className="btn danger btn-sm" data-testid="arc-delete-confirm" onClick={confirmDelete}>
                Confirm Delete
              </button>
              <button type="button" className="btn ghost btn-sm" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="btn danger btn-sm" onClick={handleDelete}>
              Delete Arc
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
