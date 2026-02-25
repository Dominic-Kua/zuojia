# Story 3.1: Wiki Page CRUD

**Story ID:** 3.1  
**Story Name:** Wiki Page CRUD  
**Epic:** Epic 3 - Wiki System & Contextual Reference  
**Points:** 4  
**Status:** In Progress  
**Branch:** story/3.1-wiki-crud

## Story Description

As an author, I want to create and edit wiki pages for characters, places, and world details, so I can maintain a reference system for my manuscript.

## Acceptance Criteria

- [ ] "+" button in Wiki tab opens "New Wiki Page" dialog
- [ ] User enters page title (e.g., "Alice the Protagonist")
- [ ] Helper stores as `wiki/<slug>.md` (slug derived from title)
- [ ] Wiki page opens in editor pane (or overlay)
- [ ] Existing wiki pages listed in Wiki sidebar with search
- [ ] Clicking a wiki page opens it in sidebar editor
- [ ] Changes to wiki pages autosave like chapters
- [ ] Wiki pages can be renamed (updates index, backups generated)

## Architecture Components

- `src/components/WikiSidebar`
- `src/components/WikiSidebar/WikiPageCard`
- `helper/src/wiki/crud.js` (new)
- `helper/src/wiki/list-pages.js` (new)
- `helper/src/index/rebuild.js` (update for wiki)

## Implementation Tasks

### Task 1: Helper - Wiki CRUD Operations
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Create `helper/src/wiki/crud.js`
  - [ ] `createWikiPage(novelPath, title, content)` - create new wiki page with slug
  - [ ] `readWikiPage(novelPath, slug)` - read wiki page content
  - [ ] `updateWikiPage(novelPath, slug, content)` - update wiki page
  - [ ] `deleteWikiPage(novelPath, slug)` - delete wiki page
  - [ ] `renameWikiPage(novelPath, oldSlug, newTitle)` - rename with new slug
  - [ ] Slug generation: lowercase, hyphens, alphanumeric only
- [ ] Create `helper/src/wiki/list-pages.js`
  - [ ] `listWikiPages(novelPath)` - scan wiki/ directory
  - [ ] Return: array of {slug, title, filepath, wordCount, lastModified}
  - [ ] Extract title from first H1 in markdown
  - [ ] Sort alphabetically by title

#### Tests:
- [ ] Test slug generation from titles
- [ ] Test create wiki page
- [ ] Test read wiki page
- [ ] Test update wiki page
- [ ] Test delete wiki page
- [ ] Test rename wiki page (old file deleted, new created)
- [ ] Test list wiki pages
- [ ] Test list returns empty array for no wiki pages
- [ ] Test error handling (invalid paths, missing files)

**Files Created:**
- [ ] helper/src/wiki/crud.js
- [ ] helper/src/wiki/list-pages.js
- [ ] helper/tests/wiki.test.js

### Task 2: Electron IPC Handlers
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Register `helper:wiki:create` handler
- [ ] Register `helper:wiki:read` handler
- [ ] Register `helper:wiki:update` handler
- [ ] Register `helper:wiki:delete` handler
- [ ] Register `helper:wiki:rename` handler
- [ ] Register `helper:wiki:list` handler
- [ ] Ensure error handling and response envelopes

#### Tests:
- [ ] Test IPC handlers registered
- [ ] Test response format

**Files Modified:**
- [ ] electron/ipc-handlers.js

### Task 3: IPC Client TypeScript
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Add `wikiHandlers` to `src/lib/ipc-client.ts`
  - [ ] `create(novelPath: string, title: string, content: string): Promise<{slug: string}>`
  - [ ] `read(novelPath: string, slug: string): Promise<{content: string}>`
  - [ ] `update(novelPath: string, slug: string, content: string): Promise<void>`
  - [ ] `delete(novelPath: string, slug: string): Promise<void>`
  - [ ] `rename(novelPath: string, oldSlug: string, newTitle: string): Promise<{newSlug: string}>`
  - [ ] `list(novelPath: string): Promise<{pages: Array}>`

#### Tests:
- [ ] Type checking passes

**Files Modified:**
- [ ] src/lib/ipc-client.ts

### Task 4: React Hook - useWikiPages
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Create `src/hooks/useWikiPages.js`
- [ ] Accept: `novelPath`
- [ ] State: `pages`, `loading`, `error`, `selectedPage`
- [ ] Methods: `createPage`, `loadPage`, `updatePage`, `deletePage`, `renamePage`, `refreshList`
- [ ] Load pages on mount
- [ ] Auto-refresh after create/delete/rename

#### Tests:
- [ ] Test initial load of pages
- [ ] Test createPage updates list
- [ ] Test loadPage loads selected page
- [ ] Test updatePage saves content
- [ ] Test deletePage removes from list
- [ ] Test renamePage updates list
- [ ] Test error handling
- [ ] Test refreshList reloads

**Files Created:**
- [ ] src/hooks/useWikiPages.js
- [ ] tests/unit/hooks/useWikiPages.test.js

### Task 5: WikiPageList Component
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Create `src/components/WikiSidebar/WikiPageList/index.jsx`
- [ ] Display list of wiki pages
- [ ] Search/filter by title
- [ ] Click to open page
- [ ] Show word count and last modified
- [ ] "+" button to create new page
- [ ] Context menu for rename/delete
- [ ] Empty state when no pages

#### Tests:
- [ ] Test renders empty state
- [ ] Test renders list of pages
- [ ] Test search filters pages
- [ ] Test click opens page
- [ ] Test create button opens dialog
- [ ] Test rename action
- [ ] Test delete action

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
