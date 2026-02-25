# Story 2.4: Word Count Display

**Story ID:** 2.4  
**Story Name:** Word Count Display  
**Epic:** Epic 2 - Manuscript Editing & Autosave  
**Points:** 3  
**Status:** In Progress  
**Branch:** story/2.4-word-count

## Story Description

As an author, I want to see word counts for my manuscript, chapter, and words written today, so I can track my writing progress.

## Acceptance Criteria

- [ ] Word count widget in sidebar with toggle: "Manuscript" | "Chapter" | "Today"
- [ ] "Manuscript" shows total words across all chapters
- [ ] "Chapter" shows words in current chapter
- [ ] "Today" shows words added since midnight (from git history if available, else from timestamps)
- [ ] Word counts update after each save (<500ms)
- [ ] Counts are accurate (exclude wiki pages, config, meta/)

## Architecture Components

- `src/components/WikiSidebar/WordCountWidget` (new)
- `src/hooks/useWordCount` (new)
- `helper/src/stats/word-count.js` (new)
- `helper/src/git/history.js` (new - analyze diffs for "today" count)

## Implementation Tasks

### Task 1: Helper - Word Count Utilities
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Create `helper/src/stats/word-count.js`
  - [ ] `calculateWordCount(content)` - count words in markdown string
  - [ ] Exclude code blocks, front matter, metadata
  - [ ] Return accurate count
- [ ] Create `helper/src/stats/manuscript-count.js`
  - [ ] `getManuscriptWordCount(novelPath)` - sum all chapter word counts
  - [ ] Read all files in manuscript/ directory
  - [ ] Exclude .git, temp files
- [ ] Create `helper/src/git/history.js`
  - [ ] `getWordsWrittenToday(novelPath)` - analyze git diffs since midnight
  - [ ] Use git diff to compare current vs midnight
  - [ ] Count added words minus deleted words
  - [ ] Handle case where no git history exists

#### Tests:
- [ ] Test word count accuracy with various markdown inputs
- [ ] Test manuscript total across multiple files
- [ ] Test today's word count with mock git history
- [ ] Test edge cases (empty files, no git, binary files)

**Files Created:**
- [ ] helper/src/stats/word-count.js
- [ ] helper/src/stats/manuscript-count.js
- [ ] helper/src/git/history.js
- [ ] helper/tests/stats.test.js
- [ ] helper/tests/git-history.test.js

### Task 2: Electron IPC Handlers
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Register `helper:stats:word-count` handler in `electron/ipc-handlers.js`
- [ ] Register `helper:stats:manuscript-count` handler
- [ ] Register `helper:stats:today-count` handler
- [ ] Ensure error handling and response envelopes

#### Tests:
- [ ] Test IPC handler registration
- [ ] Test response format matches contract

**Files Modified:**
- [ ] electron/ipc-handlers.js

### Task 3: IPC Client TypeScript
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Add `statsHandlers` to `src/lib/ipc-client.ts`
  - [ ] `wordCount(content: string): Promise<number>`
  - [ ] `manuscriptCount(novelPath: string): Promise<number>`
  - [ ] `todayCount(novelPath: string): Promise<number>`
- [ ] Update type definitions

#### Tests:
- [ ] Type checking passes

**Files Modified:**
- [ ] src/lib/ipc-client.ts

### Task 4: React Hook - useWordCount
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Create `src/hooks/useWordCount.js`
- [ ] Accept: `novelPath`, `currentChapter`, `content`
- [ ] State: `manuscriptCount`, `chapterCount`, `todayCount`, `loading`, `error`
- [ ] Effect: Load all counts on mount and when chapter/content changes
- [ ] Debounce content changes (300ms)
- [ ] Cache manuscript count (refresh every 5 min or on manual refresh)
- [ ] Return: counts, loading state, refresh function

#### Tests:
- [ ] Test initial load of all counts
- [ ] Test debouncing of content changes
- [ ] Test cache behavior for manuscript count
- [ ] Test error handling
- [ ] Test refresh function

**Files Created:**
- [ ] src/hooks/useWordCount.js
- [ ] tests/unit/hooks/useWordCount.test.js

### Task 5: WordCountWidget Component
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Create `src/components/WikiSidebar/WordCountWidget/index.jsx`
- [ ] Toggle buttons: "Manuscript" | "Chapter" | "Today"
- [ ] Display selected count with label
- [ ] Loading indicator while counts load
- [ ] Error state if count fails
- [ ] Format numbers with commas (1,234)
- [ ] Refresh button to manually update
- [ ] Style with dark theme support

#### Tests:
- [ ] Test renders with loading state
- [ ] Test toggle between Manuscript/Chapter/Today
- [ ] Test displays correct count for each mode
- [ ] Test loading indicator shows/hides
- [ ] Test error state displays
- [ ] Test refresh button calls hook refresh
- [ ] Test number formatting

**Files Created:**
- [ ] src/components/WikiSidebar/WordCountWidget/index.jsx
- [ ] src/components/WikiSidebar/WordCountWidget/WordCountWidget.css
- [ ] tests/unit/components/WordCountWidget.test.jsx

### Task 6: Integration with WikiSidebar
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Import WordCountWidget into `src/components/WikiSidebar/index.jsx`
- [ ] Pass novelPath and currentChapter as props
- [ ] Position widget at top of sidebar
- [ ] Ensure responsive layout

#### Tests:
- [ ] Test WordCountWidget renders in WikiSidebar
- [ ] Test props passed correctly

**Files Modified:**
- [ ] src/components/WikiSidebar/index.jsx

### Task 7: Integration Testing
**Status:** [ ] Not Started

#### Subtasks:
- [ ] Create integration test for complete word count flow
- [ ] Test manuscript count updates when chapter saved
- [ ] Test chapter count updates when content changes
- [ ] Test today count with mock git operations
- [ ] Test performance (<500ms for updates)

**Files Created:**
- [ ] tests/integration/word-count.test.js

### Task 8: Manual Testing
**Status:** [ ] Not Started

#### Checklist:
- [ ] Word count widget appears in sidebar
- [ ] Toggle switches between Manuscript/Chapter/Today
- [ ] Manuscript count shows total across all chapters
- [ ] Chapter count updates as typing
- [ ] Today count increments as writing
- [ ] Counts format with commas
- [ ] Loading indicators work
- [ ] Refresh button updates counts
- [ ] Performance is responsive

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

## Story Complete

**Completion Date:** _TBD_  
**Final Commit:** _TBD_  
**Merged to Main:** _TBD_
