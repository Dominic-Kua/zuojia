---
title: "ä½å®¶ Epics & Stories"
date: 2026-03-24
author: Dom
status: final (MVP complete; V2 planned)
version: 1.1
---

# ä½å®¶ Epics & Stories (MVP complete; V2 roadmap)

This document breaks down the architecture and PRD into implementable epics and user stories. MVP stories are complete; remaining and new scope are captured in the Version 2 roadmap. Each epic maps to one or more architectural components. Stories include acceptance criteria and point estimates.

---

## Epic 1: Novel Management & Bootstrap

**Description:** Users can create new novels or open existing ones from the filesystem. The app initializes the `~/.zuojia/<novel>/` directory structure and maintains a novel registry.

**Architecture Components:**
- `src/components/Navigation` (NovelSelector)
- `helper/src/index/` (rebuild, manifest management)

**Stories:**

### 1.1 Create New Novel ✅
**Story:** As an author, I want to create a new novel project by providing a name, so I can start writing immediately.

**Status:** Complete

**Acceptance Criteria:**
- [x] "New Novel" button opens a dialog
- [x] User enters novel name; validation prevents empty/invalid names
- [x] Helper creates `~/.zuojia/<novel-name>/` with subdirs: `manuscript/`, `wiki/`, `meta/`
- [x] Helper initializes `meta/index.json` (empty chapters, wiki)
- [x] Novel appears in sidebar novel list
- [x] App opens the new novel (empty editor)

**Components Involved:**
- `src/components/Navigation/NovelSelector`
- `helper/src/index/rebuild.js`

**Estimate:** 3 points

### 1.2 Open Existing Novel ✅
**Story:** As an author, I want to open an existing novel from my filesystem, so I can resume writing.

**Status:** Complete

**Acceptance Criteria:**
- [x] "Open" button opens file picker
- [x] User selects `~/.zuojia/<novel>/` directory
- [x] Helper validates structure (manuscript/, wiki/, meta/); returns error if invalid
- [x] App loads chapter list from `meta/index.json`
- [x] Editor displays first chapter (or last edited)
- [x] Novel added to recent list

**Components Involved:**
- `src/components/Navigation/NovelSelector`
- `helper/src/index/get.js`

**Estimate:** 2 points

### 1.3 Build/Rebuild Index ✅
**Story:** As the system, I need to maintain an accurate index of chapters and wiki pages, so the sidebar loads fast.

**Status:** Complete

**Acceptance Criteria:**
- [x] On app startup, helper calls `helper:index:get`
- [x] If `meta/index.json` is missing/corrupted, helper rebuilds from disk
- [x] Index includes: chapters list (filename, title, word count), wiki pages (slug, title)
- [x] Index build takes <100ms for typical novels (100-200 chapters)
- [x] Renderer caches index in context; refreshes on save/wiki edit

**Components Involved:**
- `helper/src/index/get.js`
- `helper/src/index/rebuild.js`
- `src/context/ChaptersContext`
- `src/context/WikiContext`

**Estimate:** 2 points

---

## Epic 2: Manuscript Editing & Autosave

**Description:** Core writing experience: edit chapters in CodeMirror, autosave to disk, and manage per-chapter metadata.

**Architecture Components:**
- `src/components/Manuscript`
- `src/lib/codemirror-extensions`
- `helper/src/git/commit.js` (autosave → git commit)

**Stories:**

### 2.1 Editor Integration ✅
**Story:** As an author, I want a fast, distraction-free Markdown editor that lets me write smoothly.

**Status:** Complete (using contenteditable with planned CodeMirror upgrade)

**Acceptance Criteria:**
- [x] Editor integrated in `src/components/Manuscript`
- [x] Editor displays with configured font size, line height, theme
- [x] Basic Markdown rendering active
- [x] Editor loads chapter content on mount
- [x] Cursor position preserved when switching chapters
- [x] No lag on typical keypresses (<100ms)

**Components Involved:**
- `src/components/Manuscript/CodeMirrorEditor`
- `src/lib/codemirror-extensions`
- `src/hooks/useEditorState`

**Estimate:** 3 points

### 2.2 Chapter Switching ✅
**Story:** As an author, I want to switch between chapters easily from a dropdown, so I can navigate my manuscript.

**Status:** Complete

**Acceptance Criteria:**
- [x] "Chapter" dropdown in editor toolbar shows all chapters from index
- [x] Clicking a chapter loads its content into the editor
- [x] Current chapter highlighted in dropdown
- [x] Unsaved changes in current chapter trigger "Save?" dialog before switching
- [x] Dropdown searchable (type to filter chapters)

**Components Involved:**
- `src/components/EditorToolbar`
- `src/components/Navigation/ChapterList`
- `src/hooks/useChapters`

