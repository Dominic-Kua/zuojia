# Story 3.1: Wiki Page CRUD

**Story ID:** 3.1  
**Story Name:** Wiki Page CRUD  
**Epic:** Epic 3 - Wiki System & Contextual Reference  
**Points:** 4  
**Status:** ✅ Complete  
**Branch:** main

## Story Description

As an author, I want to create and edit wiki pages for characters, places, and world details, so I can maintain a reference system for my manuscript.

**Implementation Status:** All features complete and merged to main.

## Acceptance Criteria

- [x] "+" button in Wiki tab opens "New Wiki Page" dialog
- [x] User enters page title (e.g., "Alice the Protagonist")
- [x] Helper stores as `wiki/<slug>.md` (slug derived from title)
- [x] Wiki page opens in sidebar editor
- [x] Existing wiki pages listed in Wiki sidebar with search
- [x] Clicking a wiki page opens it in sidebar editor
- [x] Changes to wiki pages autosave with debounce
- [x] Wiki pages can be renamed (updates slug, preserves content)
- [x] Wiki pages support tags via YAML frontmatter
- [x] Preview mode with Markdown rendering
- [x] Wiki link syntax and image embeds supported in preview

## Architecture Components

- `src/components/WikiSidebar`
- `src/components/WikiSidebar/WikiPageCard`
- `helper/src/wiki/crud.js` (new)
- `helper/src/wiki/list-pages.js` (new)
- `helper/src/index/rebuild.js` (update for wiki)

## Implementation Tasks

### Task 1: Helper - Wiki CRUD Operations
**Status:** ✅ Complete

#### Subtasks:
- [x] Create `helper/src/wiki/crud.js`
  - [x] `createWikiPage(novelPath, title, content, tags)` - create new wiki page with slug and YAML frontmatter
  - [x] `readWikiPage(novelPath, slug)` - read wiki page content with frontmatter parsing
  - [x] `updateWikiPage(novelPath, slug, content, tags)` - update wiki page with atomic write
  - [x] `deleteWikiPage(novelPath, slug)` - delete wiki page
  - [x] `renameWikiPage(novelPath, oldSlug, newTitle)` - rename with new slug, preserve content
  - [x] Slug generation: lowercase, hyphens, alphanumeric + unicode
- [x] Create `helper/src/wiki/list-pages.js`
  - [x] `listWikiPages(novelPath)` - scan wiki/ directory
  - [x] Return: array of {slug, title, tags, wordCount, lastModified}
  - [x] Extract title and tags from YAML frontmatter
  - [x] Sort alphabetically by title

#### Tests:
- [x] Test slug generation from titles
- [x] Test create wiki page with tags
- [x] Test read wiki page
- [x] Test update wiki page
- [x] Test delete wiki page
- [x] Test rename wiki page (old file deleted, new created)
- [x] Test list wiki pages
- [x] Test list returns empty array for no wiki pages
- [x] Test error handling (invalid paths, missing files)

**Files Created:**
- [x] helper/src/wiki/crud.js
- [x] helper/src/wiki/list-pages.js
- [x] helper/tests/wiki.test.js

### Task 2: Electron IPC Handlers
**Status:** ✅ Complete

#### Subtasks:
- [x] Register `helper:wiki:create` handler
- [x] Register `helper:wiki:read` handler
- [x] Register `helper:wiki:update` handler
- [x] Register `helper:wiki:delete` handler
- [x] Register `helper:wiki:rename` handler
- [x] Register `helper:wiki:list` handler
- [x] Ensure error handling and response envelopes

#### Tests:
- [x] Test IPC handlers registered
- [x] Test response format

**Files Modified:**
- [x] electron/ipc-handlers.js

### Task 3: IPC Client TypeScript
**Status:** ✅ Complete

#### Subtasks:
- [x] Add `wikiHandlers` to `src/lib/ipc-client.ts`
  - [x] `create(novelPath, title, content, tags)` - Returns {slug, title, tags}
  - [x] `read(novelPath, slug)` - Returns {content, title, tags}
  - [x] `update(novelPath, slug, content, tags)` - Returns success
  - [x] `delete(novelPath, slug)` - Returns success
  - [x] `rename(novelPath, oldSlug, newTitle)` - Returns {newSlug}
  - [x] `list(novelPath)` - Returns {pages: Array}

#### Tests:
- [x] Type checking passes

**Files Modified:**
- [x] src/lib/ipc-client.ts

### Task 4: React Hook - useWikiPages
**Status:** ✅ Complete

#### Subtasks:
- [x] Create `src/hooks/useWikiPages.js`
- [x] Accept: `novelPath`
- [x] State: `pages`, `loading`, `error`
- [x] Methods: `createPage`, `deletePage`, `renamePage`, `refresh`, `search`, `getPageBySlug`
- [x] Load pages on mount
- [x] Auto-refresh after create/delete/rename

