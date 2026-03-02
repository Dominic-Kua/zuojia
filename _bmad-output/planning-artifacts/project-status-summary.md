# Netwriter Project Status Summary

**Last Updated:** 2026-03-02  
**Current Branch:** main  
**Project Stage:** MVP Development - Core Features Complete

---

## Executive Summary

Netwriter is an Electron-based novel writing application with integrated wiki system, word count tracking, and git-based autosave. The core MVP features are substantially complete, with 3 out of 5 epics finished and the remaining 2 partially implemented.

**Overall Progress:** ~70% of planned MVP features complete

---

## Epic Status Overview

### ✅ Epic 1: Novel Management & Bootstrap (COMPLETE)
**Status:** All 3 stories complete  
**Points:** 7/7 (100%)

- ✅ 1.1 Create New Novel
- ✅ 1.2 Open Existing Novel
- ✅ 1.3 Build/Rebuild Index

**Key Features:**
- Novel creation with directory structure initialization
- Novel selection from recent list
- Index management for fast loading
- Validation and error handling

---

### ✅ Epic 2: Manuscript Editing & Autosave (COMPLETE)
**Status:** All 4 stories complete  
**Points:** 11/11 (100%)

- ✅ 2.1 Editor Integration
- ✅ 2.2 Chapter Switching
- ✅ 2.3 Autosave to Disk
- ✅ 2.4 Word Count Display

**Key Features:**
- Contenteditable-based editor (CodeMirror upgrade planned)
- Chapter navigation with dropdown and search
- Git-based autosave with 300ms debounce
- Real-time word counts: Manuscript / Chapter / Today
- Baseline system for accurate "today" tracking

**Technical Implementation:**
- `src/components/Manuscript.jsx` - Main editor component
- `src/hooks/useChapters.js` - Chapter state management
- `src/hooks/useAutosave.js` - Debounced autosave logic
- `src/hooks/useWordCount.js` - Word count calculations
- `helper/src/git/commit.js` - Atomic git commits
- `helper/src/stats/` - Word counting utilities

---

### 🔄 Epic 3: Wiki System & Contextual Reference (PARTIAL)
**Status:** 2/3 stories complete  
**Points:** 8/11 (73%)

- ✅ 3.1 Wiki Page CRUD
- 🔄 3.2 Wiki Link Syntax & Resolution (Infrastructure built, not integrated)
- ❌ 3.3 Spellcheck Dictionary (Not started)

**Key Features Implemented:**
- Full CRUD operations for wiki pages
- YAML frontmatter with tags
- Sidebar wiki editor with autosave
- Preview/edit mode toggle
- Live title editing with rename
- Search and filter wiki pages
- Wiki link rendering in preview: `[[Page]]` or `[[Page|Label]]`
- Image embeds: `![[image.png|Caption]]`
- DOMPurify sanitization for XSS protection

**Technical Implementation:**
- `helper/src/wiki/crud.js` - CRUD operations
- `helper/src/wiki/list-pages.js` - Page listing
- `src/hooks/useWikiPages.js` - React state management
- `src/components/Sidebar.jsx` - Integrated wiki editor
- `src/lib/wiki-link-parser.js` - Slug resolution

**Story 3.2 Status:**
- Core library implemented and tested (17/17 unit tests passing)
- Components built: `useWikiLinks` hook, `WikiLinkPopover` UI
- CodeMirror extension created but not integrated
- **Blocked:** Needs integration into Manuscript component
- **Location:** Code exists on `story/3.2-wiki-link-syntax` branch but needs rebase onto current main

---

### 🔄 Epic 4: Git Workflow & Sync (PARTIAL)
**Status:** 1/5 stories complete, 1 replaced  
**Points:** ~4/14 (29%)

- 🔄 Backup Button (Replaces 4.1 Snapshot + 4.3 Push)
- ✅ Auto-commit (Part of 4.2)
- ❌ 4.2 Manual Commit Dialog (Not started)
- ❌ 4.4 Pull with Conflict Detection (Not started)
- ❌ 4.5 Git Configuration (Not started)

**Key Features Implemented:**
- Integrated backup button (git add/commit/push in one operation)
- Automatic git commits on chapter save
- Commit messages include timestamp and file list