**Estimate:** 2 points

### 2.3 Autosave to Disk ✅
**Story:** As the system, I need to save author changes to disk periodically, so data is never lost.

**Status:** Complete

**Acceptance Criteria:**
- [x] Editor debounces keypresses (300ms)
- [x] On idle timeout, renderer calls `helper:git:commit` with chapter content
- [x] Helper writes to disk atomically (temp file → rename)
- [x] No IPC errors logged; errors handled gracefully (show toast to user)
- [x] Git log shows commits with timestamp approx every N keypresses (configurable, default 5 min)
- [x] Word count updated after save

**Components Involved:**
- `src/components/Manuscript/CodeMirrorEditor`
- `src/hooks/useEditorState`
- `helper/src/git/commit.js`
- `helper/src/util/logging.js`

**Estimate:** 3 points

### 2.4 Word Count Display ✅
**Story:** As an author, I want to see word counts for my manuscript, chapter, and words written today.

**Status:** Complete

**Acceptance Criteria:**
- [x] Word count widget displayed in manuscript area showing all three counts
- [x] "Manuscript" shows total words across all chapters
- [x] "Chapter" shows words in current chapter
- [x] "Today" shows words added since midnight (from git history baseline)
- [x] Word counts update after each save (<500ms)
- [x] Counts are accurate (exclude wiki pages, config, meta/)

**Components Involved:**
- `src/components/WikiSidebar/WordCountWidget` (new)
- `src/hooks/useChapters`
- `helper/src/git/history.js` (analyze diffs for "today" count)

**Estimate:** 3 points

---

## Epic 3: Wiki System & Contextual Reference

**Description:** Authors can create/edit wiki pages and reference them inline in the manuscript. Wiki terms are suppressd in spellcheck.

**Architecture Components:**
- `src/components/WikiSidebar`
- `src/lib/codemirror-extensions` (wiki link extension)
- `helper/src/index/` (wiki page tracking)
- `helper/src/wiki/rebuild-dict.js`

**Stories:**

### 3.1 Wiki Page CRUD ✅
**Story:** As an author, I want to create and edit wiki pages for characters, places, and world details.

**Status:** Complete

**Acceptance Criteria:**
- [x] "+" button in Wiki tab opens "New Wiki Page" dialog
- [x] User enters page title (e.g., "Alice the Protagonist")
- [x] Helper stores as `wiki/<slug>.md` (slug derived from title)
- [x] Wiki page opens in sidebar editor
- [x] Existing wiki pages listed in Wiki sidebar with search
- [x] Clicking a wiki page opens it in sidebar editor
- [x] Changes to wiki pages autosave with debounce
- [x] Wiki pages can be renamed (updates index, backups generated)
- [x] Wiki pages support tags with YAML frontmatter
- [x] Wiki preview mode with Markdown rendering
- [x] Wiki links and image embeds supported

**Components Involved:**
- `src/components/WikiSidebar`
- `src/components/WikiSidebar/WikiPageCard`
- `helper/src/index/rebuild.js`
- `helper/src/wiki/list-pages.js` (new)

**Estimate:** 4 points

### 3.2 Wiki Link Syntax & Resolution ✅
**Story:** As an author, I want to reference wiki pages inline in my manuscript using a link syntax, so I can instantly jump to related details.

**Status:** Complete

**Accepted Link Syntax:** `[[page-name]]` or `[[page-name|display text]]`

**Acceptance Criteria:**
- [x] CodeMirror extension detects `[[...]]` syntax
- [x] Links highlighted distinctly (color, underline)
- [x] On click (or Cmd+Click), resolve slug and open wiki page in sidebar
- [x] If page doesn't exist, offer "Create?" dialog
- [x] Link preview on hover (first 100 chars of page)
- [x] Ambiguous slugs handled gracefully (show disambiguation if multiple matches)

**Components Involved:**
- `src/lib/wiki-link-parser.js` (slug resolution)
- `src/lib/wiki-link.js` (link parsing utilities)
- `src/lib/codemirror-wiki-link.js` (CodeMirror extension)
- `src/hooks/useWikiLinks.js` (React integration)
- `src/components/WikiLinkPopover.jsx` (UI for disambiguation/create)
- `src/components/Manuscript.jsx` (integration)

**Estimate:** 4 points

### 3.3 Spellcheck Dictionary from Wiki ➡️ Moved to V2
Pending story relocated to Version 2 roadmap (see below).

---

## Version 2 Roadmap

All unfinished MVP stories have been moved here. New V2 scope includes plugins.

### Story 3.3 Spellcheck Dictionary from Wiki (V2)
**Story:** As the system, I need to suppress wiki-derived terms from spellcheck, so proper nouns (character/place names) don't clutter suggestions.

