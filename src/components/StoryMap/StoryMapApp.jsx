import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorymap } from '../../hooks/useStorymap';
import { useWikiPages } from '../../hooks/useWikiPages';
import { storymapWindowHandlers } from '../../lib/ipc-client';
import { createScene, createChapter, createArc, snapSceneToChapter, ARC_COLORS } from '../../lib/storymap-model';
import { screenToWorld } from '../../lib/storymap-canvas/view';
import { applyTheme, getStoredTheme } from '../../lib/theme';
import { StoryMapWindow } from './StoryMapWindow';
import { CanvasView } from './CanvasView';
import { StoryMapToolbar } from './StoryMapToolbar';
import { SceneNotesPanel } from './SceneNotesPanel';
import { KeyboardHelpOverlay } from './KeyboardHelpOverlay';
import { EmptyCanvasState } from './EmptyCanvasState';
import { createSceneLayer } from './layers/SceneLayer';
import { createChapterLayer } from './layers/ChapterLayer';
import { createTemporalSceneLayer } from './layers/TemporalSceneLayer';
import { createTemporalLaneLayer } from './layers/TemporalLaneLayer';
import { createArcLayer } from './layers/ArcLayer';
import { ViewControls } from './ViewControls';
import { ArcPanel } from './ArcPanel';
import { ArcManagementModal } from './ArcManagementModal';

function getNovelPathFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('novelPath') || null;
}

function getCenterWorldPoint(hostElement, view) {
  const rect = hostElement?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  return screenToWorld(view, centerX, centerY);
}

