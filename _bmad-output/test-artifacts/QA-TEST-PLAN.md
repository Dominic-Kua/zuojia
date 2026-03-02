# Netwriter QA Test Plan

**Version:** 1.0  
**Date:** February 26, 2026  
**QA Lead:** Murat (QA Agent)  
**Status:** In Progress

## Executive Summary

This document outlines the comprehensive testing strategy for Netwriter, covering unit tests, integration tests, end-to-end tests, and manual test procedures. The goal is to ensure all implemented stories meet their acceptance criteria and the application functions correctly as a whole.

## Current Implementation Status

### Completed Stories
- **Story 2.4:** Word Count Display (3 points) - Merged to main
- **Story 3.1:** Wiki Page CRUD (4 points) - Partial (Tasks 1-6/11 complete)
- **Story 3.2:** Wiki Link Syntax (4 points) - Partial (Tasks 1-2/11 complete)

### Test Coverage Summary
- **Total Test Files:** 14
- **Total Tests:** 230 (224 passing, 6 failing)
- **Unit Tests:** 230
- **Integration Tests:** 0 (to be added)
- **E2E Tests:** 0 (to be added)
- **Manual Tests:** 0 (to be documented)

---

## Test Strategy

### 1. Unit Tests
**Purpose:** Test individual functions, components, and hooks in isolation  
**Tool:** Vitest + React Testing Library  
**Coverage Target:** 80% code coverage

**Current Status:**
- ✅ Helper functions (stats, git-history, wiki CRUD)
- ✅ React hooks (useWordCount, useWikiPages, useAutosave)
- ✅ React components (WikiPageList, WikiPageEditor, CodeMirrorEditor, etc.)
- ✅ CodeMirror extensions (wiki-links)
- ✅ Utilities (wiki-link-parser)
- ⚠️ 6 tests failing in useWordCount (timing issues)

### 2. Integration Tests
**Purpose:** Test multiple components/systems working together  
**Tool:** Vitest + Testing Library
**Coverage Target:** Key user flows

**Planned Coverage:**
- [ ] Wiki CRUD flow (create → list → edit → save → delete)
- [ ] Word count updates across components
- [ ] Wiki link parsing → click → open page
- [ ] Autosave → IPC → file system
- [ ] Chapter switching with unsaved changes

### 3. End-to-End Tests
**Purpose:** Test full application flows in a real Electron environment  
**Tool:** Playwright for Electron  
**Coverage Target:** Critical user journeys

**Planned Coverage:**
- [ ] Create novel → write content → save → verify on disk
- [ ] Create wiki page → link in manuscript → click link → edit wiki
- [ ] Word count accuracy (manuscript/chapter/today)
- [ ] Sidebar navigation (wiki list, chapter list)
- [ ] Electron IPC communication

### 4. Manual Tests
**Purpose:** Test features that are difficult to automate  
**Tool:** Manual QA checklist  
**Frequency:** Pre-release

**Planned Coverage:**
- [ ] UI/UX verification (layout, colors, fonts)
- [ ] Keyboard shortcuts
- [ ] Performance (large manuscripts, many wiki pages)
- [ ] Error handling and recovery
- [ ] Cross-platform compatibility (macOS, Windows, Linux)

---

## Story-Level Test Verification

### Story 2.4: Word Count Display

**Acceptance Criteria Coverage:**

| Criterion | Test Type | Status | Location |
|-----------|-----------|--------|----------|
| Word count widget with toggle | Unit | ✅ | (Future component test) |
| "Manuscript" shows total words | Unit | ✅ | helper/tests/stats.test.js |
| "Chapter" shows current words | Unit | ✅ | helper/tests/stats.test.js |
| "Today" shows words since midnight | Unit | ✅ | helper/tests/git-history.test.js |
| Updates after save (<500ms) | Integration | ⏳ | TBD |
| Accurate (exclude wiki, config) | Unit | ✅ | helper/tests/stats.test.js |

**Test Gaps:**
- ❌ No component test for WordCountWidget
- ❌ No integration test for update after save
- ❌ No E2E test for full word count flow

### Story 3.1: Wiki Page CRUD (Partial Implementation)

**Acceptance Criteria Coverage:**

| Criterion | Test Type | Status | Location |
|-----------|-----------|--------|----------|
| "+" button opens dialog | E2E | ⏳ | TBD |
| User enters title → slug created | Unit | ✅ | helper/tests/wiki.test.js |
| Stored as wiki/<slug>.md | Unit | ✅ | helper/tests/wiki.test.js |
| Wiki page opens in editor | Integration | ⏳ | TBD |
| Listed in sidebar with search | Unit | ✅ | tests/unit/components/WikiPageList.test.jsx |
| Click opens in editor | Integration | ⏳ | TBD |
| Autosave like chapters | Integration | ⏳ | TBD |
| Can be renamed | Unit | ✅ | helper/tests/wiki.test.js (delete test) |