**Acceptance Criteria:**
- [ ] On app startup (or after wiki rebuild), helper scans `wiki/` directory
- [ ] Helper generates spellcheck dictionary: `meta/spellcheck-dict.json` with all wiki page titles
- [ ] Renderer loads dictionary on startup; passes to CodeMirror spellcheck extension
- [ ] Terms in dictionary are not flagged as misspelled
- [ ] Dictionary updates whenever a wiki page is created/renamed
- [ ] Dictionary rebuilds triggered by IPC call `helper:wiki:rebuild-dict`

**Components Involved:**
- `helper/src/wiki/rebuild-dict.js`
- `src/lib/codemirror-extensions` (spellcheck integration)
- `src/hooks/useSpellcheck`

**Estimate:** 3 points

## Epic 4 (V2): Git Workflow & Sync

**Description:** Users can snapshot (local), commit (stage+commit), and push/pull to remotes. Conflicts are detected and surfaced per-chapter.

**Architecture Components:**
- `helper/src/git/commit.js`
- `helper/src/git/pull.js`
- `helper/src/git/push.js`
- `helper/src/backup/create-snapshot.js`
- `src/components/EditorToolbar`

**Stories:**

### 4.1 Snapshot (Local Backup)
**Story:** As an author, I want to create a snapshot of my manuscript state, so I have a local backup before risky operations.

**Acceptance Criteria:**
- [ ] "Snapshot" button in toolbar opens dialog: "Label this snapshot"
- [ ] User enters optional label (e.g., "End of Chapter 5")
- [ ] Helper creates timestamped backup in `meta/backups/<timestamp>-<label>/`
- [ ] Backup includes full snapshot of manuscript/, wiki/, meta/
- [ ] Toast confirms "Snapshot created: <label>"
- [ ] Snapshots can be listed and restored from Diagnostics panel

**Components Involved:**
- `src/components/EditorToolbar/SnapshotButton`
- `src/components/Diagnostics/BackupRestore`
- `helper/src/backup/create-snapshot.js`
- `helper/src/backup/list-snapshots.js`

**Estimate:** 2 points

### 4.2 Commit (Stage & Track)
**Story:** As an author, I want to stage changes and create an explicit commit message, so my git history is meaningful.

**Acceptance Criteria:**
- [ ] "Commit" button opens dialog showing changed chapters (from git diff)
- [ ] User can select/deselect chapters to include
- [ ] User enters commit message
- [ ] On confirm, helper creates git commit with selected files
- [ ] Commit appears in git history (visible in sidebar "Version" tab)
- [ ] Toast confirms commit hash and message
- [ ] Commits must be preceded by a pre-commit snapshot (automatic)

**Components Involved:**
- `src/components/EditorToolbar`
- `src/components/Diagnostics/CommitDialog` (new)
- `helper/src/git/commit.js`
- `src/hooks/useGitHistory` (new)

**Estimate:** 3 points

### 4.3 Push (Send to Remote)
**Story:** As an author, I want to push my commits to a git remote, so my work is backed up off-machine.

**Acceptance Criteria:**
- [ ] "Push" button in toolbar
- [ ] Helper validates remote is configured (SSH URL in `meta/config.yml`)
- [ ] Helper validates system git + SSH agent are available
- [ ] On click, helper runs `git push origin main` (or configured branch)
- [ ] Success: toast "Pushed X commits"
- [ ] Failure: error dialog with guidance (e.g., "SSH key not found: run ssh-add")
- [ ] Push is atomic (all or nothing; no partial state)

**Components Involved:**
- `src/components/EditorToolbar`
- `helper/src/git/push.js`
- `helper/src/export/validate-deps.js` (reuse for git validation)

**Estimate:** 2 points

### 4.4 Pull with Conflict Detection
**Story:** As an author, I want to pull changes from a remote, with automatic detection of conflicts per-chapter.

**Acceptance Criteria:**
- [ ] "Pull" button in toolbar
- [ ] Before pull, helper creates a pre-sync snapshot (automatic, no dialog)
- [ ] Helper runs `git pull origin main`
- [ ] If no conflicts: toast "Pulled X commits"
- [ ] If conflicts detected: Helper parses conflict markers per-chapter
- [ ] Renderer displays diff UI for each conflicted chapter (side-by-side or merged view)
- [ ] User selects which version to keep: "Keep Local" | "Keep Remote" | "Manual Merge"
- [ ] On resolution, helper stages + commits with message "Merge conflict resolved: <chapters>"
- [ ] Backup of conflicted versions preserved in `meta/backups/`

