# Manual Testing Checklist for Netwriter

**Version:** 1.0  
**Last Updated:** February 26, 2026  
**Test Cycle:** Pre-Release

## Purpose

This checklist covers manual testing for features that are difficult or impossible to automate, including UI/UX verification, performance testing, and exploratory testing.

---

## Test Environment Setup

### Prerequisites
- [ ] macOS / Windows / Linux (specify OS): ______________
- [ ] Node.js version: ______________
- [ ] Electron version: ______________
- [ ] Test novel prepared with sample data
- [ ] Clean browser cache/application data

### Test Data
- [ ] Sample manuscript with 10+ chapters
- [ ] Sample wiki with 5+ pages
- [ ] Git repository initialized
- [ ] Large manuscript (100+ chapters) for performance testing

---

## Story 2.4: Word Count Display

### UI/UX Verification
- [ ] Word count widget visible in sidebar
- [ ] Toggle buttons: "Manuscript" | "Chapter" | "Today" present
- [ ] Current selection highlighted
- [ ] Numbers properly formatted (e.g., "1,234 words" not "1234")
- [ ] Widget doesn't overlap other sidebar content

### Functional Testing
- [ ] **Test 1:** Switch to "Manuscript" tab
  - [ ] Count displays total words across all chapters
  - [ ] Count matches manual calculation
- [ ] **Test 2:** Switch to "Chapter" tab
  - [ ] Count displays words in current chapter only
  - [ ] Count updates when switching chapters
- [ ] **Test 3:** Switch to "Today" tab
  - [ ] Count shows 0 at start of day (if no edits)
  - [ ] Count increases as you type new content
  - [ ] Count persists after app restart

### Performance
- [ ] Word count updates within 500ms after typing stops
- [ ] No lag when switching between tabs
- [ ] Accurate count for manuscripts with 100+ chapters

### Edge Cases
- [ ] Empty manuscript shows "0 words"
- [ ] Single word shows "1 word" (singular)
- [ ] Very large numbers display correctly (e.g., 100,000+)
- [ ] Count excludes markdown syntax (headings, links, bold)
- [ ] Count excludes wiki pages

### Notes:
```
Tester: _______________
Date: _______________
OS: _______________
Issues Found:



```

---

## Story 3.1: Wiki Page CRUD

