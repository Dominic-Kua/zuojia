# Story 4.1: Snapshot (Local Backup) — UI Layer

**Epic:** 4 — Git Workflow & Sync  
**Status:** ready-for-review  
**Points:** 2  

---

## Story

As an author, I want to create a snapshot of my manuscript state, so I have a local backup before risky operations.

---

## Acceptance Criteria

- [x] AC1: "Snapshot" button visible in manuscript toolbar
- [x] AC2: Clicking button opens a dialog prompting for an optional label
- [x] AC3: User can submit with or without a label; whitespace-only labels are treated as unlabeled snapshots
- [x] AC4: On confirm, app calls `helper:backup:createSnapshot` via IPC and a toast confirms "Snapshot created: <label>" (or "Snapshot created" if no label)
- [x] AC5: Dialog closes after successful snapshot creation
- [x] AC6: Snapshots are listed in a Diagnostics panel accessible from the toolbar
- [x] AC7: Each snapshot entry shows timestamp, label, and size
- [x] AC8: User can restore a snapshot from the Diagnostics panel
- [x] AC9: User can delete a snapshot from the Diagnostics panel
- [x] AC10: IPC errors surface as error toasts (never silent failures)

---

## Tasks / Subtasks

### Task 1: Add `deleteSnapshot` to IPC client
- [x] 1.1 Add `deleteSnapshot(novelPath, timestamp)` to `backupHandlers` in `src/lib/ipc-client.ts`

### Task 2: Write unit tests (TDD — tests first, failing)
- [x] 2.1 `tests/unit/hooks/useSnapshot.test.js` — hook unit tests
- [x] 2.2 `tests/unit/components/SnapshotButton.test.jsx` — button/dialog unit tests
- [x] 2.3 `tests/unit/components/SnapshotManager.test.jsx` — diagnostics list unit tests

### Task 3: Write E2E tests for UI flows (failing)
- [x] 3.1 Add UI-based describe block to `tests/e2e/snapshot.spec.js`

### Task 4: Implement `useSnapshot` hook
- [x] 4.1 `src/hooks/useSnapshot.js`

### Task 5: Implement UI components
- [x] 5.1 `src/components/EditorToolbar/SnapshotButton.jsx`
- [x] 5.2 `src/components/EditorToolbar/SnapshotDialog.jsx`
- [x] 5.3 `src/components/EditorToolbar/SnapshotManager.jsx` (diagnostics list)
- [x] 5.4 `src/components/Toast.jsx` (app-level toast notification)

### Task 6: Wire components into the app
- [x] 6.1 Update `src/components/Manuscript.jsx` to render SnapshotButton in toolbar
- [x] 6.2 Update `src/App.jsx` to include Toast

### Task 7: Verify all tests pass
- [x] 7.1 `npx vitest run` — all unit tests pass
- [x] 7.2 `npx playwright test tests/e2e/snapshot.spec.js` — all E2E tests pass

---

## Dev Notes

### Architecture
- Backend: `helper/src/backup/snapshot.js` — fully implemented (`createSnapshot`, `listSnapshots`, `deleteSnapshot`, `restoreSnapshot`)
- IPC handlers: registered in `electron/ipc-handlers.js` (`helper:backup:createSnapshot`, `helper:backup:listSnapshots`, `helper:backup:deleteSnapshot`, `helper:backup:restore`)
- IPC client: `backupHandlers` in `src/lib/ipc-client.ts` — missing `deleteSnapshot`

### Component tree
```
App.jsx (owns toast state, passes onToast callback)
  └── Manuscript.jsx (receives novelPath, onToast)
        └── manuscript-meta div
              ├── ChapterList (existing)
              └── SnapshotButton (new, opens SnapshotDialog or SnapshotManager)
```

### UI patterns
- Toast: simple `{ message, type, visible }` state in App.jsx; auto-dismisses after 3s
- Dialog: modal overlay with label input; "Take Snapshot" + "Cancel" buttons
- SnapshotManager: modal list showing timestamp, label, size; Restore + Delete per row

### Testing patterns
- Unit tests mock `backupHandlers` from `src/lib/ipc-client.ts`
- E2E presses the actual UI button and asserts DOM/toast visibility

---

## Dev Agent Record

### Debug Log
- Created branch `feature/story-4.1-snapshot-ui` from `main`.
- Added TDD tests first for hook and components:
      - `tests/unit/hooks/useSnapshot.test.js`
      - `tests/unit/components/SnapshotButton.test.jsx`
      - `tests/unit/components/SnapshotManager.test.jsx`
- Confirmed red phase (`3 failed`) before implementation because new components/hooks did not exist.
- Implemented:
      - `src/hooks/useSnapshot.js`
      - `src/components/EditorToolbar/SnapshotButton.jsx`
      - `src/components/EditorToolbar/SnapshotDialog.jsx`
      - `src/components/EditorToolbar/SnapshotManager.jsx`
      - `src/components/Toast.jsx`
- Wired snapshot UI into:
      - `src/components/Manuscript.jsx`
      - `src/App.jsx`
      - `src/lib/ipc-client.ts` (`backupHandlers.deleteSnapshot`)
- Added Story 4.1 UI E2E coverage in `tests/e2e/snapshot.spec.js`.
- Self-review follow-up fixes:
      - Extracted dialog to `SnapshotDialog` component.
      - Added delete-success/delete-error toast handling in `SnapshotManager`.
      - Prevented simultaneous snapshot dialog and manager modal in `SnapshotButton`.
      - Replaced non-ASCII characters in new files.

### Completion Notes
- Snapshot UI feature complete for Story 4.1 with toolbar integration, optional label dialog, snapshot manager list, restore and delete actions, and toast notifications.
- Test results:
      - `npx vitest run tests/unit/hooks/useSnapshot.test.js tests/unit/components/SnapshotButton.test.jsx tests/unit/components/SnapshotManager.test.jsx`: 28 passed
      - `npx vitest run`: 210 passed, 1 skipped
      - `npx playwright test tests/e2e/snapshot.spec.js`: 17 passed
      - Full E2E regression run across listed specs: 42 passed
- Residual note: Vitest emits React `act(...)` warnings in `SnapshotButton` tests, but tests are passing and behavior is verified.

---

## File List

_(updated as files are created/modified)_

- `src/lib/ipc-client.ts`
- `src/hooks/useSnapshot.js`
- `src/components/EditorToolbar/SnapshotButton.jsx`
- `src/components/EditorToolbar/SnapshotDialog.jsx`
- `src/components/EditorToolbar/SnapshotManager.jsx`
- `src/components/Toast.jsx`
- `src/components/Manuscript.jsx`
- `src/App.jsx`
- `tests/unit/hooks/useSnapshot.test.js`
- `tests/unit/components/SnapshotButton.test.jsx`
- `tests/unit/components/SnapshotManager.test.jsx`
- `tests/e2e/snapshot.spec.js`