**Components Involved:**
- `src/components/EditorToolbar`
- `src/components/Manuscript/ConflictResolver` (new, diff UI)
- `helper/src/git/pull.js`
- `helper/src/backup/create-snapshot.js`

**Estimate:** 5 points

### 4.5 Git Configuration
**Story:** As an author, I want to configure git settings (remote URL, branch, SSH key), so I can customize my sync workflow.

**Acceptance Criteria:**
- [ ] Settings modal → "Git" section
- [ ] User enters remote URL (e.g., `git@github.com:user/novel.git`)
- [ ] User selects branch (default: main)
- [ ] User specifies SSH key path (default: `~/.ssh/id_rsa`)
- [ ] On save, helper validates remote is reachable: `git ls-remote <url>`
- [ ] Settings stored in `meta/config.yml`
- [ ] Push/pull use configured settings

**Components Involved:**
- `src/components/SettingsModal` (new)
- `helper/src/util/path-helpers.js`

**Estimate:** 2 points

---

## Epic 5 (V2): Export Pipeline

**Description:** Users can export the manuscript to PDF (and optionally EPUB, Markdown). Export validates dependencies and provides install guidance.

**Architecture Components:**
- `src/components/EditorToolbar` (export button)
- `helper/src/export/pdf.js`
- `helper/src/export/validate-deps.js`
- `src/components/Diagnostics/ExportLogs`

**Stories:**

### 5.1 Manuscript to PDF Export
**Story:** As an author, I want to export my manuscript to a publication-ready PDF, so I can share or print it.

**Acceptance Criteria:**
- [ ] "Export" button in toolbar opens export dialog
- [ ] Dialog shows: Chapters included (default: all), metadata fields (title, author, date)
- [ ] "Export to PDF" button triggers `helper:export:pdf`
- [ ] Helper validates Pandoc and TeX are installed; if missing, returns install guidance
- [ ] Helper builds reproducible Pandoc command: collect chapters in order, apply metadata, invoke LaTeX
- [ ] Export runs in subprocess; stdout/stderr captured to `meta/logs/export-<timestamp>.log`
- [ ] On success: PDF saved to `meta/exports/<novel>-<timestamp>.pdf`, toast with file location
- [ ] On failure: error dialog with suggestion (e.g., "Install via: brew install pandoc")
- [ ] Export time typically <30s for 100k-word manuscript

**Components Involved:**
- `src/components/EditorToolbar`
- `src/components/ExportDialog` (new)
- `helper/src/export/pdf.js`
- `helper/src/export/validate-deps.js`
- `helper/src/export/command-builder.js`
- `helper/src/util/subprocess.js`

**Estimate:** 5 points

### 5.2 Metadata & Chapter Ordering
**Story:** As an author, I want to control PDF metadata and chapter order during export.

**Acceptance Criteria:**
- [ ] Export dialog shows chapter list in export order (drag-to-reorder)
- [ ] User can deselect chapters (e.g., skip prologue)
- [ ] User enters: title, author, publication date
- [ ] Metadata embedded in PDF (editable in PDF properties)
- [ ] LaTeX template applies consistent typography (margins, fonts, headers)
- [ ] Template customizable (stored in `helper/src/export/latex-template.tex`)

**Components Involved:**
- `src/components/ExportDialog` (enhanced)
- `helper/src/export/command-builder.js`
- `helper/src/export/latex-template.tex`

**Estimate:** 3 points

### 5.3 Export Validation & Logs
**Story:** As the system, I need to validate export preconditions and capture detailed logs for debugging.

**Acceptance Criteria:**
- [ ] Before export, helper checks: Pandoc installed, TeX installed, chapters exist, no syntax errors
- [ ] All export operations logged to `meta/logs/export-<timestamp>.log`
- [ ] Logs include: command executed, stdout, stderr, exit code, timing
- [ ] Logs retained for last 10 exports; older logs deleted
- [ ] User can view export logs from Diagnostics panel

**Components Involved:**
- `helper/src/export/validate-deps.js`
- `helper/src/util/logging.js`
- `src/components/Diagnostics/LogViewer`

**Estimate:** 2 points

---

## Epic 6 (V2): Spellcheck Integration

**Description:** Spell-check active in editor using macOS native API + wiki-derived dictionary for suppression.

**Architecture Components:**
- `src/lib/codemirror-extensions` (spellcheck marks)
- `helper/src/wiki/rebuild-dict.js`
- macOS native API (via Electron)

**Stories:**

### 6.1 Spellcheck Marks & Menu
**Story:** As an author, I want misspelled words underlined and right-click suggestions, so I can fix typos quickly.

