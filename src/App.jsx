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
import { appHandlers } from './lib/ipc-client'

export default function App(){
  const [novelPath, setNovelPath] = useState(null);
  const [wikiPageToOpen, setWikiPageToOpen] = useState(null);
  const sidebarRef = useRef(null);
  const mainGridRef = useRef(null);
  const wikiPageTimeoutRef = useRef(null);
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
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem('zuojia-sidebar-width'));
      if (Number.isFinite(stored) && stored >= 280 && stored <= 720) {
        return stored;
      }
    } catch {
      // Ignore storage failures and use default.
    }
    return 360;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
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

  useEffect(() => {
    return () => {
      if (wikiPageTimeoutRef.current !== null) {
        clearTimeout(wikiPageTimeoutRef.current);
      }
    };
  }, []);

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
      window.localStorage.setItem('zuojia-sidebar-width', String(sidebarWidth));
    } catch {
      // Ignore storage failures.
    }
  }, [sidebarWidth]);

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
      const calculated = rect.right - event.clientX;
      const clamped = Math.max(280, Math.min(720, calculated));
      setSidebarWidth(clamped);
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
      
      // Constrain to viewport bounds (with panel dimensions accounted for)
      const panelWidth = 360; // matches sidebar width
      const panelHeight = 600; // approximate panel height
      const maxX = window.innerWidth - panelWidth - 20;
      const maxY = window.innerHeight - panelHeight - 20;
      
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
  }, [isDraggingWikiPanel, wikiPanelPosition]);

  // Get wiki pages for the manuscript component
  const { pages: wikiPages, refresh: refreshWikiPages } = useWikiPages(novelPath);

  const [restoreKey, setRestoreKey] = useState(0);

  const handleRestored = useCallback(() => {
    setRestoreKey((k) => k + 1);
  }, []);

  const handleNovelCreated = async (path) => {
    setNovelPath(path);
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
  };

  const handleNovelOpened = async (path) => {
    setNovelPath(path);
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
  };

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
    }
  };

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
    if (wikiPageTimeoutRef.current !== null) {
      clearTimeout(wikiPageTimeoutRef.current);
    }
    setWikiPageToOpen(slug);
    // Reset after a brief moment to allow Sidebar to detect the change
    wikiPageTimeoutRef.current = setTimeout(() => {
      setWikiPageToOpen(null);
      wikiPageTimeoutRef.current = null;
    }, 100);
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
              data-testid="theme-toggle-button"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </header>
        <main className="main-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <NovelSelector 
            onNovelCreated={handleNovelCreated}
            onNovelOpened={handleNovelOpened}
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
          <ExportDialog novelPath={novelPath} />
          <SnapshotButton novelPath={novelPath} />
          <CommitButton novelPath={novelPath} />
          <PushButton novelPath={novelPath} />
          <LlmChatWindow novelPath={novelPath} servicesStatus={servicesStatus} servicesLoading={servicesLoading} />
          <DiagnosticsPanel
            novelPath={novelPath}
            onIndexRebuilt={refreshWikiPages}
            onRestored={handleRestored}
            onBeforeRestore={prepareEditorForRestore}
          />
          <SettingsModal novelPath={novelPath} />
          <button className="btn ghost" data-testid="close-novel-button" onClick={handleCloseNovel}>Close Novel</button>
        </div>
      </header>
      <main className="main-grid" ref={mainGridRef}>
        <section className="manuscript" data-testid="manuscript-section">
          <Manuscript
            key={restoreKey}
            novelPath={novelPath}
            wikiPages={wikiPages}
            onOpenWikiPage={handleOpenWikiPage}
            editorFontSize={editorFontSize}
            registerEditorFlush={handleRegisterEditorFlush}
          />
        </section>
        <div
          className={`sidebar-resizer${isResizingSidebar ? ' active' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize wiki sidebar"
          data-testid="sidebar-resizer"
          onMouseDown={() => setIsResizingSidebar(true)}
        />
        <aside className={`sidebar${wikiDetached ? ' collapsed' : ''}`} data-testid="sidebar-section" style={{ width: `${sidebarWidth}px` }}>
          <Sidebar
            key={`${restoreKey}-${novelPath}`}
            ref={sidebarRef}
            novelPath={novelPath}
            openPageSlug={wikiPageToOpen}
            wikiDetached={wikiDetached}
            onToggleWikiDetached={setWikiDetached}
          />
        </aside>
      </main>
      {/* Floating Wiki Panel (outside main-grid for fixed positioning) */}
      {wikiDetached && novelPath && (
        <div
          className="wiki-panel"
          style={{
            '--wiki-panel-x': `${wikiPanelPosition.x}px`,
            '--wiki-panel-y': `${wikiPanelPosition.y}px`,
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
              isFloating={true}
            />
          </div>
        </div>
      )}
      {/* Drag overlay for floating panel */}
      <div style={{ display: 'contents' }}>
        {isDraggingWikiPanel && (
          <>
            <div
              className="wiki-floating-panel-drag-overlay"
              data-testid="wiki-floating-panel-drag-overlay"
            />
          </>
        )}
      </div>
    </div>
  )
}
