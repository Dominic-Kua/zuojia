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
        <aside className="sidebar" data-testid="sidebar-section" style={{ width: `${sidebarWidth}px` }}>
          <Sidebar 
            key={restoreKey}
            ref={sidebarRef}
            novelPath={novelPath} 
            openPageSlug={wikiPageToOpen}
          />
        </aside>
      </main>
    </div>
  )
}