**Acceptance Criteria:**
- [ ] CodeMirror extension adds spellcheck marks (red squiggly underline)
- [ ] Right-click on misspelled word shows context menu with suggestions
- [ ] User can click a suggestion to replace word
- [ ] User can "Ignore" (for this session) or "Add to Dictionary" (persistent)
- [ ] Dictionary persisted in `meta/spellcheck-dict.json`
- [ ] Spellcheck latency <100ms for typical chapters

**Components Involved:**
- `src/lib/codemirror-extensions.ts` (spellcheck extension)
- `src/components/Manuscript/CodeMirrorEditor`

**Estimate:** 3 points

### 6.2 macOS Native Spellchecker
**Story:** As the system, I want to use the platform's native spellchecker, so suggestions are accurate and user experience familiar.

**Acceptance Criteria:**
- [ ] Electron preload script exposes macOS spell-check API to renderer
- [ ] CodeMirror extension uses native spellcheck for suggestions
- [ ] Language defaults to user's system language
- [ ] Performance: suggestions appear <500ms

**Components Involved:**
- `electron/preload.js` (macOS spell-check binding)
- `src/lib/codemirror-extensions.ts`

**Estimate:** 2 points

---

## Epic 7 (V2): Diagnostics & Recovery

**Description:** Users can view logs, manage backups, and recover from corruption or crashes.

**Architecture Components:**
- `src/components/Diagnostics`
- `helper/src/backup/list-snapshots.js`
- `helper/src/backup/restore.js`
- `src/components/Diagnostics/LogViewer`

**Stories:**

### 7.1 Diagnostics Panel
**Story:** As a power user, I want a diagnostics panel to inspect logs, manage backups, and troubleshoot issues.

**Acceptance Criteria:**
- [ ] Settings modal → "Diagnostics" tab (or separate panel)
- [ ] Sections: Logs, Backups, Index Status, Dependency Check
- [ ] Panel displays recent log entries (last 100 lines from all logs)
- [ ] User can filter by domain (git, export, wiki, index)
- [ ] User can refresh dependency check (Pandoc, TeX, Git, SSH)
- [ ] User can trigger "Rebuild Index" (rescans filesystem)
- [ ] User can view/delete backups

**Components Involved:**
- `src/components/Diagnostics`
- `src/components/Diagnostics/LogViewer`
- `src/components/Diagnostics/BackupRestore`
- `src/components/Diagnostics/IndexRebuild`

**Estimate:** 3 points

### 7.2 Backup & Restore
**Story:** As an author, I want to restore from a backup snapshot if I accidentally lose work or corrupt the repo.

**Acceptance Criteria:**
- [ ] Diagnostics panel lists all snapshots with label, timestamp, size
- [ ] User clicks "Restore" on a snapshot
- [ ] Dialog: "Restore will replace current state. Create backup first? [Yes/No]"
- [ ] On confirm, helper restores from backup (atomic operation)
- [ ] Editor refreshes; chapters reload from restored state
- [ ] Toast confirms "Restored from <label> (<timestamp>)"

**Components Involved:**
- `src/components/Diagnostics/BackupRestore`
- `helper/src/backup/restore.js`
- `helper/src/backup/create-snapshot.js`

**Estimate:** 2 points

### 7.3 Index Rebuild
**Story:** As a power user, I want to rebuild the index from scratch if it becomes corrupted or out-of-sync.

**Acceptance Criteria:**
- [ ] Diagnostics panel includes "Rebuild Index" button
- [ ] On click, helper scans `manuscript/` and `wiki/` from disk
- [ ] Helper rebuilds `meta/index.json` and `meta/spellcheck-dict.json`
- [ ] Progress shown (optional: spinner + "Scanning...")
- [ ] On complete, sidebar chapters + wiki list refresh
- [ ] Toast confirms "Index rebuilt: X chapters, Y wiki pages"

**Components Involved:**
- `src/components/Diagnostics/IndexRebuild`
- `helper/src/index/rebuild.js`

**Estimate:** 1 point

---

## Epic 8 (V2): Settings & Configuration

**Description:** Users configure editor preferences, git settings, and backup policies.

**Architecture Components:**
- `src/components/SettingsModal` (new)
- `meta/config.yml`

**Stories:**

### 8.1 Editor Preferences
**Story:** As an author, I want to customize editor appearance (font, line height, theme), so I can create a comfortable writing environment.

**Acceptance Criteria:**
- [ ] Settings modal → "Editor" tab
- [ ] Controls: Font size (8-24pt), Line height (1.0-2.0), Color theme (light/dark/custom)
- [ ] Changes apply immediately (no reload needed)
- [ ] Settings persisted in `meta/config.yml`
- [ ] Settings applied on app launch

**Components Involved:**
- `src/components/SettingsModal`
- `src/hooks/useEditorSettings` (new)
- `src/context/AppProviders` (settings context)