#### Tests:
- [x] Test initial load of pages
- [x] Test createPage updates list
- [x] Test deletePage removes from list
- [x] Test renamePage updates list
- [x] Test error handling
- [x] Test refresh reloads

**Files Created:**
- [x] src/hooks/useWikiPages.js
- [x] tests/unit/hooks/useWikiPages.test.js

### Task 5: WikiPageList Component
**Status:** ✅ Complete

#### Subtasks:
- [x] Create `src/components/WikiSidebar/WikiPageList/index.jsx`
- [x] Display list of wiki pages
- [x] Search/filter by title and tags
- [x] Click to open page in sidebar editor
- [x] Show word count and last modified
- [x] "+" button to create new page
- [x] Context menu for rename/delete
- [x] Empty state when no pages

#### Tests:
- [x] Test renders empty state
- [x] Test renders list of pages
- [x] Test search filters pages
- [x] Test click opens page
- [x] Test create button opens dialog
- [x] Test rename action
- [x] Test delete action

### Task 6: WikiSidebar Integration
**Status:** ✅ Complete

#### Implementation:
- [x] Integrated complete wiki editing into `src/components/Sidebar.jsx`
- [x] Wiki page list with search
- [x] Create page dialog (+  button)
- [x] Full wiki editor with autosave (300ms debounce)
- [x] Preview/edit mode toggle
- [x] Tag management (add/remove tags)
- [x] Title editing with debounced rename
- [x] Delete confirmation
- [x] Markdown rendering with wiki link support
- [x] Image embed support ![[image.png|Caption]]
- [x] MediaWiki-style [[File:name|Caption]] syntax

**Files Modified:**
- [x] src/components/Sidebar.jsx

## Additional Features Implemented

Beyond the original acceptance criteria, the following enhancements were added:

1. **YAML Frontmatter Support**: Wiki pages store metadata (title, tags) in YAML frontmatter
2. **Tag System**: Add/remove tags with visual tag chips
3. **Preview Mode**: Toggle between edit and rendered Markdown preview
4. **Live Title Editing**: Edit page title inline with debounced rename
5. **Wiki Link Rendering**: `[[Page]]` and `[[Page|Label]]` syntax in preview
6. **Image Embeds**: Multiple syntaxes supported with captions
7. **Auto-sanitization**: DOMPurify used for safe HTML rendering

## Dev Agent Record

### Implementation Log

**2026-03-02** - Story marked complete. All functionality implemented and merged to main.

### Key Implementation Decisions:

1. **YAML Frontmatter**: Used for structured metadata instead of separate metadata files. Allows tags and title to be stored with content.

2. **Integrated Editor**: Built wiki editing directly into Sidebar component rather than creating separate WikiEditor component. Provides cohesive UX.

3. **Debounced Operations**: Title editing and content autosave use 300ms debounce to avoid excessive IPC calls and file operations.

4. **Atomic Writes**: All file operations use temp file + rename pattern for atomicity.

5. **Slug Normalization**: Supports unicode characters, converts to lowercase, replaces spaces with hyphens.

## File List

### Created Files:
- ✅ helper/src/wiki/crud.js
- ✅ helper/src/wiki/list-pages.js
- ✅ helper/tests/wiki.test.js
- ✅ src/hooks/useWikiPages.js
- ✅ src/components/WikiSidebar/WikiPageList/index.jsx
- ✅ src/lib/wiki-link-parser.js (helper for slug resolution)
- ✅ tests/unit/hooks/useWikiPages.test.js
- ✅ tests/unit/components/WikiPageList.test.jsx
- ✅ tests/integration/wiki-crud-flow.test.js
- ✅ tests/e2e/wiki-operations.spec.js

### Modified Files:
- ✅ electron/ipc-handlers.js (added wiki handlers)
- ✅ src/lib/ipc-client.ts (added wikiHandlers)
- ✅ src/components/Sidebar.jsx (integrated wiki editing)
- ✅ helper/src/index/rebuild.js (added wiki scanning)

## Test Results

### Final Test Count:
- Helper tests: 20+ passing
- Hook tests: 10+ passing
- Component tests: 8+ passing
- Integration tests: 6+ passing
- E2E tests: 4+ passing
- **All tests passing ✅**

## Code Review Notes

✅ Code Review Complete:
- [x] All tests passing (100%)
- [x] No console.log statements (except intentional logging)
- [x] Error handling complete
- [x] TypeScript types correct
- [x] CSS theme consistency
- [x] No unused imports
- [x] Documentation complete
- [x] DOMPurify used for XSS protection
- [x] Atomic file operations implemented

## Story Complete ✅

**Completion Date:** 2026-03-02
**Status:** Merged to Main  
**All Acceptance Criteria:** Met (with enhancements)

**Files Created:**
- [ ] src/components/WikiSidebar/WikiPageList/index.jsx
- [ ] src/components/WikiSidebar/WikiPageList/WikiPageList.css
- [ ] tests/unit/components/WikiPageList.test.jsx

