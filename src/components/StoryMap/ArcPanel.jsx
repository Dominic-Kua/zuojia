import React, { useState } from 'react';
import { getChapterColor } from '../../lib/storymap-model';

export function ArcPanel({
  arcs,
  sceneArcAssignments = [],
  selectedSceneIds,
  selectedArcId,
  connectionMode,
  onConnectionModeChange,
  onCreateArc,
  onAssignScenes,
  onSelectArc,
  onManageArc,
  onClose,
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedExistingArcId, setSelectedExistingArcId] = useState('');

  function handleCreateArc() {
    const name = window.prompt('Arc name:');
    if (!name || !name.trim()) return;
    onCreateArc(name.trim());
  }

  function handleStartRetroactive() {
    setIsCreating(true);
    setNewName('');
    setSelectedExistingArcId('');
  }

  function handleCancelRetroactive() {
    setIsCreating(false);
    setNewName('');
    setSelectedExistingArcId('');
  }

  function handleConfirmRetroactive() {
    if (selectedExistingArcId) {
      onAssignScenes(selectedExistingArcId, selectedSceneIds);
    } else if (newName.trim()) {
      const existing = arcs.find((a) => a.name.toLowerCase() === newName.trim().toLowerCase());
      if (existing) {
        onAssignScenes(existing.id, selectedSceneIds);
      } else {
        onCreateArc(newName.trim(), selectedSceneIds);
      }
    }
    setIsCreating(false);
    setNewName('');
    setSelectedExistingArcId('');
  }

  function handleAssign(arcId) {
    if (selectedSceneIds.length === 0) return;
    onAssignScenes(arcId, selectedSceneIds);
  }

  return (
    <div className="arc-panel" role="dialog" aria-label="Arc panel" data-testid="arc-panel">
      <div className="arc-panel-header">
        <h3>Arcs</h3>
        <button type="button" className="btn ghost btn-sm" aria-label="Close arc panel" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="arc-panel-actions">
        <button type="button" className="btn primary btn-sm" data-testid="arc-panel-create" onClick={handleCreateArc}>
          New Arc
        </button>
        <button
          type="button"
          className="btn secondary btn-sm"
          data-testid="arc-panel-retroactive"
          disabled={selectedSceneIds.length === 0}
          onClick={handleStartRetroactive}
        >
          Create from Selection
        </button>
      </div>
      <div className="arc-panel-mode" role="group" aria-label="Arc connection mode">
        <button
          type="button"
          className={`btn btn-sm ${connectionMode === 'sequential' ? 'primary' : 'ghost'}`}
          aria-pressed={connectionMode === 'sequential'}
          onClick={() => onConnectionModeChange('sequential')}
        >
          Sequential
        </button>
        <button
          type="button"
          className={`btn btn-sm ${connectionMode === 'chronological' ? 'primary' : 'ghost'}`}
          aria-pressed={connectionMode === 'chronological'}
          onClick={() => onConnectionModeChange('chronological')}
        >
          Chronological
        </button>
      </div>
      {isCreating && (
        <div className="arc-panel-retroactive-form">
          <input
            type="text"
            placeholder="New arc name"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setSelectedExistingArcId('');
            }}
          />
          <select
            value={selectedExistingArcId}
            onChange={(e) => {
              setSelectedExistingArcId(e.target.value);
              setNewName('');
            }}
          >
            <option value="">— or choose existing arc —</option>
            {arcs.map((arc) => (
              <option key={arc.id} value={arc.id}>
                {arc.name}
              </option>
            ))}
          </select>
          <div className="arc-panel-retroactive-actions">
            <button type="button" className="btn primary btn-sm" onClick={handleConfirmRetroactive}>
              Confirm
            </button>
            <button type="button" className="btn ghost btn-sm" onClick={handleCancelRetroactive}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="arc-panel-list">
        {arcs.length === 0 ? (
          <p className="arc-panel-empty">No arcs yet. Select scenes and create one.</p>
        ) : (
          arcs.map((arc) => {
            const assignedCount = sceneArcAssignments.filter((a) => a.arcId === arc.id).length;
            const isSelected = selectedArcId === arc.id;
            return (
              <div
                key={arc.id}
                className={`arc-panel-item ${isSelected ? 'selected' : ''}`}
                data-testid={`arc-panel-item-${arc.id}`}
                onClick={() => onSelectArc(arc.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onManageArc(arc.id);
                }}
              >
                <span
                  className="arc-color-swatch"
                  style={{ backgroundColor: getChapterColor(arc) || '#888' }}
                />
                <span className="arc-name">{arc.name}</span>
                <span className="arc-count">{assignedCount}</span>
                <button
                  type="button"
                  className="btn ghost btn-sm"
                  disabled={selectedSceneIds.length === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAssign(arc.id);
                  }}
                >
                  Assign
                </button>
                {assignedCount === 0 && <span className="arc-wait-caption">It&apos;ll wait.</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