**Estimate:** 2 points

### 8.2 Backup Policy
**Story:** As a power user, I want to configure how often backups are created and how many are retained.

**Acceptance Criteria:**
- [ ] Settings modal → "Backups" tab
- [ ] User configures: auto-backup frequency (e.g., every 5/15/30 minutes), retention count (e.g., keep last 10/20/50)
- [ ] Auto-backups disabled by default; user can enable
- [ ] Settings stored in `meta/config.yml`
- [ ] Helper respects settings; creates backups at configured intervals
- [ ] Oldest backups deleted when retention limit exceeded

**Components Involved:**
- `src/components/SettingsModal`
- `helper/src/backup/create-snapshot.js` (interval logic)

**Estimate:** 2 points

### 8.3 App Initialization (First Launch)
**Story:** As the system, I need to guide users through first-launch setup to ensure dependencies are available.

**Acceptance Criteria:**
- [ ] On first app launch, onboarding dialog appears:
  - "Welcome to ä½å®¶"
  - Check 1: Git installed? (system `git --version`)
  - Check 2: Pandoc installed? (system `pandoc --version`)  
  - Check 3: TeX installed? (system `latex --version`)
  - Check 4: SSH keys configured? (check `~/.ssh/id_rsa`)
- [ ] For each missing dependency, provide install command: `brew install <package>`
- [ ] Allow user to skip checks (expert mode)
- [ ] On completion, offer "Create First Novel" or "Open Existing"

**Components Involved:**
- `src/components/Onboarding` (new)
- `helper/src/export/validate-deps.js`

**Estimate:** 2 points

---

## Epic 9 (V2): App Infrastructure & Packaging

**Description:** Build, package, and distribute the Electron app using electron-builder.

**Architecture Components:**
- `electron/main.js`
- `electron/preload.js`
- `electron-builder.yml`
- `vite.config.ts`

**Stories:**

### 9.1 Electron App Scaffold
**Story:** As a developer, I need a working Electron + Vite + React scaffold so I can build the app.

**Acceptance Criteria:**
- [ ] Root `package.json` with dev scripts: `npm run dev` (start Vite + Electron), `npm run build` (compile all)
- [ ] `electron/main.js` creates window, loads renderer, manages IPC
- [ ] `electron/preload.js` exposes ipcRenderer to renderer context
- [ ] `vite.config.ts` configured for HMR in dev, production build in prod
- [ ] `tsconfig.json` set up for renderer + helper TypeScript
- [ ] All scripts work on macOS; app launches without errors

**Components Involved:**
- Root `package.json`
- `electron/main.js`
- `electron/preload.js`
- `vite.config.ts`
- `tsconfig.json`

**Estimate:** 3 points

### 9.2 electron-builder Configuration
**Story:** As a developer, I need electron-builder configured to produce a distributable .dmg for macOS.

**Acceptance Criteria:**
- [ ] `electron-builder.yml` defines build target: `.dmg` (installer), `.zip` (portable)
- [ ] Code signing configured (macOS developer certificate)
- [ ] Build script: `npm run pack` produces `dist/ä½å®¶-x.y.z.dmg`
- [ ] DMG includes: app bundle, Applications symlink for easy install
- [ ] Build works on current macOS release

**Components Involved:**
- `electron-builder.yml`
- Root `package.json` (build script)

**Estimate:** 2 points

### 9.3 Renderer & Helper Integration
**Story:** As the system, I need IPC handlers to route all renderer requests to the helper process.

**Acceptance Criteria:**
- [ ] `electron/ipc-handlers.js` registers all `helper:*` IPC handlers
- [ ] Each handler calls corresponding helper function with error wrapping
- [ ] All responses follow structured envelope format (status, data/error, timestamp)
- [ ] IPC timeout (e.g., 30s) returns error with code `TIMEOUT`
- [ ] All errors logged to `meta/logs/`

**Components Involved:**
- `electron/ipc-handlers.js`
- `helper/src/ipc/` (handler wrappers)
- `helper/src/util/error.js`

**Estimate:** 2 points

### 9.4 macOS Installer (DMG + Notarization)
**Story:** As a macOS user, I want a standard DMG installer so I can install the app like a typical Mac application.

**Acceptance Criteria:**
- [ ] electron-builder produces signed/notarized `.dmg` and `.zip`
- [ ] App passes Gatekeeper; no “unverified developer” warning
- [ ] Codesigning with Apple Developer ID; notarization ticket stapled
- [ ] DMG includes Applications symlink and branding assets
- [ ] CI script to build + notarize with environment-configured credentials
- [ ] Release artifact attached to GitHub Releases (manual or scripted)

