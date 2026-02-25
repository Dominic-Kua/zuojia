Netwriter Component Spec (MVP)
==============================

Core components and behaviors scoped for the macOS MVP.

- App Shell
  - Top bar: app title, global search (optional), account / settings
  - Left: manuscript workspace (3/4 width)
  - Right: sidebar (1/4 width)

- Manuscript Editor
  - Rich text / markdown-friendly editor optimized for long-form
  - Typographic defaults per style-guide
  - Inline spellcheck with contextual menu
  - Chapter switcher dropdown (top-left of manuscript area)
  - Autosave + local snapshots with lightweight timeline

- Sidebar (Wiki / Metadata)
  - Tabs: Overview | Wiki | Notes | Version | Exports
  - Wiki: notebook-style list and quick-insert into manuscript
  - Word-count widget: toggle between Manuscript / Open Chapter / Words Today
  - Commit / Sync controls: Snapshot, Commit, Push, Pull, Last sync status

- Commit & Backup UX
  - Snapshot (local) with name + optional message
  - Commit: staged changes grouped by chapter
  - Push/pull: explicit flows only (no automatic 3-way merges) — conflicts surfaced per-chapter

- Export Panel
  - Preflight checks (images, footnotes, missing metadata)
  - Export formats: PDF (Pandoc+LaTeX), EPUB, Markdown bundle

- Settings Modal
  - Editor preferences (font size, line height)
  - Git settings: SSH key path, remote URL
  - Backups: frequency, retention

- Notifications & Toasts
  - Soft transient toasts for saves, syncs, exports

- Keyboard Shortcuts
  - Cmd-S: Snapshot / Save
  - Cmd-Enter: Commit snapshot dialog
  - Cmd-Alt-F: Find in manuscript
