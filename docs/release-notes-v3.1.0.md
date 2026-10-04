# Release Notes: v3.1.0 (unreleased)

## Summary

Version 3.1.0 builds on the v3.0.0 foundation with a flexible tiling workspace, hardened git push/commit behavior, and review-driven cleanup across the codebase. All changes since the v3.0.0 tag are listed below.

## Highlights

### Flexible tiling workspace (PR #112)

- The fixed-width wiki sidebar is replaced by a proportional manuscript/wiki split: drag the divider to give either pane any share of the desk, up to the full window.
- Top-bar presets (`Manuscript`, `Split`, `Wiki`) and a `Reset UI` button that restores the default layout, re-docks the wiki, and resets the floating panel.
- The detached floating wiki panel is draggable and resizable, with persisted position and size.
- Fixed dark-mode text colors on the wiki editor, snapshot, and commit inputs.

### Git push, commit, and SSH (PR #111)

- `Commit` covers all novel files; `Push` ignores generated directories.
- `Push` inherits the existing git remote and upstream branch instead of requiring reconfiguration.
- SSH key auto mode works with ed25519 keys and ssh-agent setups out of the box.

### Sidebar git status (Epic 6, PR #109+)

- Commit history, sync status (branch, ahead/behind, last push), uncommitted-changes indicator, and a `Pull` button for repos with a remote.

### Design and cleanup (PR #107–#110)

- Writing Desk design-token theme across light and dark modes.
- Wiki detach fully hides the sidebar and adds a top-bar re-dock button.
- Remediation of code-review findings (critical through nitpick) and E2E idempotency fixes.
- Global E2E teardown sweeps orphaned test novels; test novel leaks fixed.

### Config extraction (PR #106)

- Hardcoded Neo4j/JDK/LLM settings extracted into shared defaults modules (`neo4j-defaults.js`, `llm-defaults.js`, `constants.js`, `platform-paths.js`).
- SettingsModal defaults aligned with `llama-server`.

## Validation

- Unit + integration: 629 passed, 11 skipped (`npx vitest run tests/unit tests/integration`; live-Synapse tests skip when Neo4j is unavailable).
- E2E: all 13 Playwright spec files pass (`npm run test:e2e`).
- Local mac release: `npm run release:mac:local` (build + DMG + bundle/DMG smoke tests + SHA-256).