### Create Wiki Page
- [ ] **Test 1:** Click "+ New Wiki Page" button
  - [ ] Dialog appears
  - [ ] Dialog is modal (can't interact with background)
  - [ ] Title input field has focus
  - [ ] "Create" button disabled until title entered
  
- [ ] **Test 2:** Enter wiki page title
  - [ ] Normal title: "Alice the Protagonist"
    - [ ] Slug displayed: "alice-the-protagonist"
    - [ ] Page created successfully
  - [ ] Title with special chars: "Dr. Smith's Lab!"
    - [ ] Slug sanitized: "dr-smiths-lab"
  - [ ] Very long title (100+ chars)
    - [ ] Title truncated or scrolls
  
- [ ] **Test 3:** Cancel creation
  - [ ] "Cancel" button closes dialog
  - [ ] No page created on disk

### List Wiki Pages
- [ ] **Test 1:** Wiki sidebar displays all pages
  - [ ] Pages sorted alphabetically
  - [ ] Page titles displayed correctly
  - [ ] Page count shown (e.g., "5 pages")
  
- [ ] **Test 2:** Search wiki pages
  - [ ] Type in search box
  - [ ] Results filter in real-time
  - [ ] Case-insensitive search
  - [ ] Partial match works (e.g., "ali" finds "Alice")
  
- [ ] **Test 3:** Empty states
  - [ ] No pages: Shows "No wiki pages yet"
  - [ ] No search results: Shows "No pages match"

### Edit Wiki Page
- [ ] **Test 1:** Click wiki page to open
  - [ ] Editor pane opens (sidebar or overlay)
  - [ ] Page title displayed in header
  - [ ] Slug displayed
  - [ ] Content loaded correctly
  - [ ] Save status: "All changes saved"
  
- [ ] **Test 2:** Edit content
  - [ ] Type in editor - cursor doesn't jump
  - [ ] Markdown formatting visible
  - [ ] Status changes to "Unsaved changes"
  
- [ ] **Test 3:** Manual save
  - [ ] Click "Save" button
  - [ ] Status changes to "Saving..."
  - [ ] Then "All changes saved"
  - [ ] Changes persist after closing editor
  
- [ ] **Test 4:** Auto-save
  - [ ] Type content and wait 5 minutes
  - [ ] Auto-save triggers
  - [ ] No user interaction needed
  
- [ ] **Test 5:** Close with unsaved changes
  - [ ] Edit content (don't save)
  - [ ] Click "Close" button
  - [ ] Warning dialog appears
  - [ ] "Cancel" keeps editor open
  - [ ] "Close without saving" discards changes

### Delete Wiki Page
- [ ] **Test 1:** Delete page (if implemented)
  - [ ] Confirmation dialog appears
  - [ ] Page removed from list
  - [ ] File deleted from disk

### Performance
- [ ] Wiki list loads instantly (<100ms) for 50 pages
- [ ] Editor opens without delay
- [ ] Save completes within 500ms
- [ ] Search filters in real-time (no lag)

### Edge Cases
- [ ] Create duplicate title (same slug)
  - [ ] Error message displayed
- [ ] Very long wiki content (10,000+ words)
  - [ ] Editor handles without lag
- [ ] Wiki file manually deleted from disk
  - [ ] App handles gracefully (shows error)

### Notes:
```
Tester: _______________
Date: _______________
Issues Found:



```

---

## Story 3.2: Wiki Link Syntax

### Link Detection
- [ ] **Test 1:** Type wiki link syntax in manuscript
  - [ ] `[[alice]]` → Link detected and styled
  - [ ] `[[alice|Alice Smith]]` → Display text shown
  - [ ] `[[non-existent]]` → Different styling (dashed?)
  
- [ ] **Test 2:** Link styling
  - [ ] Links have distinct color (blue?)
  - [ ] Underline on hover
  - [ ] Cursor changes to pointer on hover

### Link Click
- [ ] **Test 1:** Click existing wiki link
  - [ ] Wiki sidebar opens (if not open)
  - [ ] Correct wiki page loads
  - [ ] Editor displays page content
  
- [ ] **Test 2:** Click non-existent link
  - [ ] Dialog appears: "Page doesn't exist. Create?"
  - [ ] Cancel button closes dialog
  - [ ] Create button opens new page dialog with title pre-filled

### Link Preview (Hover)
- [ ] **Test 1:** Hover over wiki link
  - [ ] Tooltip appears after brief delay
  - [ ] Shows first 100 chars of page content
  - [ ] Tooltip positioned correctly (not off-screen)
  - [ ] Tooltip disappears when mouse moves away
  
- [ ] **Test 2:** Non-existent link hover
  - [ ] Tooltip shows "Page not found"

### Ambiguous Links
- [ ] **Test 1:** Multiple pages match slug
  - [ ] Disambiguation dialog appears
  - [ ] Lists all matching pages
  - [ ] Click chooses correct page

### Performance
- [ ] Link detection while typing (no lag)
- [ ] Hover preview appears instantly
- [ ] Click opens page within 200ms

### Edge Cases
- [ ] Nested links: `[[outer [[inner]]]]`
  - [ ] Handled gracefully (inner ignored?)
- [ ] Link in code block
  - [ ] Not parsed as link
- [ ] Very long link text
  - [ ] Truncated in tooltip

### Notes:
```
Tester: _______________
Date: _______________
Issues Found:



```

---

## General UI/UX Testing

### Layout & Design
- [ ] Sidebar width adjustable
- [ ] Font sizes readable (14-16pt)
- [ ] Colors have sufficient contrast
- [ ] Dark mode supported (if implemented)
- [ ] Icons are clear and intuitive
- [ ] Tooltips provide helpful context

### Keyboard Shortcuts
- [ ] `Cmd+S` / `Ctrl+S` - Save current document
- [ ] `Cmd+N` / `Ctrl+N` - New wiki page
- [ ] `Cmd+F` / `Ctrl+F` - Search wiki
- [ ] `Cmd+Q` / `Ctrl+Q` - Close editor
- [ ] `Cmd+Click` - Open wiki link in new pane

### Responsiveness
- [ ] Window resize handles gracefully
- [ ] Minimum window size enforced
- [ ] Sidebar collapses on small screens
- [ ] No horizontal scrolling needed

### Error Handling
- [ ] Network errors show helpful messages
- [ ] File system errors don't crash app
- [ ] IPC errors logged but don't freeze UI
- [ ] User can recover from errors

### Accessibility
- [ ] Tab navigation works throughout app
- [ ] Focus indicators visible
- [ ] Screen reader compatibility (if required)
- [ ] Colorblind-friendly color scheme

---

## Performance Testing

### Manuscript Loading
- [ ] Open manuscript with 100 chapters
  - Time to load sidebar: _______ ms (target: <500ms)
- [ ] Open manuscript with 500 chapters
  - Time to load sidebar: _______ ms (target: <2s)

### Word Count Calculation
- [ ] Calculate count for 100-chapter manuscript
  - Time: _______ ms (target: <1s)
- [ ] Calculate count for 500-chapter manuscript
  - Time: _______ ms (target: <5s)

### Wiki Operations
- [ ] List 100 wiki pages
  - Time: _______ ms (target: <200ms)
- [ ] Search 100 wiki pages
  - Time per keystroke: _______ ms (target: <50ms)

### Editor Performance
- [ ] Type in chapter with 10,000 words
  - Lag?: Yes / No (target: No lag)
- [ ] Open wiki page with 10,000 words
  - Load time: _______ ms (target: <500ms)

### Memory Usage
- [ ] App idle: _______ MB
- [ ] With large manuscript open: _______ MB
- [ ] After 1 hour of editing: _______ MB (check for leaks)

---

## Cross-Platform Testing

### macOS
- [ ] App launches successfully
- [ ] All features work as expected
- [ ] Keyboard shortcuts use `Cmd` key
- [ ] Native file dialogs work
- [ ] Performance acceptable

### Windows
- [ ] App launches successfully
- [ ] All features work as expected
- [ ] Keyboard shortcuts use `Ctrl` key
- [ ] Native file dialogs work
- [ ] Performance acceptable

### Linux
- [ ] App launches successfully
- [ ] All features work as expected
- [ ] Keyboard shortcuts use `Ctrl` key
- [ ] File dialogs work
- [ ] Performance acceptable

---

## Exploratory Testing

**Instructions:** Spend 30-60 minutes using the app naturally. Try to break things. Document any unexpected behavior.

### Session 1
**Date:** _______________  
**Tester:** _______________  
**Duration:** _______ minutes

**Activities:**
- 
- 

**Issues Found:**
-
-

**Positive Observations:**
-
-

### Session 2
**Date:** _______________  
**Tester:** _______________  
**Duration:** _______ minutes

**Activities:**
-
-

**Issues Found:**
-
-

---

## Test Summary

**Total Tests:** _______  
**Tests Passed:** _______  
**Tests Failed:** _______  
**Critical Issues:** _______  
**Minor Issues:** _______  

**Ready for Release:** Yes / No

**Notes:**
```




```

**Sign-off:**

Tester: _______________  
Date: _______________  
Signature: _______________