**Components Involved:**
- `electron-builder.yml`
- CI build script (GitHub Actions or equivalent)
- Apple Developer ID cert + notarization API key setup

**Estimate:** 3 points

---

## Epic 10 (V2): Performance & Polish

**Description:** Optimize startup time, editor responsiveness, and overall UX polish.

**Architecture Components:**
- Various (performance optimization across all modules)

**Stories:**

### 10.1 Startup Performance (<5s)
**Story:** As a user, I want the app to launch and show the last-edited novel within 5 seconds.

**Acceptance Criteria:**
- [ ] App startup time measured and logged (<5s target for typical macOS machines)
- [ ] Lazy-load chapters: only load current chapter content; others on-demand
- [ ] Index read: <100ms (in-memory JSON parse)
- [ ] UI rendered: <500ms
- [ ] Profiled and optimized (use Electron DevTools)

**Estimate:** 3 points

### 10.2 Editor Responsiveness (<100ms)
**Story:** As an author, I want zero lag when typing, so writing feels smooth.

**Acceptance Criteria:**
- [ ] Keypresses result in rendered changes <100ms (CodeMirror + React re-render)
- [ ] Autosave debounce doesn't block typing
- [ ] Profiled with DevTools; optimizations applied if needed

**Estimate:** 2 points

### 10.3 Error Messages & Toasts
**Story:** As a user, I want clear, non-technical error messages and success confirmations.

**Acceptance Criteria:**
- [ ] All errors shown as toasts (transient) or dialogs (blocking)
- [ ] Error messages human-readable (not raw error codes)
- [ ] Success messages confirm action (e.g., "Snapshot created: End of Ch 5")
- [ ] Toasts disappear after 3-5s or on click

**Components Involved:**
- `src/components/Toast` (new, or use toast library)
- `src/lib/ipc-client.ts` (error transformation)

**Estimate:** 2 points

---

## Epic 11 (V2): Testing

**Description:** Unit, integration, and E2E tests to validate functionality and prevent regressions.

**Architecture Components:**
- `tests/` (Vitest + React Testing Library)
- `helper/tests/` (Vitest)

**Stories:**

### 11.1 Helper Unit Tests
**Story:** As a developer, I need tests for all helper functions to catch bugs early.

**Acceptance Criteria:**
- [ ] Test coverage for `helper/src/git/`, `helper/src/export/`, `helper/src/index/`, `helper/src/backup/`
- [ ] Tests cover happy paths and error cases
- [ ] Test fixtures provide sample novels, git repos, log files
- [ ] All tests pass; coverage >80%

**Estimate:** 5 points

### 11.2 Component & Hook Tests
**Story:** As a developer, I need tests for React components and hooks.

**Acceptance Criteria:**
- [ ] Tests for: Manuscript, WikiSidebar, EditorToolbar, Diagnostics components
- [ ] Tests for: useNovel, useChapters, useWikiIndex, useIpc hooks
- [ ] Mocked IPC calls; verified correct handlers are invoked
- [ ] All tests pass; coverage >70%

**Estimate:** 5 points

### 11.3 End-to-End Tests
**Story:** As a developer, I need E2E tests to validate critical user workflows.

**Acceptance Criteria:**
- [ ] E2E tests for: create novel → edit chapter → autosave → view history
- [ ] E2E tests for: pull changes → resolve conflict → push
- [ ] E2E tests for: export to PDF (with mocked Pandoc output)
- [ ] Tests run on fresh app instance; validate output files/git state
- [ ] All tests pass

**Estimate:** 5 points

---

## Epic 12 (V2): Plugin System

**Description:** Extensible plugin system enabling third-party or user-authored plugins for editor features, transformations, and integrations. Based on plugin system spec in docs/plugin-system-spec.md.

**Stories:**

### 12.1 Plugin Manifest & Loading
**Story:** As a developer, I need a manifest-driven plugin loader so plugins can declare capabilities and be safely loaded.

**Acceptance Criteria:**
- [ ] Define plugin manifest schema (name, version, permissions, entry points)
- [ ] Validate manifests on load; reject invalid or unsafe permissions
- [ ] Load plugins from `~/.zuojia/plugins` with sandboxed context
- [ ] Provide lifecycle hooks: init, activate, deactivate
- [ ] Errors surfaced in diagnostics/logs

**Estimate:** 3 points

### 12.2 Editor Extension Points
**Story:** As an author, I want plugins to add editor commands and UI, so I can customize my workflow.

**Acceptance Criteria:**
- [ ] Expose extension points: commands palette, toolbar buttons, context menu actions
- [ ] Plugins can register keyboard shortcuts (with conflict detection)
- [ ] Plugin-provided UI runs in isolated iframe/webview to protect host app
- [ ] Permissions gate access to filesystem/IPC