### Task 6: WikiPageEditor Component
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Create `src/components/WikiSidebar/WikiPageEditor/index.jsx`
- [ ] CodeMirror markdown editor for wiki content
- [ ] Save button (manual)
- [ ] Auto-save on idle (5 min)
- [ ] Shows save status
- [ ] Close button returns to list
- [ ] Unsaved changes warning

#### Tests:
- [ ] Test renders editor with content
- [ ] Test manual save
- [ ] Test auto-save after idle
- [ ] Test close with unsaved changes
- [ ] Test save status indicators

**Files Created:**
- [ ] src/components/WikiSidebar/WikiPageEditor/index.jsx
- [ ] src/components/WikiSidebar/WikiPageEditor/WikiPageEditor.css
- [ ] tests/unit/components/WikiPageEditor.test.jsx

### Task 7: CreateWikiDialog Component
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Create `src/components/WikiSidebar/CreateWikiDialog/index.jsx`
- [ ] Modal dialog for creating wiki page
- [ ] Input: page title
- [ ] Preview generated slug
- [ ] Validation: non-empty, unique slug
- [ ] Create & Open button
- [ ] Cancel button
- [ ] Error display

#### Tests:
- [ ] Test renders dialog
- [ ] Test title input updates slug preview
- [ ] Test validation errors
- [ ] Test create calls handler
- [ ] Test cancel closes dialog

**Files Created:**
- [ ] src/components/WikiSidebar/CreateWikiDialog/index.jsx
- [ ] src/components/WikiSidebar/CreateWikiDialog/CreateWikiDialog.css
- [ ] tests/unit/components/CreateWikiDialog.test.jsx

### Task 8: Update WikiSidebar Integration
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Update `src/components/WikiSidebar/index.jsx` (if exists) or create
- [ ] Integrate WikiPageList
- [ ] Integrate WikiPageEditor
- [ ] Integrate CreateWikiDialog
- [ ] Handle state: list view vs editor view
- [ ] Pass novelPath prop

#### Tests:
- [ ] Test toggle between list and editor
- [ ] Test create dialog flow
- [ ] Test page selection

**Files Modified/Created:**
- [ ] src/components/WikiSidebar/index.jsx

### Task 9: Update Index to Track Wiki Pages
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Update `helper/src/index/rebuild.js` to scan wiki/ directory
- [ ] Add `wikiPages` array to index.json schema
- [ ] Store: slug, title, wordCount, lastModified
- [ ] Update index after wiki CRUD operations

#### Tests:
- [ ] Test rebuild includes wiki pages
- [ ] Test index updates after create
- [ ] Test index updates after delete
- [ ] Test index updates after rename

**Files Modified:**
- [ ] helper/src/index/rebuild.js
- [ ] helper/tests/index.test.js

### Task 10: Integration Testing
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Create integration test for complete wiki flow
- [ ] Test: create page → list updates → open editor → save → list reflects changes
- [ ] Test: rename page → old slug invalid, new slug works
- [ ] Test: delete page → list updates, file removed

**Files Created:**
- [ ] tests/integration/wiki-crud.test.js

### Task 11: Manual Testing
**Status:** [ ] Not Started

#### Checklist:
- [ ] Wiki sidebar shows list of pages
- [ ] Create new wiki page with "+" button
- [ ] Page appears in list
- [ ] Click page opens editor
- [ ] Editor shows markdown content
- [ ] Save button persists changes
- [ ] Auto-save works after idle
- [ ] Search filters wiki pages
- [ ] Rename page updates slug and filename
- [ ] Delete page removes from list and disk
- [ ] Unsaved changes warning works

## Dev Agent Record

_Document implementation notes, decisions, and challenges here as tasks complete._

### Implementation Log

<!-- Add timestamped entries as work progresses -->

## File List

_List all files created or modified during this story implementation._

### Created Files:
<!-- Updated as files are created -->

### Modified Files:
<!-- Updated as files are modified -->

## Test Results

_Document test results for each task._

### Task Test Summary:
<!-- Update after each task -->

### Final Test Count:
<!-- Update when story complete -->
- Helper tests: X passing
- Hook tests: Y passing
- Component tests: Z passing
- Integration tests: W passing
- **Total: N passing**

## Code Review Notes

_Self-review checklist before pushing:_

- [ ] All tests passing (100%)
- [ ] No console.log statements
- [ ] Error handling complete
- [ ] TypeScript types correct
- [ ] CSS theme consistency
- [ ] No unused imports
- [ ] Documentation complete
- [ ] Performance requirements met
- [ ] Slug generation handles edge cases
- [ ] File operations are safe (atomic writes)

## Story Complete

**Completion Date:** _TBD_  
**Final Commit:** _TBD_  
**Merged to Main:** _TBD_