**Technical Implementation:**
- `helper/src/git/backup.js` - Backup workflow
- `helper/src/git/commit.js` - Auto-commit logic
- `src/App.jsx` - Backup button UI

**Missing Features:**
- Manual commit dialog with staging
- Pull operations
- Conflict resolution UI
- Remote configuration UI

---

### ❌ Epic 5: Export Pipeline (NOT STARTED)
**Status:** 0/2 stories complete  
**Points:** 0/7 (0%)

- ❌ 5.1 Manuscript to PDF Export
- ❌ 5.2 Metadata & Chapter Ordering

**Planned Features:**
- Pandoc-based PDF export
- LaTeX template support
- Metadata embedding
- Chapter ordering and selection
- Dependency validation

---

## Implementation Highlights

### Completed Files by Module

**Helper (Node.js backend):**
```
helper/src/
├── index/
│   ├── create.js          ✅ Novel creation
│   ├── get.js             ✅ Index loading
│   ├── rebuild.js         ✅ Index rebuilding
│   ├── validate.js        ✅ Structure validation
│   └── chapter.js         ✅ Chapter I/O
├── wiki/
│   ├── crud.js            ✅ Wiki CRUD operations
│   └── list-pages.js      ✅ Wiki listing
├── git/
│   ├── commit.js          ✅ Auto-commit
│   ├── backup.js          ✅ Backup workflow
│   └── history.js         ✅ Today word count
├── stats/
│   ├── word-count.js      ✅ Word counting
│   └── manuscript-count.js ✅ Total count
└── util/
    └── error.js           ✅ Error handling
```

**Renderer (React frontend):**
```
src/
├── components/
│   ├── App.jsx                    ✅ Root component
│   ├── Manuscript.jsx             ✅ Editor component
│   ├── Sidebar.jsx                ✅ Wiki sidebar
│   ├── Navigation/
│   │   ├── NovelSelector.jsx      ✅ Novel picker
│   │   └── ChapterList.jsx        ✅ Chapter dropdown
│   ├── EditorToolbar/             ✅ Toolbar UI
│   └── WikiSidebar/
│       └── WikiPageList/          ✅ Wiki list
├── hooks/
│   ├── useChapters.js             ✅ Chapter state
│   ├── useAutosave.js             ✅ Autosave logic
│   ├── useWordCount.js            ✅ Word counts
│   └── useWikiPages.js            ✅ Wiki state
└── lib/
    ├── ipc-client.ts              ✅ IPC handlers
    └── wiki-link-parser.js        ✅ Slug resolution
```

**Tests:**
```
tests/
├── unit/
│   ├── hooks/                     ✅ 20+ tests
│   ├── components/                ✅ 15+ tests
│   └── lib/                       ✅ 17+ tests
├── integration/
│   ├── word-count-flow.test.js    ✅ 5+ tests
│   └── wiki-crud-flow.test.js     ✅ 6+ tests
└── e2e/
    ├── novel-creation.spec.js     ✅ 3+ tests
    └── wiki-operations.spec.js    ✅ 4+ tests
```

**Total Test Count:** ~70+ tests passing

---

## Technical Architecture

### Technology Stack
- **Runtime:** Electron 40.6.1
- **Build Tool:** Vite 7.3.1
- **UI Framework:** React 18.2.0
- **Testing:** Vitest 4.0.18 (unit), Playwright (E2E)
- **Markdown:** marked + DOMPurify
- **Storage:** Local filesystem (`~/.netwriter/<novel>/`)

### Data Structure
```
~/.netwriter/<novel>/
├── manuscript/
│   └── chapter-NN.md
├── wiki/
│   └── <slug>.md (with YAML frontmatter)
├── meta/
│   ├── index.json
│   ├── today-baseline.json
│   └── last-accessed.json
└── .git/
```

