import React, { useMemo } from 'react';
import { indexHandlers, storymapWindowHandlers } from '../../lib/ipc-client';
import { snapSceneToChapter } from '../../lib/storymap-model';

function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function SceneOutlineView({
  novelPath,
  chapters = [],
  scenes = [],
  currentSceneId,
  onSelectScene,
  onOpenChapter,
  onRefreshChapters,
  updateStorymap,
}) {
  const { grouped, unassigned } = useMemo(() => {
    const byChapter = new Map(chapters.map((c) => [c.id, []]));
    const unassignedScenes = [];
    for (const scene of scenes) {
      const list = scene.chapterId && byChapter.get(scene.chapterId);
      if (list) list.push(scene);
      else unassignedScenes.push(scene);
    }
    return {
      grouped: chapters.map((chapter) => ({ chapter, scenes: byChapter.get(chapter.id) || [] })),
      unassigned: unassignedScenes,
    };
  }, [chapters, scenes]);

  const persistScenes = (nextScenes) => {
    updateStorymap((current) => ({ ...current, scenes: nextScenes }));
  };

  const rebuildSceneOrder = (nextGrouped, nextUnassigned) => {
    const ordered = [];
    for (const { chapter, scenes: chapterScenes } of nextGrouped) {
      for (const scene of chapterScenes) {
        ordered.push(snapSceneToChapter({ ...scene, chapterId: chapter.id }, chapter));
      }
    }
    for (const scene of nextUnassigned) {
      ordered.push({ ...scene, chapterId: null });
    }
    // Include any scenes that somehow disappeared from grouping (defensive).
    const seen = new Set(ordered.map((s) => s.id));
    for (const scene of scenes) {
      if (!seen.has(scene.id)) ordered.push(scene);
    }
    persistScenes(ordered);
  };

  const handleMoveChapter = async (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= chapters.length) return;
    const nextChapters = moveItem(chapters, index, nextIndex);
    const orderedFilenames = nextChapters.map((c) => c.filename || c.id).filter(Boolean);
    try {
      await indexHandlers.setChapterOrder(novelPath, orderedFilenames);
      await storymapWindowHandlers.notifyIndexUpdated(novelPath);
      await onRefreshChapters?.();
    } catch (err) {
      console.error('Failed to reorder chapters:', err);
    }
  };

  const handleMoveScene = (chapterIndex, sceneIndex, direction) => {
    const group = grouped[chapterIndex];
    if (!group) return;
    const nextIndex = sceneIndex + direction;
    if (nextIndex < 0 || nextIndex >= group.scenes.length) return;
    const nextGrouped = grouped.map((g, i) => (
      i === chapterIndex ? { ...g, scenes: moveItem(g.scenes, sceneIndex, nextIndex) } : g
    ));
    rebuildSceneOrder(nextGrouped, unassigned);
  };

  const handleMoveSceneToChapter = (sourceChapterId, sceneId, targetChapterId) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const nextGrouped = grouped.map((g) => ({
      ...g,
      scenes: g.scenes.filter((s) => s.id !== sceneId),
    }));
    const targetGroup = nextGrouped.find((g) => g.chapter.id === targetChapterId);
    if (targetGroup) targetGroup.scenes.push({ ...scene, chapterId: targetChapterId });
    const nextUnassigned = unassigned.filter((s) => s.id !== sceneId);
    if (!targetChapterId) nextUnassigned.push({ ...scene, chapterId: null });
    rebuildSceneOrder(nextGrouped, nextUnassigned);
  };

  const renderSceneRow = (scene, chapterIndex, sceneIndex, chapterScenesLength) => (
    <li key={scene.id} className="scene-outline-scene" data-testid={`outline-scene-${scene.id}`}>
      <button
        type="button"
        className={`scene-outline-scene-btn ${currentSceneId === scene.id ? 'current' : ''}`}
        onClick={() => onSelectScene?.(scene)}
        title={scene.title}
      >
        <span className="scene-outline-scene-title">{scene.title || 'Untitled Scene'}</span>
        <span className="scene-outline-scene-meta">
          {[scene.status, scene.pov].filter(Boolean).join(' · ')}
        </span>
      </button>
      <div className="scene-outline-actions">
        <button type="button" className="btn ghost btn-sm" aria-label={`Move ${scene.title} up`} disabled={sceneIndex === 0} onClick={() => handleMoveScene(chapterIndex, sceneIndex, -1)}>↑</button>
        <button type="button" className="btn ghost btn-sm" aria-label={`Move ${scene.title} down`} disabled={sceneIndex === chapterScenesLength - 1} onClick={() => handleMoveScene(chapterIndex, sceneIndex, 1)}>↓</button>
        {scene.chapterId && (
          <button type="button" className="btn ghost btn-sm" aria-label={`Open draft for ${scene.title}`} onClick={() => onOpenChapter?.(scene.chapterId)}>Open draft</button>
        )}
        <select
          aria-label={`Move ${scene.title} to chapter`}
          value={scene.chapterId || ''}
          onChange={(e) => handleMoveSceneToChapter(scene.chapterId, scene.id, e.target.value || null)}
          data-testid={`outline-scene-chapter-${scene.id}`}
        >
          <option value="">Unassigned</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>
    </li>
  );

  return (
    <div className="scene-outline-view" data-testid="scene-outline-view">
      <p className="scene-outline-help">Reorder chapters and scenes to keep your plan and manuscript structure in sync. Chapter order updates the manuscript; scene assignments update planning metadata.</p>
      {grouped.map(({ chapter, scenes: chapterScenes }, chapterIndex) => (
        <section key={chapter.id} className="scene-outline-chapter" data-testid={`outline-chapter-${chapter.id}`}>
          <header className="scene-outline-chapter-header">
            <div>
              <h3 className="scene-outline-chapter-title">{chapter.title}</h3>
              <div className="scene-outline-chapter-file">{chapter.filename || chapter.id}</div>
            </div>
            <div className="scene-outline-actions">
              <button type="button" className="btn ghost btn-sm" aria-label={`Move chapter ${chapter.title} up`} disabled={chapterIndex === 0} onClick={() => handleMoveChapter(chapterIndex, -1)}>↑</button>
              <button type="button" className="btn ghost btn-sm" aria-label={`Move chapter ${chapter.title} down`} disabled={chapterIndex === grouped.length - 1} onClick={() => handleMoveChapter(chapterIndex, 1)}>↓</button>
              <button type="button" className="btn ghost btn-sm" data-testid={`outline-open-chapter-${chapter.id}`} onClick={() => onOpenChapter?.(chapter.filename || chapter.id)}>Open draft</button>
            </div>
          </header>
          {chapterScenes.length === 0 ? (
            <div className="scene-outline-empty">No scenes assigned to this chapter yet.</div>
          ) : (
            <ul className="scene-outline-scenes">
              {chapterScenes.map((scene, sceneIndex) => renderSceneRow(scene, chapterIndex, sceneIndex, chapterScenes.length))}
            </ul>
          )}
        </section>
      ))}
      <section className="scene-outline-chapter" data-testid="outline-unassigned">
        <header className="scene-outline-chapter-header">
          <h3 className="scene-outline-chapter-title">Unassigned scenes</h3>
        </header>
        {unassigned.length === 0 ? (
          <div className="scene-outline-empty">No unassigned scenes.</div>
        ) : (
          <ul className="scene-outline-scenes">
            {unassigned.map((scene, sceneIndex) => (
              <li key={scene.id} className="scene-outline-scene" data-testid={`outline-scene-${scene.id}`}>
                <button type="button" className="scene-outline-scene-btn" onClick={() => onSelectScene?.(scene)}>
                  <span className="scene-outline-scene-title">{scene.title || 'Untitled Scene'}</span>
                  <span className="scene-outline-scene-meta">{[scene.status, scene.pov].filter(Boolean).join(' · ')}</span>
                </button>
                <div className="scene-outline-actions">
                  <select
                    aria-label={`Move ${scene.title} to chapter`}
                    value=""
                    onChange={(e) => handleMoveSceneToChapter(null, scene.id, e.target.value || null)}
                    data-testid={`outline-scene-chapter-${scene.id}`}
                  >
                    <option value="">Move to chapter…</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