**Test Gaps:**
- ❌ No E2E test for create dialog
- ❌ No integration test for editor open flow
- ❌ No integration test for autosave
- ❌ WikiPageEditor component exists but not fully integrated

### Story 3.2: Wiki Link Syntax (Partial Implementation)

**Acceptance Criteria Coverage:**

| Criterion | Test Type | Status | Location |
|-----------|-----------|--------|----------|
| CodeMirror detects [[...]] | Unit | ✅ | tests/unit/lib/wiki-link-parser.test.js |
| Links highlighted | Unit | ✅ | tests/unit/lib/codemirror-extensions/wiki-links.test.js |
| Click opens wiki page | Integration | ⏳ | TBD |
| Non-existent page offers "Create?" | E2E | ⏳ | TBD |
| Preview on hover (100 chars) | Unit | ✅ | (Task 3 created but not merged) |
| Ambiguous slug handling | Integration | ⏳ | TBD |

**Test Gaps:**
- ❌ No integration test for click → open flow
- ❌ No E2E test for create dialog
- ❌ No integration test for preview tooltip
- ❌ WikiLinkPreview component created but awaiting Story 3.1

---

## Test Execution Plan

### Phase 1: Fix Failing Unit Tests (CURRENT)
**Priority:** P0 (Blocker)  
**Timeline:** Immediate

- [ ] Fix useWordCount timing issues (6 failing tests)
- [ ] Ensure all 230 tests pass
- [ ] Add missing unit tests for gaps identified above

### Phase 2: Integration Tests
**Priority:** P1 (High)  
**Timeline:** 1-2 days

- [ ] Set up integration test infrastructure
- [ ] Implement wiki CRUD integration tests
- [ ] Implement word count update integration tests
- [ ] Implement wiki link click integration tests

### Phase 3: E2E Tests
**Priority:** P1 (High)  
**Timeline:** 2-3 days

- [ ] Install and configure Playwright for Electron
- [ ] Create E2E test fixtures (test novels, wiki pages)
- [ ] Implement critical user journey tests
- [ ] Set up CI/CD pipeline for E2E tests

### Phase 4: Manual Test Documentation
**Priority:** P2 (Medium)  
**Timeline:** 1 day

- [ ] Create manual test checklist
- [ ] Document exploratory testing scenarios
- [ ] Create performance test procedures
- [ ] Document cross-platform test matrix

---

## Test Infrastructure Requirements

### Dependencies to Add
```json
{
  "@playwright/test": "^1.40.0",
  "playwright": "^1.40.0",
  "@vitest/coverage-v8": "^1.0.0"
}
```

### Directory Structure
```
tests/
├── unit/              (existing)
├── integration/       (new)
│   ├── wiki-crud.test.js
│   ├── word-count-flow.test.js
│   └── wiki-links-flow.test.js
├── e2e/               (new)
│   ├── fixtures/
│   ├── novel-creation.spec.js
│   ├── wiki-workflow.spec.js
│   └── word-count.spec.js
└── manual/            (new)
    ├── UI-CHECKLIST.md
    ├── PERFORMANCE.md
    └── CROSS-PLATFORM.md
```

---

## Risk Assessment

### High Risk Areas
1. **IPC Communication** - Complex Electron main/renderer communication
2. **File System Operations** - Wiki CRUD, autosave reliability
3. **Git Integration** - Today's word count depends on git history
4. **Performance** - Large manuscripts (>100 chapters) not yet tested
5. **State Management** - Multiple components sharing wiki/chapter state

### Mitigation Strategies
- Add integration tests for IPC flows
- Add E2E tests for file operations with verification
- Mock git commands in unit tests, verify with E2E
- Add performance benchmarks and stress tests
- Add integration tests for state consistency

---

## Success Criteria

### Definition of Done (QA Perspective)
- [ ] All unit tests passing (100%)
- [ ] Integration tests cover critical flows (>80%)
- [ ] E2E tests cover happy paths for completed stories
- [ ] Manual test checklist created and executed
- [ ] Test coverage >80% for new code
- [ ] No critical bugs in implemented features
- [ ] Performance meets PRD requirements (<100ms operations)

### Quality Gates
- **Merge to Main:** All unit tests passing, no regressions
- **Release Candidate:** Integration + E2E tests passing, manual checklist complete
- **Production Release:** Performance validated, cross-platform tested

---

## Next Steps

1. **Immediate:** Fix useWordCount timing issues
2. **Today:** Create integration test infrastructure
3. **This Week:** Implement integration tests for Stories 2.4, 3.1, 3.2
4. **Next Week:** Set up E2E testing with Playwright
5. **Ongoing:** Update test plan as new stories are implemented
