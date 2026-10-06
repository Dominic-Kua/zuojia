import React, { useState, useRef, useCallback, useEffect } from 'react'
import Manuscript from './components/Manuscript'
import Sidebar from './components/Sidebar'
import { CommitButton } from './components/CommitButton'
import { ExportDialog } from './components/ExportDialog'
import { NovelSelector } from './components/Navigation/NovelSelector'
import { PushButton } from './components/PushButton'
import { SettingsModal } from './components/SettingsModal'
import { DiagnosticsPanel } from './components/DiagnosticsPanel'
import { SnapshotButton } from './components/SnapshotButton'

import { LlmChatWindow } from './components/LlmChatWindow'
import { useWikiPages } from './hooks/useWikiPages'
import { appHandlers, storymapWindowHandlers } from './lib/ipc-client'

export default function App(){
  const [novelPath, setNovelPath] = useState(null);
  // Wiki page open requests use a nonce object ({slug, nonce}) instead of a
  // timeout handshake — the Sidebar consumes it and calls
  // onWikiPageConsumed to clear it, so re-opening the same page works.
  const [wikiPageToOpen, setWikiPageToOpen] = useState(null);
  const mainGridRef = useRef(null);
  // Holds the Manuscript editor's flush function so destructive operations
  // (snapshot restore, novel close) can await pending debounced saves.
  const editorFlushRef = useRef(null);

  const handleRegisterEditorFlush = useCallback((flushFn) => {
    editorFlushRef.current = flushFn;
    return () => {
      if (editorFlushRef.current === flushFn) {
        editorFlushRef.current = null;
      }
    };
  }, []);

  const flushEditorBeforeDestructiveOp = useCallback(async () => {
    if (editorFlushRef.current) {
      try {
        await editorFlushRef.current.flush();
      } catch (err) {
        console.error('Failed to flush pending editor save:', err);
      }
    }
  }, []);

  // For restores: flush pending saves, then SUSPEND new ones until the
  // restore finishes (the returned resume function must be called in a
  // finally block). Prevents an autosave holding pre-restore text from
  // firing after restore rewrote the files.
  const prepareEditorForRestore = useCallback(async () => {
    const handlers = editorFlushRef.current;
    if (!handlers) {
      return null;
    }
    handlers.suspendSaves?.();
    try {
      await handlers.flush();
    } catch (err) {
      console.error('Failed to flush pending editor save:', err);
    }
    return () => handlers.resumeSaves?.();
  }, []);
  const [theme, setTheme] = useState(() => {
    try {
      const stored = window.localStorage.getItem('zuojia-theme');
      return stored === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  // ── Tiling layout ──
  // wikiPct = % of the main-grid width given to the wiki pane (0–100).
  // 0 = manuscript only, 100 = wiki only, anything in between = split.
  // Persisted so the desk remembers its arrangement across sessions.
  const DEFAULT_WIKI_PCT = 30;
  const [wikiPct, setWikiPct] = useState(() => {
    try {
      // NB: getItem returns null when unset and Number(null) === 0, which
      // is in range — so an explicit null check is required, otherwise a
      // fresh/cleared profile wrongly starts at 0 (manuscript only).
      const raw = window.localStorage.getItem('zuojia-layout-wiki-pct');
      const stored = raw === null ? NaN : Number(raw);
      if (Number.isFinite(stored) && stored >= 0 && stored <= 100) {
        return stored;
      }
      // One-time migration from the legacy pixel width (≈1200px desk).
      const legacy = Number(window.localStorage.getItem('zuojia-sidebar-width'));
      if (Number.isFinite(legacy) && legacy >= 280 && legacy <= 720) {
        return Math.max(0, Math.min(100, (legacy / 1200) * 100));
      }
    } catch {
      // Ignore storage failures and use default.
    }
    return DEFAULT_WIKI_PCT;
  });
  // Remembers the last non-maximized split so collapse/expand can restore it.
  const lastSplitRef = useRef(null);
  useEffect(() => {
    if (wikiPct > 0 && wikiPct < 100) {
      lastSplitRef.current = wikiPct;
    }
  }, [wikiPct]);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  // ── AI master switch ──
  // Default ON (opt-out). When off, novel services (Neo4j, MCP/Synapse,
  // LLM runtime) are never started and the LLM chat UI is hidden.
  // String-compared so a missing key can never read as disabled.
  const [aiEnabled, setAiEnabled] = useState(() => {
    try {
      return window.localStorage.getItem('zuojia-ai-enabled') !== 'false';
    } catch {
      return true;
    }
  });
  // Mirror for async handlers so a toggle racing a novel open can't start
  // services after the user switched AI off (or vice versa).
  const aiEnabledRef = useRef(true);
  useEffect(() => {
    aiEnabledRef.current = aiEnabled;
    try {
      window.localStorage.setItem('zuojia-ai-enabled', String(aiEnabled));
    } catch {
      // Ignore storage failures.
    }
  }, [aiEnabled]);
  const [servicesStatus, setServicesStatus] = useState(null);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem('zuojia-editor-font-size'));
      if (Number.isFinite(stored) && stored >= 14 && stored <= 30) {
        return stored;
      }
    } catch {
      // Ignore storage failures and use default.
    }
    return 18;
  });

  // Wiki floating panel state
  const [wikiDetached, setWikiDetached] = useState(() => {
    try {
      const stored = window.localStorage.getItem('zuojia-wiki-docked');
      // stored is 'true' for docked, 'false' for detached
      return stored === 'false'; // true = detached, false = docked (default)
    } catch {
      return false;
    }
  });
  const [wikiPanelPosition, setWikiPanelPosition] = useState(() => {
    try {
      const stored = window.localStorage.getItem('zuojia-wiki-position');
      if (stored) {
        const pos = JSON.parse(stored);
        if (typeof pos.x === 'number' && typeof pos.y === 'number') {
          return pos;
        }
      }
    } catch {
      // Ignore
    }
    return { x: 100, y: 100 }; // default position
  });
  const [isDraggingWikiPanel, setIsDraggingWikiPanel] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  // Floating panel size — resizable via the SE corner handle, persisted.
  const DEFAULT_WIKI_PANEL_SIZE = { width: 380, height: 600 };
  const MIN_WIKI_PANEL_SIZE = { width: 280, height: 200 };
  const [wikiPanelSize, setWikiPanelSize] = useState(() => {
    try {
      const stored = window.localStorage.getItem('zuojia-wiki-panel-size');
      if (stored) {
        const size = JSON.parse(stored);
        if (typeof size.width === 'number' && typeof size.height === 'number') {
          return {
            width: Math.max(MIN_WIKI_PANEL_SIZE.width, Math.min(1600, size.width)),
            height: Math.max(MIN_WIKI_PANEL_SIZE.height, Math.min(1200, size.height)),
          };
        }
      }
    } catch {
      // Ignore
    }
    return DEFAULT_WIKI_PANEL_SIZE;
  });
  const [isResizingWikiPanel, setIsResizingWikiPanel] = useState(false);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('zuojia-theme', theme);
    } catch {
      // Ignore storage failures.
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem('zuojia-layout-wiki-pct', String(wikiPct));
    } catch {
      // Ignore storage failures.
    }
  }, [wikiPct]);

  useEffect(() => {
    try {
      window.localStorage.setItem('zuojia-editor-font-size', String(editorFontSize));
    } catch {
      // Ignore storage failures.
    }
  }, [editorFontSize]);

  useEffect(() => {
    if (!isResizingSidebar) {
      return undefined;
    }

    const onMouseMove = (event) => {
      if (!mainGridRef.current) {
        return;
      }

      const rect = mainGridRef.current.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }
      // Tiling: wiki share of the desk as a percentage — any amount of
      // space from 0 (manuscript only) to 100 (wiki only).
      // Snap within 2% of an edge so maximizing feels deliberate but easy.
      const raw = ((rect.right - event.clientX) / rect.width) * 100;
      const snapped = raw < 2 ? 0 : raw > 98 ? 100 : raw;
      const clamped = Math.max(0, Math.min(100, snapped));
      setWikiPct(clamped);
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizingSidebar]);

  // Wiki floating panel drag handlers
  useEffect(() => {
    if (!isDraggingWikiPanel) {
      return undefined;
    }

    const onMouseMove = (event) => {
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;

      // Constrain to viewport bounds using the panel's live size so a
      // resized panel can't be dragged off-screen.
      const panelWidth = wikiPanelSize.width;
      const panelHeight = wikiPanelSize.height;
      const maxX = Math.max(20, window.innerWidth - panelWidth - 20);
      const maxY = Math.max(20, window.innerHeight - panelHeight - 20);

      const newX = Math.max(20, Math.min(maxX, dragStartRef.current.panelX + dx));
      const newY = Math.max(20, Math.min(maxY, dragStartRef.current.panelY + dy));

      setWikiPanelPosition({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      setIsDraggingWikiPanel(false);
      // Persist position
      try {
        window.localStorage.setItem('zuojia-wiki-position', JSON.stringify(wikiPanelPosition));
      } catch {
        // Ignore
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingWikiPanel, wikiPanelPosition, wikiPanelSize]);

  // Floating panel resize (SE corner handle)
  useEffect(() => {
    if (!isResizingWikiPanel) {
      return undefined;
    }

    const onMouseMove = (event) => {
      const dx = event.clientX - resizeStartRef.current.x;
      const dy = event.clientY - resizeStartRef.current.y;

      // Never smaller than the minimum, never larger than the viewport
      // space remaining from the panel's current position.
      const maxWidth = Math.max(
        MIN_WIKI_PANEL_SIZE.width,
        window.innerWidth - wikiPanelPosition.x - 20
      );
      const maxHeight = Math.max(
        MIN_WIKI_PANEL_SIZE.height,
        window.innerHeight - wikiPanelPosition.y - 20
      );

      const newWidth = Math.max(
        MIN_WIKI_PANEL_SIZE.width,
        Math.min(maxWidth, resizeStartRef.current.width + dx)
      );
      const newHeight = Math.max(
        MIN_WIKI_PANEL_SIZE.height,
        Math.min(maxHeight, resizeStartRef.current.height + dy)
      );

      setWikiPanelSize({ width: newWidth, height: newHeight });
    };

    const onMouseUp = () => {
      setIsResizingWikiPanel(false);
      // Size is persisted by the effect below.
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    // Note: deliberately not dep'ing on wikiPanelSize — the move handler
    // derives the new size from the drag start + cursor delta, so
    // re-subscribing on every size tick would just churn listeners mid-drag.
  }, [isResizingWikiPanel, wikiPanelPosition]);

  // Get wiki pages for the manuscript component
  const { pages: wikiPages, refresh: refreshWikiPages } = useWikiPages(novelPath);

  const [restoreKey, setRestoreKey] = useState(0);

  const handleRestored = useCallback(() => {
    setRestoreKey((k) => k + 1);
  }, []);

  const startServicesForNovel = useCallback(async (path) => {
    setServicesLoading(true);
    setServicesStatus(null);

    try {
      const result = await appHandlers.startNovelServices(path);
      setServicesStatus(result);
    } catch (err) {
      console.error('Failed to start novel services:', err);
      setServicesStatus({ status: 'error', error: err.message });
    } finally {
      setServicesLoading(false);
    }
  }, []);

  // Novel creation and opening follow the same lifecycle: load the novel,
  // then start its services — unless the AI master switch is off.
  const handleNovelReady = async (path) => {
    setNovelPath(path);
    if (!aiEnabledRef.current) {
      setServicesLoading(false);
      setServicesStatus(null);
      return;
    }
    await startServicesForNovel(path);
  };

  // Flipping the AI switch with a novel open starts or stops its services
  // immediately; with no novel open it just records the preference for the
  // next open.
  const handleAiToggle = useCallback(async (next) => {
    setAiEnabled(next);
    if (!novelPath) {
      return;
    }
    if (next) {
      await startServicesForNovel(novelPath);
    } else {
      try {
        await appHandlers.stopNovelServices();
      } catch (err) {
        console.error('Failed to stop novel services:', err);
      } finally {
        setServicesLoading(false);
        setServicesStatus(null);
      }
    }
  }, [novelPath, startServicesForNovel]);

  const handleCloseNovel = async () => {
    // Flush pending debounced chapter save before tearing down services —
    // otherwise the last few hundred ms of typing is lost on close.
    await flushEditorBeforeDestructiveOp();
    try {
      await appHandlers.stopNovelServices();
    } catch (err) {
      console.error('Failed to stop novel services:', err);
    } finally {
      setNovelPath(null);
      setServicesStatus(null);
      setWikiDetached(false);
    }
  };

  // ── Tiling presets + reset ──
  // All presets re-dock the wiki (floating is separate from tiling); the
  // reset also restores the floating panel's home position so nothing can
  // stay mis-sized to zero or stranded off-screen.
  const restoreSplit = useCallback(() => {
    return lastSplitRef.current && lastSplitRef.current > 0 && lastSplitRef.current < 100
      ? lastSplitRef.current
      : DEFAULT_WIKI_PCT;
  }, []);

  const showManuscriptOnly = useCallback(() => {
    setWikiDetached(false);
    setWikiPct(0);
  }, []);

  const showSplitEven = useCallback(() => {
    setWikiDetached(false);
    setWikiPct(50);
  }, []);

  const showWikiOnly = useCallback(() => {
    setWikiDetached(false);
    setWikiPct(100);
  }, []);

  const expandManuscript = useCallback(() => {
    setWikiDetached(false);
    setWikiPct((prev) => (prev >= 100 ? restoreSplit() : prev));
  }, [restoreSplit]);

  const expandWiki = useCallback(() => {
    setWikiDetached(false);
    setWikiPct((prev) => (prev <= 0 ? restoreSplit() : prev));
  }, [restoreSplit]);

  const resetLayout = useCallback(() => {
    setWikiDetached(false);
    setWikiPct(DEFAULT_WIKI_PCT);
    lastSplitRef.current = DEFAULT_WIKI_PCT;
    setWikiPanelPosition({ x: 100, y: 100 });
    setWikiPanelSize(DEFAULT_WIKI_PANEL_SIZE);
    try {
      window.localStorage.setItem('zuojia-layout-wiki-pct', String(DEFAULT_WIKI_PCT));
      window.localStorage.setItem('zuojia-wiki-position', JSON.stringify({ x: 100, y: 100 }));
      window.localStorage.setItem('zuojia-wiki-panel-size', JSON.stringify(DEFAULT_WIKI_PANEL_SIZE));
      window.localStorage.removeItem('zuojia-sidebar-width');
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const decreaseFontSize = () => {
    setEditorFontSize((prev) => Math.max(14, prev - 1));
  };

  const resetFontSize = () => {
    setEditorFontSize(18);
  };

  const increaseFontSize = () => {
    setEditorFontSize((prev) => Math.min(30, prev + 1));
  };

  // Handle opening a wiki page from the manuscript
  const handleOpenWikiPage = useCallback((slug) => {
    setWikiPageToOpen({ slug, nonce: Date.now() });
  }, []);

  const handleWikiPageConsumed = useCallback(() => {
    setWikiPageToOpen(null);
  }, []);

  // Wiki floating panel drag handlers
  const handleWikiPanelDragStart = useCallback((e) => {
    if (!wikiDetached) return;
    const target = e.target.closest('.wiki-panel-titlebar');
    if (!target) return;
    
    e.preventDefault();
    setIsDraggingWikiPanel(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: wikiPanelPosition.x,
      panelY: wikiPanelPosition.y,
    };
  }, [wikiDetached, wikiPanelPosition]);

  const handleWikiPanelDragMove = useCallback((e) => {
    if (!isDraggingWikiPanel) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    const newX = dragStartRef.current.panelX + deltaX;
    const newY = dragStartRef.current.panelY + deltaY;
    
    // Constrain to viewport bounds (with some padding)
    const panelWidth = 380; // approximate panel width
    const panelHeight = 600; // approximate panel height
    const maxX = window.innerWidth - panelWidth - 20;
    const maxY = window.innerHeight - panelHeight - 80; // account for topbar
    
    const clampedX = Math.max(20, Math.min(newX, maxX));
    const clampedY = Math.max(80, Math.min(newY, maxY)); // 80px for topbar
    
    setWikiPanelPosition({ x: clampedX, y: clampedY });
  }, [isDraggingWikiPanel]);

  const handleWikiPanelDragEnd = useCallback(() => {
    if (!isDraggingWikiPanel) return;
    setIsDraggingWikiPanel(false);
    // Persist position
    try {
      window.localStorage.setItem('zuojia-wiki-position', JSON.stringify(wikiPanelPosition));
    } catch {
      // Ignore
    }
  }, [isDraggingWikiPanel, wikiPanelPosition]);

  useEffect(() => {
    if (isDraggingWikiPanel) {
      window.addEventListener('mousemove', handleWikiPanelDragMove);
      window.addEventListener('mouseup', handleWikiPanelDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleWikiPanelDragMove);
        window.removeEventListener('mouseup', handleWikiPanelDragEnd);
      };
    }
  }, [isDraggingWikiPanel, handleWikiPanelDragMove, handleWikiPanelDragEnd]);

  // Persist wiki detached state
  useEffect(() => {
    try {
      window.localStorage.setItem('zuojia-wiki-docked', String(!wikiDetached));
    } catch {
      // Ignore
    }
  }, [wikiDetached]);

  // Persist wiki panel position
  useEffect(() => {
    if (wikiDetached) {
      try {
        window.localStorage.setItem('zuojia-wiki-position', JSON.stringify(wikiPanelPosition));
      } catch {
        // Ignore
      }
    }
  }, [wikiDetached, wikiPanelPosition]);

  // Persist wiki panel size
  useEffect(() => {
    if (wikiDetached) {
      try {
        window.localStorage.setItem('zuojia-wiki-panel-size', JSON.stringify(wikiPanelSize));
      } catch {
        // Ignore
      }
    }
  }, [wikiDetached, wikiPanelSize]);

  // Show novel selector if no novel is loaded
  if (!novelPath) {
    return (
      <div className="app-shell" data-testid="app-shell">
        <header className="topbar" data-testid="topbar">
          <div className="brand">作家</div>
          <div className="top-actions">
            <button
              type="button"
              className="btn ghost"
              data-testid="ai-toggle-button"
              aria-pressed={aiEnabled}
              title={aiEnabled ? 'Turn AI features off' : 'Turn AI features on'}
              onClick={() => handleAiToggle(!aiEnabled)}
            >
              {aiEnabled ? 'AI On' : 'AI Off'}
            </button>
            <button
              type="button"
              className="btn ghost"
              data-testid="theme-toggle-button"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </header>
        <main className="main-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <NovelSelector 
            onNovelCreated={handleNovelReady}
            onNovelOpened={handleNovelReady}
          />
        </main>
      </div>
    );
  }

  // Show main editor interface when novel is loaded
  return (
    <div className="app-shell" data-testid="app-shell">
      <header className="topbar" data-testid="topbar">
        <div className="brand">作家</div>
        <div className="top-actions">
          <div className="font-size-controls" data-testid="font-size-controls">
            <button
              type="button"
              className="btn ghost"
              data-testid="font-size-decrease"
              aria-label="Decrease editor font size"
              onClick={decreaseFontSize}
              disabled={editorFontSize <= 14}
            >
              -
            </button>
            <button
              type="button"
              className="btn ghost"
              data-testid="font-size-reset"
              aria-label="Reset editor font size"
              onClick={resetFontSize}
            >
              aA
            </button>
            <button
              type="button"
              className="btn ghost"
              data-testid="font-size-increase"
              aria-label="Increase editor font size"
              onClick={increaseFontSize}
              disabled={editorFontSize >= 30}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="btn ghost"
            data-testid="theme-toggle-button"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            type="button"
            className="btn ghost"
            data-testid="ai-toggle-button"
            aria-pressed={aiEnabled}
            title={aiEnabled ? 'Turn AI features off (stops novel services, hides LLM chat)' : 'Turn AI features on (starts novel services)'}
            onClick={() => handleAiToggle(!aiEnabled)}
          >
            {aiEnabled ? 'AI On' : 'AI Off'}
          </button>
          <ExportDialog novelPath={novelPath} onBeforeExport={flushEditorBeforeDestructiveOp} />
          <SnapshotButton novelPath={novelPath} />
          <CommitButton novelPath={novelPath} />
          <PushButton novelPath={novelPath} />
          {aiEnabled && (
            <LlmChatWindow novelPath={novelPath} servicesStatus={servicesStatus} servicesLoading={servicesLoading} />
          )}
          <DiagnosticsPanel
            novelPath={novelPath}
            onIndexRebuilt={refreshWikiPages}
            onRestored={handleRestored}
            onBeforeRestore={prepareEditorForRestore}
          />
          <SettingsModal novelPath={novelPath} />
          <div className="layout-controls" data-testid="layout-controls" role="group" aria-label="Workspace layout">
            <button
              type="button"
              className="btn ghost btn-sm"
              data-testid="layout-manuscript-only"
              title="Manuscript takes all space"
              aria-pressed={!wikiDetached && wikiPct <= 0.5}
              onClick={showManuscriptOnly}
            >
              Manuscript
            </button>
            <button
              type="button"
              className="btn ghost btn-sm"
              data-testid="layout-split-even"
              title="Split space evenly"
              aria-pressed={!wikiDetached && wikiPct > 0.5 && wikiPct < 99.5}
              onClick={showSplitEven}
            >
              Split
            </button>
            <button
              type="button"
              className="btn ghost btn-sm"
              data-testid="layout-wiki-only"
              title="Wiki takes all space"
              aria-pressed={!wikiDetached && wikiPct >= 99.5}
              onClick={showWikiOnly}
            >
              Wiki
            </button>
            <button
              type="button"
              className="btn ghost btn-sm"
              data-testid="reset-layout-button"
              title="Reset workspace layout to defaults"
              onClick={resetLayout}
            >
              Reset UI
            </button>
          </div>
          {wikiDetached && (
            <button className="btn ghost" data-testid="topbar-dock-wiki-button" onClick={() => setWikiDetached(false)}>Dock Wiki</button>
          )}
          <button
            type="button"
            className="btn ghost"
            data-testid="open-storymap-button"
            onClick={() => storymapWindowHandlers.open(novelPath)}
          >
            Story Map
          </button>
          <button className="btn ghost" data-testid="close-novel-button" onClick={handleCloseNovel}>Close Novel</button>
        </div>
      </header>
      <main className="main-grid tiling-grid" ref={mainGridRef}>
        {(() => {
          const manuscriptHidden = !wikiDetached && wikiPct >= 99.5;
          const wikiHidden = !wikiDetached && wikiPct <= 0.5;
          const manuscriptStyle = manuscriptHidden
            ? { display: 'none' }
            : wikiDetached || wikiHidden
              ? { flex: '1 1 0', minWidth: 0 }
              : { flex: `${100 - wikiPct} 1 0`, minWidth: 0 };
          const sidebarStyle = wikiHidden
            ? { display: 'none' }
            : wikiDetached
              ? undefined
              : manuscriptHidden
                ? { flex: '1 1 0', minWidth: 0, width: 'auto', maxWidth: 'none' }
                : { flex: `${wikiPct} 1 0`, minWidth: 0, width: 'auto', maxWidth: 'none' };
          return (
            <>
              <section
                className={`manuscript${manuscriptHidden ? ' collapsed' : ''}`}
                data-testid="manuscript-section"
                data-hidden={manuscriptHidden || undefined}
                style={manuscriptStyle}
              >
                <Manuscript
                  key={restoreKey}
                  novelPath={novelPath}
                  wikiPages={wikiPages}
                  onOpenWikiPage={handleOpenWikiPage}
                  editorFontSize={editorFontSize}
                  registerEditorFlush={handleRegisterEditorFlush}
                />
              </section>
              {manuscriptHidden && !wikiDetached && (
                <button
                  type="button"
                  className="btn ghost btn-sm pane-restore"
                  data-testid="expand-manuscript-button"
                  onClick={expandManuscript}
                >
                  Show manuscript
                </button>
              )}
              {!wikiDetached && (
                <div
                  className={`sidebar-resizer${isResizingSidebar ? ' active' : ''}`}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize manuscript and wiki panes (double-click to reset)"
                  aria-valuenow={Math.round(wikiPct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  data-testid="sidebar-resizer"
                  title="Drag to give each pane any amount of space — double-click to reset"
                  onMouseDown={() => setIsResizingSidebar(true)}
                  onDoubleClick={resetLayout}
                />
              )}
              {wikiHidden && !wikiDetached && (
                <button
                  type="button"
                  className="btn ghost btn-sm pane-restore"
                  data-testid="expand-wiki-button"
                  onClick={expandWiki}
                >
                  Show wiki
                </button>
              )}
              <aside
                className={`sidebar${wikiDetached ? ' collapsed' : ''}${manuscriptHidden ? ' full' : ''}`}
                data-testid="sidebar-section"
                data-hidden={wikiHidden || undefined}
                style={sidebarStyle}
              >
                <Sidebar
                  key={`${restoreKey}-${novelPath}`}
                  novelPath={novelPath}
                  openPageSlug={wikiPageToOpen}
                  wikiDetached={wikiDetached}
                  onToggleWikiDetached={setWikiDetached}
                  onWikiPageConsumed={handleWikiPageConsumed}
                />
              </aside>
            </>
          );
        })()}
      </main>
      {/* Floating Wiki Panel (outside main-grid for fixed positioning) */}
      {wikiDetached && novelPath && (
        <div
          className={`wiki-panel${isResizingWikiPanel ? ' resizing' : ''}`}
          style={{
            '--wiki-panel-x': `${wikiPanelPosition.x}px`,
            '--wiki-panel-y': `${wikiPanelPosition.y}px`,
            width: `${wikiPanelSize.width}px`,
            height: `${wikiPanelSize.height}px`,
            zIndex: 1000,
          }}
          data-testid="wiki-floating-panel"
        >
          <div
            className="wiki-panel-titlebar"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingWikiPanel(true);
              dragStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                panelX: wikiPanelPosition.x,
                panelY: wikiPanelPosition.y,
              };
            }}
            data-testid="wiki-floating-panel-titlebar"
          >
            <h3>Wiki</h3>
            <div className="wiki-floating-panel-actions">
              <button
                type="button"
                className="btn ghost btn-sm"
                onClick={() => setWikiDetached(false)}
                data-testid="wiki-dock-button"
                aria-label="Dock wiki panel"
              >
                Dock
              </button>
            </div>
          </div>
          <div className="wiki-panel-content">
            <Sidebar
              key={`floating-${restoreKey}`}
              novelPath={novelPath}
              openPageSlug={wikiPageToOpen}
              wikiDetached={wikiDetached}
              onToggleWikiDetached={setWikiDetached}
              onWikiPageConsumed={handleWikiPageConsumed}
              isFloating={true}
            />
          </div>
          <div
            className="wiki-panel-resize-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize wiki panel"
            aria-valuenow={Math.round(wikiPanelSize.width)}
            data-testid="wiki-floating-panel-resize-handle"
            title="Drag to resize the wiki panel"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsResizingWikiPanel(true);
              resizeStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                width: wikiPanelSize.width,
                height: wikiPanelSize.height,
              };
            }}
            onDoubleClick={resetLayout}
          />
        </div>
      )}
      {/* Drag / resize overlay for floating panel */}
      <div style={{ display: 'contents' }}>
        {(isDraggingWikiPanel || isResizingWikiPanel) && (
          <>
            <div
              className={`wiki-floating-panel-drag-overlay${isResizingWikiPanel ? ' resizing' : ''}`}
              data-testid={isResizingWikiPanel ? 'wiki-floating-panel-resize-overlay' : 'wiki-floating-panel-drag-overlay'}
            />
          </>
        )}
      </div>
    </div>
  )
}