**Estimate:** 3 points

### 12.3 Content Pipelines
**Story:** As an author, I want plugins to transform content (e.g., lint, translate, outline), so I can automate tasks.

**Acceptance Criteria:**
- [ ] Provide pipeline API to read/write manuscript or wiki buffers
- [ ] Support streaming responses for long-running operations
- [ ] Allow dry-run mode (show diff before applying)
- [ ] Long-running jobs report progress and can be canceled

**Estimate:** 4 points

## Story Prioritization & Phasing

### Phase 1: Core Editor (Weeks 1-2)
- **1.1** Create New Novel
- **1.2** Open Existing Novel
- **1.3** Build/Rebuild Index
- **2.1** CodeMirror Editor Integration
- **2.2** Chapter Switching
- **2.3** Autosave to Disk
- **9.1** Electron App Scaffold
- **9.2** electron-builder Configuration
- **9.3** Renderer & Helper Integration

**Phase 1 Estimate:** 22 points
**Goal:** Authors can write and save chapters locally.

### Phase 2: Git Workflow (Weeks 2-3)
- **4.1** Snapshot (Local Backup)
- **4.2** Commit (Stage & Track)
- **4.3** Push (Send to Remote)
- **4.4** Pull with Conflict Detection
- **4.5** Git Configuration

**Phase 2 Estimate:** 12 points
**Goal:** Authors can sync with git remotes and resolve conflicts.

### Phase 3: Wiki & Reference (Week 3)
- **3.1** Wiki Page CRUD
- **3.2** Wiki Link Syntax & Resolution
- **3.3** Spellcheck Dictionary from Wiki
- **6.1** Spellcheck Marks & Menu
- **6.2** macOS Native Spellchecker

**Phase 3 Estimate:** 14 points
**Goal:** Authors can reference world-building details inline.

### Phase 4: Export & Polish (Week 4)
- **5.1** Manuscript to PDF Export
- **5.2** Metadata & Chapter Ordering
- **5.3** Export Validation & Logs
- **2.4** Word Count Display
- **7.1** Diagnostics Panel
- **7.2** Backup & Restore
- **7.3** Index Rebuild
- **8.1** Editor Preferences
- **8.2** Backup Policy
- **8.3** App Initialization (First Launch)

**Phase 4 Estimate:** 20 points
**Goal:** Authors can export PDFs and troubleshoot issues; polish UX.

### Phase 5: Testing & Deployment (Week 4-5)
- **11.1** Helper Unit Tests
- **11.2** Component & Hook Tests
- **11.3** End-to-End Tests
- **10.1** Startup Performance
- **10.2** Editor Responsiveness
- **10.3** Error Messages & Toasts

**Phase 5 Estimate:** 19 points
**Goal:** Test coverage & performance optimization; prepare for release.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Epics | 11 |
| Total Stories | 36 |
| Total Estimate | 88 points |
| Phase 1 (Weeks 1-2) | 22 pts (Core Editor) |
| Phase 2 (Weeks 2-3) | 12 pts (Git Workflow) |
| Phase 3 (Week 3-4) | 14 pts (Wiki & Spellcheck) |
| Phase 4 (Week 4) | 20 pts (Export & Polish) |
| Phase 5 (Week 4-5) | 19 pts (Testing & Deploy) |

---

## Mapping to Architecture Components

Every story is mapped to specific architectural components. Use this table to understand which code modules need to be implemented for each story:

| Story ID | Main Component(s) | Helper Module(s) |
|----------|------------------|-----------------|
| 1.1, 1.2 | Navigation, NovelSelector | index/rebuild, index/get |
| 2.1, 2.2 | Manuscript, CodeMirrorEditor | git/commit |
| 2.3 | Manuscript | git/commit, util/logging |
| 2.4 | WikiSidebar | git/history |
| 3.1 | WikiSidebar | index/rebuild, wiki/list-pages |
| 3.2 | codemirror-extensions, WikiSidebar | index/get |
| 3.3 | codemirror-extensions, context | wiki/rebuild-dict |
| 4.1-4.5 | EditorToolbar, Diagnostics | git/*, backup/* |
| 5.1-5.3 | ExportDialog, Diagnostics | export/pdf, export/validate-deps |
| 6.1, 6.2 | CodeMirrorEditor | (macOS API) |
| 7.1-7.3 | Diagnostics | backup/*, index/* |
| 8.1-8.3 | SettingsModal, Onboarding | (config/meta) |
| 9.1-9.3 | electron/main, electron/preload | ipc/* |
| 10.1-10.3 | All (performance) | All (performance) |
| 11.1-11.3 | All tests | All tests |
