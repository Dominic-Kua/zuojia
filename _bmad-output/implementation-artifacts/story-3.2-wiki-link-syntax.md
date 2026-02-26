# Story 3.2: Wiki Link Syntax & Resolution

**Story ID:** 3.2  
**Story Points:** 4  
**Branch:** `story/3.2-wiki-link-syntax`

## Story Description

As an author, I want to reference wiki pages inline in my manuscript using a link syntax, so I can instantly jump to related details.

**Accepted Link Syntax:** `[[page-name]]` or `[[page-name|display text]]`

## Acceptance Criteria

- [ ] CodeMirror extension detects `[[...]]` syntax
- [ ] Links highlighted distinctly (color, underline)
- [ ] On click (or Cmd+Click), resolve slug and open wiki page in sidebar
- [ ] If page doesn't exist, offer "Create?" dialog
- [ ] Link preview on hover (first 100 chars of page)
- [ ] Ambiguous slugs handled gracefully (show disambiguation if multiple matches)

## Implementation Plan

### Task 1: Wiki Link Parser
**Files to create:**
- `src/lib/wiki-link-parser.js`

**Subtasks:**
1. Create parser function to extract wiki links from text
   - Match pattern: `[[page-name]]` or `[[page-name|display text]]`
   - Return array of: `{start, end, pageName, displayText, fullMatch}`
2. Create slug resolution function
   - Convert page name to slug (normalize, lowercase, hyphenate)
   - Handle ambiguous cases
3. Add validation for link syntax

**Tests:**
- `tests/unit/lib/wiki-link-parser.test.js`
- Test single bracket detection
- Test double bracket detection with various content
- Test display text extraction
- Test edge cases (nested brackets, escape sequences)
- Test slug generation from page names
- Estimated: 15 tests

---

### Task 2: CodeMirror Wiki Link Extension
**Files to create:**
- `src/lib/codemirror-extensions/wiki-links.js`