export function StoryMapApp() {
  const [novelPath] = React.useState(() => getNovelPathFromUrl());
  const { storymap, loading, error, updateStorymap } = useStorymap(novelPath);
  const { pages: wikiPages } = useWikiPages(novelPath);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [theme, setTheme] = useState(() => applyTheme(getStoredTheme()));
  const [showHelp, setShowHelp] = useState(false);
  const [view, setView] = useState('sequential');
  const [split, setSplit] = useState(false);
  const [showArcPanel, setShowArcPanel] = useState(false);
  const [selectedSceneIds, setSelectedSceneIds] = useState([]);
  const [connectionMode, setConnectionMode] = useState('sequential');
  const [hoveredArcId, setHoveredArcId] = useState(null);
  const [selectedArcId, setSelectedArcId] = useState(null);
  const [managedArcId, setManagedArcId] = useState(null);
  const [hoverTooltip, setHoverTooltip] = useState(null);

  const activeArcId = hoveredArcId || selectedArcId;

  useEffect(() => {
    applyTheme(theme);

    function handleStorage(event) {
      if (event.key === 'zuojia-theme') {
        const next = event.newValue === 'dark' ? 'dark' : 'light';
        setTheme(next);
        applyTheme(next);
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [theme]);

  const scenes = storymap?.scenes ?? [];
  const chapters = storymap?.chapters ?? [];
  const arcs = storymap?.arcs ?? [];
  const selectedScene = scenes.find((s) => s.id === selectedSceneId) || null;

  const handleAddScene = useCallback(() => {
    const host = document.querySelector('.storymap-canvas-host');
    const view = { offset: { x: 0, y: 0 }, scale: 1 };
    const center = getCenterWorldPoint(host, view);
    const jitter = (Math.random() - 0.5) * 40;

    let chronologyDate = window.prompt(
      'Enter chronology date (YYYY-MM-DD):',
      new Date().toISOString().slice(0, 10)
    );
    if (!chronologyDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(chronologyDate)) {
      window.alert('Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    updateStorymap((current) => ({
      ...current,
      scenes: [
        ...current.scenes,
        createScene({
          title: `Scene ${current.scenes.length + 1}`,
          x: center.x + jitter,
          y: center.y + jitter,
          chronologyDate,
        }),
      ],
    }));
  }, [updateStorymap]);

  useEffect(() => {
    function isTypingTarget(element) {
      const tag = element?.tagName?.toLowerCase();
      return (
        tag === 'input' || tag === 'textarea' || tag === 'select' || element?.isContentEditable
      );
    }

    function handleKeyDown(event) {
      if (isTypingTarget(document.activeElement)) {
        if (event.key === 'Escape') {
          setSelectedSceneId(null);
          setShowHelp(false);
        }
        return;
      }

      switch (event.key) {
        case 'n':
          event.preventDefault();
          handleAddScene();
          break;
        case 't':
          event.preventDefault();
          setView((v) => (v === 'sequential' ? 'temporal' : 'sequential'));
          break;
        case 's':
          event.preventDefault();
          setSplit((s) => !s);
          break;
        case 'a':
          event.preventDefault();
          setShowArcPanel((p) => !p);
          break;
        case 'Escape':
          if (showHelp) {
            setShowHelp(false);
          } else if (selectedSceneId) {
            setSelectedSceneId(null);
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedSceneId) {
            event.preventDefault();
            if (window.confirm('Remove this scene?')) {
              updateStorymap((current) => ({
                ...current,
                scenes: current.scenes.filter((s) => s.id !== selectedSceneId),
                currentSceneId:
                  current.currentSceneId === selectedSceneId ? null : current.currentSceneId,
              }));
              setSelectedSceneId(null);
            }
          }
          break;
        case '?':
          event.preventDefault();
          setShowHelp(true);
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAddScene, selectedSceneId, showHelp, updateStorymap]);

  const handleSceneDrag = useCallback(
    (scene, dx, dy) => {
      updateStorymap((current) => ({
        ...current,
        scenes: current.scenes.map((s) =>
          s.id === scene.id ? { ...s, x: s.x + dx, y: s.y + dy } : s
        ),
      }));
    },
    [updateStorymap]
  );

  const handleSceneSelect = useCallback((scene, event) => {
    if (event?.metaKey || event?.ctrlKey) {
      setSelectedSceneIds((ids) =>
        ids.includes(scene.id) ? ids.filter((id) => id !== scene.id) : [...ids, scene.id]
      );
    } else {
      setSelectedSceneId(scene.id);
      setSelectedSceneIds([]);
    }
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedSceneId(null);
  }, []);

  const handleSceneChange = useCallback(
    (updatedScene) => {
      updateStorymap((current) => {
        const chapter = current.chapters.find((c) => c.id === updatedScene.chapterId);
        const nextScene = chapter ? snapSceneToChapter(updatedScene, chapter) : updatedScene;
        return {
          ...current,
          scenes: current.scenes.map((s) => (s.id === nextScene.id ? nextScene : s)),
        };
      });
    },
    [updateStorymap]
  );

  const handleCreateChapter = useCallback(
    (title) => {
      updateStorymap((current) => {
        const order = current.chapters.length;
        return {
          ...current,
          chapters: [...current.chapters, createChapter({ title, order })],
        };
      });
    },
    [updateStorymap]
  );

  const handleMarkCurrent = useCallback(
    (sceneId) => {
      updateStorymap((current) => ({
        ...current,
        currentSceneId: sceneId,
      }));
    },
    [updateStorymap]
  );

  const handleCreateArc = useCallback(
    (name, initialSceneIds = []) => {
      updateStorymap((current) => {
        const nextColor = ARC_COLORS[current.arcs.length % ARC_COLORS.length];
        const newArc = createArc({ name, color: nextColor });
        const newAssignments = initialSceneIds.map((sceneId) => ({ arcId: newArc.id, sceneId }));
        return {
          ...current,
          arcs: [...current.arcs, newArc],
          sceneArcAssignments: [...current.sceneArcAssignments, ...newAssignments],
        };
      });
      setSelectedSceneIds([]);
    },
    [updateStorymap]
  );

  const handleAssignScenesToArc = useCallback(
    (arcId, sceneIds) => {
      updateStorymap((current) => {
        const existing = new Set(current.sceneArcAssignments.map((a) => `${a.arcId}-${a.sceneId}`));
        const newAssignments = sceneIds
          .filter((sceneId) => !existing.has(`${arcId}-${sceneId}`))
          .map((sceneId) => ({ arcId, sceneId }));
        return {
          ...current,
          sceneArcAssignments: [...current.sceneArcAssignments, ...newAssignments],
        };
      });
      setSelectedSceneIds([]);
    },
    [updateStorymap]
  );

  const handleRenameArc = useCallback(
    (arcId, name) => {
      updateStorymap((current) => ({
        ...current,
        arcs: current.arcs.map((a) => (a.id === arcId ? { ...a, name } : a)),
      }));
    },
    [updateStorymap]
  );

  const handleDeleteArc = useCallback(
    (arcId) => {
      updateStorymap((current) => ({
        ...current,
        arcs: current.arcs.filter((a) => a.id !== arcId),
        sceneArcAssignments: current.sceneArcAssignments.filter((a) => a.arcId !== arcId),
      }));
      if (selectedArcId === arcId) setSelectedArcId(null);
    },
    [updateStorymap, selectedArcId]
  );

  const handleMergeArc = useCallback(
    (sourceId, targetId) => {
      updateStorymap((current) => {
        const moved = current.sceneArcAssignments
          .filter((a) => a.arcId === sourceId)
          .map((a) => ({ ...a, arcId: targetId }));
        const existingKeys = new Set(current.sceneArcAssignments.map((a) => `${a.arcId}-${a.sceneId}`));
        const newAssignments = moved.filter((a) => !existingKeys.has(`${a.arcId}-${a.sceneId}`));
        return {
          ...current,
          arcs: current.arcs.filter((a) => a.id !== sourceId),
          sceneArcAssignments: [
            ...current.sceneArcAssignments.filter((a) => a.arcId !== sourceId),
            ...newAssignments,
          ],
        };
      });
      if (selectedArcId === sourceId) setSelectedArcId(null);
    },
    [updateStorymap, selectedArcId]
  );

  const handleSplitArc = useCallback(
    (sourceId, sceneIds, newName) => {
      updateStorymap((current) => {
        const nextColor = ARC_COLORS[current.arcs.length % ARC_COLORS.length];
        const newArc = createArc({ name: newName, color: nextColor });
        const newAssignments = sceneIds.map((sceneId) => ({ arcId: newArc.id, sceneId }));
        return {
          ...current,
          arcs: [...current.arcs, newArc],
          sceneArcAssignments: [
            ...current.sceneArcAssignments.filter((a) => !(a.arcId === sourceId && sceneIds.includes(a.sceneId))),
            ...newAssignments,
          ],
        };
      });
    },
    [updateStorymap]
  );

  const handleChangeArcColor = useCallback(
    (arcId, color) => {
      updateStorymap((current) => ({
        ...current,
        arcs: current.arcs.map((a) => (a.id === arcId ? { ...a, color } : a)),
      }));
    },
    [updateStorymap]
  );

  const handleOpenWikiPage = useCallback(async (slug) => {
    try {
      await storymapWindowHandlers.openWikiPage(slug);
    } catch (err) {
      console.error('Failed to open wiki page from storymap:', err);
    }
  }, []);

  const handleHoverArc = useCallback((arcId, screenX, screenY) => {
    setHoveredArcId(arcId);
    if (arcId) {
      const arc = arcs.find((a) => a.id === arcId);
      setHoverTooltip({
        name: arc?.name || '',
        x: screenX,
        y: screenY,
      });
    } else {
      setHoverTooltip(null);
    }
  }, [arcs]);

  const sceneLayer = useMemo(
    () =>
      view === 'temporal'
        ? createTemporalSceneLayer({
            getScenes: () => scenes,
            getChapters: () => chapters,
            getCurrentSceneId: () => storymap?.currentSceneId || null,
            isDark: theme === 'dark',
            split,
          })
        : createSceneLayer({
            getScenes: () => scenes,
            getChapters: () => chapters,
            getCurrentSceneId: () => storymap?.currentSceneId || null,
            isDark: theme === 'dark',
            onSceneDrag: handleSceneDrag,
          }),
    [view, scenes, chapters, storymap?.currentSceneId, theme, split, handleSceneDrag]
  );

  const chapterLayer = useMemo(
    () =>
      createChapterLayer({
        getChapters: () => chapters,
        isDark: theme === 'dark',
      }),
    [chapters, theme]
  );

  const temporalLaneLayer = useMemo(
    () =>
      createTemporalLaneLayer({
        getScenes: () => scenes,
        split,
      }),
    [scenes, split]
  );

  const arcLayer = useMemo(
    () =>
      createArcLayer({
        getScenes: () => scenes,
        getArcs: () => arcs,
        getAssignments: () => storymap?.sceneArcAssignments ?? [],
        getMode: () => connectionMode,
        getActiveArcId: () => activeArcId,
        isDark: theme === 'dark',
      }),
    [scenes, arcs, storymap?.sceneArcAssignments, connectionMode, activeArcId, theme]
  );

  const layers = useMemo(
    () =>
      view === 'temporal'
        ? [temporalLaneLayer, arcLayer, sceneLayer]
        : [chapterLayer, arcLayer, sceneLayer],
    [view, temporalLaneLayer, chapterLayer, arcLayer, sceneLayer]
  );

  if (error) {
    return (
      <StoryMapWindow>
        <main className="storymap-canvas-host">
          <p className="storymap-error">Error loading story map: {error}</p>
        </main>
      </StoryMapWindow>
    );
  }

  if (!novelPath) {
    return (
      <StoryMapWindow>
        <main className="storymap-canvas-host">
          <p>No novel is loaded. Open a novel in the main window first.</p>
        </main>
      </StoryMapWindow>
    );
  }

  return (
    <StoryMapWindow>
      <header className="storymap-topbar">
        <div className="storymap-brand">Story Map</div>
        <div className="storymap-meta">
          {novelPath ? novelPath.split('/').pop() : 'No novel'}
        </div>
      </header>
      <CanvasView
        novelPath={novelPath}
        layers={layers}
        viewName={view}
        activeArcId={activeArcId}
        onHoverArc={handleHoverArc}
        onSceneDrag={handleSceneDrag}
        onSceneSelect={handleSceneSelect}
        onBackgroundClick={handleBackgroundClick}
      >
        <StoryMapToolbar
          onAddScene={handleAddScene}
          onShowHelp={() => setShowHelp(true)}
          viewControls={
            <ViewControls
              view={view}
              split={split}
              onChangeView={setView}
              onToggleSplit={() => setSplit((s) => !s)}
            />
          }
          arcControls={
            <button
              type="button"
              className={`btn btn-sm ${showArcPanel ? 'primary' : 'ghost'}`}
              aria-pressed={showArcPanel}
              onClick={() => setShowArcPanel((p) => !p)}
            >
              Arcs
            </button>
          }
        />
        {!loading && scenes.length === 0 && <EmptyCanvasState onAddScene={handleAddScene} />}
        {selectedScene && (
          <SceneNotesPanel
            scene={selectedScene}
            chapters={chapters}
            wikiPages={wikiPages}
            isCurrent={storymap?.currentSceneId === selectedScene.id}
            onMarkCurrent={() => handleMarkCurrent(selectedScene.id)}
            onChange={handleSceneChange}
            onClose={handleBackgroundClick}
            onCreateChapter={handleCreateChapter}
            onOpenWikiPage={handleOpenWikiPage}
          />
        )}
        {showArcPanel && (
          <ArcPanel
            arcs={arcs}
            sceneArcAssignments={storymap?.sceneArcAssignments ?? []}
            selectedSceneIds={selectedSceneIds}
            selectedArcId={selectedArcId}
            connectionMode={connectionMode}
            onConnectionModeChange={setConnectionMode}
            onCreateArc={handleCreateArc}
            onAssignScenes={handleAssignScenesToArc}
            onSelectArc={setSelectedArcId}
            onManageArc={setManagedArcId}
            onClose={() => setShowArcPanel(false)}
          />
        )}
        {managedArcId && (
          <ArcManagementModal
            arc={arcs.find((a) => a.id === managedArcId)}
            arcs={arcs}
            scenes={scenes}
            assignments={storymap?.sceneArcAssignments ?? []}
            onClose={() => setManagedArcId(null)}
            onRename={handleRenameArc}
            onDelete={handleDeleteArc}
            onMerge={handleMergeArc}
            onSplit={handleSplitArc}
            onChangeColor={handleChangeArcColor}
          />
        )}
        {showHelp && <KeyboardHelpOverlay onClose={() => setShowHelp(false)} />}
        {hoverTooltip && (
          <div
            className="arc-hover-tooltip"
            style={{
              left: hoverTooltip.x + 12,
              top: hoverTooltip.y + 12,
            }}
          >
            {hoverTooltip.name}
          </div>
        )}
      </CanvasView>
    </StoryMapWindow>
  );
}