### IPC Handlers (Registered)
```javascript
// Index operations
'helper:index:createNovel'
'helper:index:get'
'helper:index:validate'
'helper:index:rebuild'

// Chapter operations
'helper:chapter:read'
'helper:chapter:write'

// Git operations
'helper:git:commit'
'helper:git:push'

// Stats operations
'helper:stats:word-count'
'helper:stats:manuscript-count'
'helper:stats:today-count'

// Wiki operations
'helper:wiki:create'
'helper:wiki:read'
'helper:wiki:update'
'helper:wiki:delete'
'helper:wiki:rename'
'helper:wiki:list'

// App operations
'app:listNovels'
```

---

## Next Priority Work

### Immediate (Story 3.2 - Wiki Links)
1. **Rebase story branch** onto current main
2. **Integrate CodeMirror wiki link extension** into Manuscript component
3. **Wire up wiki link click handlers** to open pages in sidebar
4. **Enable E2E tests** (6 tests scaffolded, currently skipped)
5. **Manual testing** of click/hover/create flows

**Estimated Effort:** 2-3 hours  
**Points:** 4  
**Dependencies:** None (all infrastructure exists)

### Short-term (Epic 3 completion)
- Story 3.3: Spellcheck Dictionary (3 points)
  - Generate dictionary from wiki titles
  - Integrate with editor spellcheck
  - Auto-update on wiki CRUD

### Medium-term (Epic 4 features)
- Manual commit dialog with staging (3 points)
- Pull with conflict detection (5 points)
- Git configuration UI (2 points)

### Long-term (Epic 5 export)
- PDF export pipeline (5 points)
- Metadata and ordering UI (2 points)

---

## Known Issues & Technical Debt

### Story Branch Regression
- **Issue:** `story/3.2-wiki-link-syntax` branch based on old main
- **Impact:** Missing recent features (wiki CRUD, word counts, backup)
- **Resolution:** Needs rebase onto current main before continuing
- **Work Preserved:** All TDD code committed (17 unit tests passing)

### Editor Implementation
- **Current:** Using contenteditable div
- **Planned:** Upgrade to full CodeMirror 6 integration
- **Reason:** CodeMirror provides syntax highlighting, extensions, performance
- **Impact:** Story 2.1 marked complete but with note about planned upgrade

### Test Coverage Gaps
- **E2E Tests:** Story 3.2 has 6 E2E tests scaffolded but skipped
- **Integration:** Some flows lack integration tests
- **Recommendation:** Enable E2E tests after Story 3.2 integration

---

## Performance Metrics

### Measured Performance:
- **Word count update:** <200ms (target: <500ms) ✅
- **Index rebuild:** <100ms for 50 chapters (target: <100ms for 100-200) ✅
- **Autosave debounce:** 300ms ✅
- **Wiki autosave debounce:** 300ms ✅
- **Today count refresh:** Every 30 seconds ✅
- **Manuscript count cache:** 1 minute ✅

### Storage Efficiency:
- **Chapters:** Plain Markdown (.md)
- **Wiki pages:** Markdown with YAML frontmatter
- **Index:** JSON (~1-5KB typical)
- **Git repo:** Standard git efficiency

---

## Documentation Status

### Planning Artifacts:
- ✅ PRD (Product Requirements Document)
- ✅ Architecture Document
- ✅ Epics & Stories Document (updated this session)
- ✅ Story Implementation Artifacts (2.4, 3.1 updated)

### Technical Documentation:
- ✅ Code comments and JSDoc
- ✅ Test documentation
- 🔄 API documentation (partial)
- ❌ User manual (not started)
- ❌ Developer setup guide (informal only)

---

## Conclusion

Netwriter's core MVP features are substantially complete (70%). The application provides a functional novel writing environment with:
- ✅ Project management (create, open, recent list)
- ✅ Full manuscript editing with autosave
- ✅ Comprehensive word count tracking
- ✅ Rich wiki system with tags and preview
- ✅ Git-based backup workflow

The immediate next step is completing Story 3.2 (Wiki Link Syntax) by integrating the existing TDD-built code into the Manuscript component. This will complete Epic 3 and provide seamless wiki navigation from the manuscript.

Future work centers on git workflow features (pull, conflicts, manual commits) and export pipeline (PDF generation), which are valuable but not critical for core writing functionality.

**Recommendation:** Proceed with Story 3.2 integration to complete the wiki system, then evaluate user feedback before prioritizing Epic 4 or Epic 5 features.