**Subtasks:**
1. Create StateField to track wiki link ranges
2. Create Decoration for link highlighting
   - Distinct color/underline for wiki links
   - Different style for broken links (page doesn't exist)
3. Create ViewPlugin for hover interactions
   - Detect hover over link
   - Trigger preview callback
4. Create click handler
   - Detect click on link (with Cmd key check)
   - Extract link target
   - Call navigation callback

**Tests:**
- `tests/unit/lib/codemirror-extensions/wiki-links.test.js`
- Test link detection in document
- Test decoration application
- Test click handler invocation
- Test hover handler invocation
- Estimated: 12 tests

---

### Task 3: Wiki Link Preview Component
**Files to create:**
- `src/components/WikiLinkPreview/index.jsx`
- `src/components/WikiLinkPreview/WikiLinkPreview.css`

**Subtasks:**
1. Create tooltip-style preview component
   - Position near cursor/link
   - Show first 100 chars of wiki page content
   - Show "Page not found" for non-existent pages
2. Add loading state
3. Add error handling
4. Style with dark theme support

**Tests:**
- `tests/unit/components/WikiLinkPreview.test.jsx`
- Test preview rendering with content
- Test preview positioning
- Test "not found" state
- Test loading state
- Estimated: 8 tests

---

### Task 4: Create Wiki Page Dialog
**Files to create:**
- `src/components/CreateWikiDialog/index.jsx`
- `src/components/CreateWikiDialog/CreateWikiDialog.css`

**Subtasks:**
1. Create dialog component
   - Input field for page title (pre-filled from link)
   - Create button
   - Cancel button
2. On create, call wikiHandlers.create
3. On success, navigate to new page
4. Handle errors (duplicate page name)
5. Style with modal overlay

**Tests:**
- `tests/unit/components/CreateWikiDialog.test.jsx`
- Test dialog rendering
- Test pre-filled title
- Test create action
- Test cancel action
- Test error handling
- Estimated: 8 tests

---

### Task 5: Wiki Link Disambiguation Dialog
**Files to create:**
- `src/components/WikiDisambiguationDialog/index.jsx`
- `src/components/WikiDisambiguationDialog/WikiDisambiguationDialog.css`

**Subtasks:**
1. Create dialog showing multiple page matches
   - List page titles with partial content preview
   - Radio buttons or click-to-select
   - Select button
   - Cancel button
2. Return selected page slug
3. Style with modal overlay

**Tests:**
- `tests/unit/components/WikiDisambiguationDialog.test.jsx`
- Test dialog with multiple options
- Test selection
- Test cancel
- Estimated: 6 tests

---

### Task 6: useWikiLinks Hook
**Files to create:**
- `src/hooks/useWikiLinks.js`

**Subtasks:**
1. Hook to manage wiki link interactions
   - resolveLink(pageName) - resolve page name to slug
   - getPagePreview(slug) - fetch first 100 chars
   - openPage(slug) - trigger sidebar navigation
   - createPage(title) - create new wiki page
2. Handle disambiguation
3. Track hover state for preview
4. Manage dialog state (create, disambiguation)

**Tests:**
- `tests/unit/hooks/useWikiLinks.test.js`
- Test link resolution
- Test preview fetching
- Test page creation
- Test disambiguation handling
- Estimated: 12 tests

---

### Task 7: Integrate Wiki Links into ChapterEditor
**Files to modify:**
- `src/components/ChapterEditor/index.jsx` (or editor component)

**Subtasks:**
1. Add wiki link extension to CodeMirror extensions array
2. Pass callbacks for:
   - onLinkClick(pageName)
   - onLinkHover(pageName, position)
3. Wire up useWikiLinks hook
4. Render WikiLinkPreview when hovering
5. Render CreateWikiDialog when needed
6. Render WikiDisambiguationDialog when needed

**Tests:**
- Integration test in existing editor tests
- Test link interaction flow
- Estimated: 5 tests

---

### Task 8: Update WikiSidebar for Navigation
**Files to modify:**
- `src/components/WikiSidebar/index.jsx`

**Subtasks:**
1. Add method to open wiki page by slug
2. Expose this method via ref or callback
3. Integrate with useWikiLinks navigation

**Tests:**
- Update existing WikiSidebar tests
- Test navigation from link click
- Estimated: 3 tests

---

### Task 9: Link Validation & Broken Link Detection
**Files to modify:**
- `src/lib/codemirror-extensions/wiki-links.js`
- `src/hooks/useWikiLinks.js`

**Subtasks:**
1. Cross-reference link targets with wiki pages list
2. Apply different decoration for broken links
3. Update link styling for broken vs valid links

**Tests:**
- Test broken link detection
- Test valid link styling
- Estimated: 4 tests

---

### Task 10: Integration Testing
**Files to create:**
- `tests/integration/wiki-links.test.jsx`

**Subtasks:**
1. Test end-to-end link creation and navigation
2. Test hover preview flow
3. Test create page from broken link
4. Test disambiguation flow
5. Test keyboard shortcuts (Cmd+Click)

**Estimate:** 8 tests

---

### Task 11: Manual Testing
**Manual test checklist:**
- [ ] Type `[[Alice]]` in chapter, link highlights
- [ ] Hover over link, preview appears
- [ ] Click link (or Cmd+Click), sidebar opens Alice page
- [ ] Click broken link `[[NonExistent]]`, create dialog appears
- [ ] Create page from dialog, sidebar opens new page
- [ ] Type `[[test]]` when multiple pages match "test", disambiguation dialog appears
- [ ] Select correct page from disambiguation
- [ ] Links update color when page is created/deleted
- [ ] Display text works: `[[alice|the protagonist]]` shows "the protagonist" but links to alice
- [ ] Links work in all chapters

---

## Files to Create

### New Files (9)
1. `src/lib/wiki-link-parser.js` - Link parsing utilities
2. `src/lib/codemirror-extensions/wiki-links.js` - CodeMirror extension
3. `src/components/WikiLinkPreview/index.jsx` - Preview tooltip
4. `src/components/WikiLinkPreview/WikiLinkPreview.css` - Preview styles
5. `src/components/CreateWikiDialog/index.jsx` - Create page dialog
6. `src/components/CreateWikiDialog/CreateWikiDialog.css` - Dialog styles
7. `src/components/WikiDisambiguationDialog/index.jsx` - Disambiguation UI
8. `src/components/WikiDisambiguationDialog/WikiDisambiguationDialog.css` - Dialog styles
9. `src/hooks/useWikiLinks.js` - Link interaction hook

### Files to Modify (2)
1. `src/components/ChapterEditor/index.jsx` - Add wiki link extension
2. `src/components/WikiSidebar/index.jsx` - Add navigation method

### Test Files (9)
1. `tests/unit/lib/wiki-link-parser.test.js` (15 tests)
2. `tests/unit/lib/codemirror-extensions/wiki-links.test.js` (12 tests)
3. `tests/unit/components/WikiLinkPreview.test.jsx` (8 tests)
4. `tests/unit/components/CreateWikiDialog.test.jsx` (8 tests)
5. `tests/unit/components/WikiDisambiguationDialog.test.jsx` (6 tests)
6. `tests/unit/hooks/useWikiLinks.test.js` (12 tests)
7. Editor integration tests (5 tests)
8. WikiSidebar navigation tests (3 tests)
9. `tests/integration/wiki-links.test.jsx` (8 tests)

**Total Estimated Tests:** ~81 tests

---

## Technical Notes

### CodeMirror Extension Architecture
- Use StateField to track link positions
- Use Decoration to style links
- Use ViewPlugin for interactive behavior (hover, click)
- Use EditorView.domEventHandlers for click events

### Link Resolution Algorithm
1. Extract page name from `[[page-name]]` or `[[page-name|display]]`
2. Normalize to slug: lowercase, replace spaces with hyphens
3. Query wiki pages list for exact match
4. If no match, search for partial matches
5. If multiple matches, show disambiguation
6. If no matches, mark as broken link

### Hover Preview Debouncing
- Debounce hover events (150ms)
- Cancel preview fetch if user moves away
- Position tooltip near cursor, avoid viewport edges

### Broken Link Styling
- Valid links: Blue + underline
- Broken links: Red + dashed underline
- Hover: Lighten background

### Performance Considerations
- Parse wiki links once per document change
- Cache link positions in StateField
- Debounce preview fetches
- Limit preview content to 100 chars

---

## Code Review Checklist

- [ ] All tests passing (81 expected)
- [ ] No console.log statements
- [ ] Error handling complete
- [ ] CodeMirror extension doesn't cause performance issues
- [ ] Hover preview debounced properly
- [ ] Link resolution handles edge cases (empty, special chars)
- [ ] No XSS vulnerabilities in preview rendering
- [ ] CSS follows dark theme patterns
- [ ] Keyboard accessibility (Tab, Enter, Esc)
- [ ] Link syntax documented in code comments

---

## Implementation Log

### Completed Tasks
- [ ] Task 1: Wiki Link Parser
- [ ] Task 2: CodeMirror Wiki Link Extension
- [ ] Task 3: Wiki Link Preview Component
- [ ] Task 4: Create Wiki Page Dialog
- [ ] Task 5: Wiki Link Disambiguation Dialog
- [ ] Task 6: useWikiLinks Hook
- [ ] Task 7: Integrate into ChapterEditor
- [ ] Task 8: Update WikiSidebar
- [ ] Task 9: Link Validation
- [ ] Task 10: Integration Testing
- [ ] Task 11: Manual Testing

### Test Results
- Parser tests: 0/15
- Extension tests: 0/12
- Preview tests: 0/8
- Create dialog tests: 0/8
- Disambiguation tests: 0/6
- Hook tests: 0/12
- Editor integration: 0/5
- Sidebar navigation: 0/3
- Integration tests: 0/8
- **Total: 0/81**

---

## Notes
- This story depends on Story 3.1 (Wiki CRUD) being complete
- CodeMirror v6 extension API must be used
- Link syntax is non-negotiable: `[[page-name]]` or `[[page-name|display]]`
- Preview must show first 100 chars (excluding markdown formatting)
