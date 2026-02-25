---
#
---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
    - step-08-scoping
    - step-09-functional
    - step-10-nonfunctional
inputDocuments: []
workflowType: 'prd'
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 0
project_name: netwriter
author: Dom
date: 2026-02-25T00:00:00Z
classification:
  projectType: "Electron desktop app + local server"
  domain: "novel authoring"
  complexity: "Medium"
  projectContext: "greenfield"
  gitIntegration: "push/pull via local SSH keys (MVP)"
  storageStructure:
    - "manuscript/"
    - "wiki/"
    - "meta/"
  export: "Pandoc + LaTeX for PDF export (MVP)"
  autosavePolicy: "autosave to files; commits are explicit or batched snapshots"
  wikiDictionary: "programmatic; canonical page IDs with rename redirects"
  remoteAuth: "local SSH keys; no token storage"
---

# Product Requirements Document - netwriter

**Author:** Dom
**Date:** 2026-02-25T00:00:00Z

## Executive Summary

Netwriter is a local-first Electron desktop authoring tool (macOS MVP) that combines Scrivener-style project organization with plain-text Markdown and first-class git workflows. It targets single-author novelists (developer-friendly power users) who want fast, distraction-free writing with immediate access to structured world-building. The product solves context-switching and awkward versioning by keeping each novel in a simple directory structure, storing chapters as per-file Markdown, and surfacing related wiki pages inline without leaving the editor. For the MVP we’ll target macOS only and lean on Homebrew to install any required toolchain (Pandoc, LaTeX, Git).

### What Makes This Special

- Instant contextual reference: clicking a character/place name in the manuscript opens its wiki page in a right-hand sidebar via a manuscript context menu — the exact detail you need is available without breaking flow.
- Local-first, git-native workflow: per-novel repo structure (`manuscript/`, `wiki/`, `meta/`) + snapshot/commit UI + push/pull via local SSH keys.
- Minimal friction, maximal control: Markdown + Git simplicity, Pandoc+LaTeX PDF export for publishing-ready output.
- Extensible by design: developer-friendly internals and file layout make it easy for you to extend or patch the tool.

## Project Classification

- Project Type: Electron desktop app + local server  
- Domain: novel authoring / publishing tools  
- Complexity: Medium (local-first + per-chapter files + git integration + PDF export)  
- Project Context: greenfield  
- MVP Git integration: push/pull only via local SSH keys; explicit or batched snapshot commits  
- Storage structure (MVP): manuscript/, wiki/, meta/  
- Export (MVP): Pandoc + LaTeX for PDF  
- Autosave policy (MVP): autosave to working files; commits are explicit/batched  
- Wiki behavior (MVP): programmatic dictionary derived from wiki index; canonical page IDs with rename redirects

## Success Criteria

### User Success
- Open-app continuity: User can open Netwriter and resume their last-edit state for any novel within 5 seconds of launch (session restore).
- Instant reference: Clicking a named wiki item in the manuscript opens that wiki page in the right-hand sidebar within 1 second, preserving cursor position.
- Authoring flow: User can create/edit chapters in per-file Markdown, and navigate between chapters and wiki pages without losing draft content.
- Repo workflows: User can initialize or clone a per-novel git repo, make a local snapshot/commit, and push/pull to a remote via local SSH keys with clear UX and no data loss.
- Export: User can export the Manuscript (all chapters in order) to a single PDF via the Pandoc+LaTeX toolchain with expected chapter order and metadata.
- Spellchecking: Integrated spellchecker active in the editor, respecting the per-novel wiki-derived dictionary (wiki terms not flagged).
- Word count: Configurable word-count display supporting Manuscript total, open chapter, or words added today (calendar day).

### Business Success
- MVP validation: The developer (you) can complete a full novel roundtrip (create or clone novel → write → snapshot → push → export PDF) without manual tooling work beyond Homebrew installs.
- Time-to-value: From install to first successful export: ≤ 1 hour (including installing Homebrew dependencies).
- Developer extensibility: Core code/layout is simple to inspect and extend; adding or fixing a small feature or script requires ≤ 1 hour of developer time for typical changes.

### Technical Success
- Stability: Autosave never causes data loss; at least one automatic recovery backup exists if a push/pull conflict occurs.
- Git correctness: Push/pull operations succeed using the system SSH agent; merge/conflict UI prevents silent overwrite and always preserves a backup snapshot before remote sync.
- Performance: Editor remains responsive for novels with 200+ chapters and a 1M+ character manuscript.
- Export reproducibility: Pandoc+LaTeX export produces a consistent PDF output across repeated runs.
- macOS packaging: App builds and runs on current macOS release; dependencies install cleanly via Homebrew.

### Measurable Outcomes
- Session restore success rate ≥ 98% after repeated restarts.
- Sidebar open latency ≤ 1s 95% of the time.
- Export success rate ≥ 95% for small-medium novels (≤ 300k characters).
- Push/pull cycle success with automatic backup on conflict in ≥ 99% of operations.
- Spellchecker active and respecting wiki-derived dictionary; suggestion latency ≤ 1s.
- Word count updates reflected in the UI within 0.5s for typical chapter sizes; support for Manuscript/Chapter/Today filters with accurate counts.

### Product Scope
- MVP (must-have):
  - Electron macOS app, per-novel directory layout (`manuscript/`, `wiki/`, `meta/`)
  - Editor with clickable wiki links + context menu to create/view wiki pages in sidebar
  - Integrated spellchecker that respects the per-novel wiki-derived dictionary (wiki page names excluded from flags)
  - Configurable Word Count widget: shows Manuscript total, open chapter, or words added today (calendar day)
  - Autosave to files; snapshot/commit UX to create commits; push/pull via local SSH
  - Pandoc+LaTeX export pipeline with Homebrew install instructions
  - Basic visual diff for per-chapter text and safe backup before merge
- Growth (post-MVP):
  - Advanced merge UI (richer visual diffs, inline conflict editor); avoid automatic three-way merges — prefer explicit per-chapter resolution and backups; richer wiki linking (aliases, redirects), optional cloud sync
  - On-device/offline NLP helpers, search across novels, templates marketplace
- Vision:
  - Multi-user collaboration, rich typesetting controls, integrated publishing workflows

## Project-Type: Desktop App (macOS MVP) Requirements

### Project-Type Overview
- Target: macOS-only Electron desktop app + local helper server for file IO and background tasks.
- MVP packaging: deliver editable app files; publish builds/artifacts to an `artifacts/` directory rather than packaging installers.
- Primary constraints: local-first, fully offline with optional Git-based remote sync (SSH).

### Technical Architecture Considerations
- Platform support: macOS only (MVP). Use Electron + a small local helper process (Node or Go) for Git and export orchestration.
- System integration: native file dialogs and macOS native spellcheck API for in-editor checks. No keychain or notifications in MVP.
- Update strategy: updates handled by replacing files in `artifacts/` (manual or scripted). No auto-update mechanism in MVP.
- Offline capabilities: fully functional offline — core features operate locally; remote sync is optional and explicit (push/pull).
- Storage layout: per-novel directory under `~/.netwriter/<novel>/` with `manuscript/`, `wiki/`, `meta/`.
- Performance: lazy-load large chapters; keep single-chapter in-memory editing to scale to 200+ chapters and ~1M characters.

### Required Sections (CSV-driven)
- `platform_support`: macOS (current major release), Electron runtime constraints, helper process requirements.
- `system_integration`: native file dialogs, native spellcheck integration, file permission expectations, sandboxing notes.
- `update_strategy`: artifacts directory process, manual install/update instructions, developer guidance for replacing files.
- `offline_capabilities`: local-first behavior, explicit remote sync flows, pre-sync backup policy.

### Implementation Considerations
- Git integration: use system Git + SSH agent; snapshot/commit UI and explicit push/pull actions trigger pre-sync backups. Avoid storing credentials.
- Export: orchestrate Pandoc + LaTeX via Homebrew; detect missing deps and present install commands.
- Spellchecker/dictionary: integrate macOS spellchecker; maintain wiki-derived dictionary to suppress named-entity flags and update asynchronously on wiki changes.
- Backups & recovery: configurable pre-sync snapshots saved under `meta/backups/`; provide one-click restore.
- Developer ergonomics: keep code/layout readable; per-novel config in `meta/` and provide `meta/hooks` for user scripts.

### Risks & Mitigations
- User accidentally overwrites remote: require explicit confirm for destructive ops and always create pre-sync backup.
- Export toolchain mismatch: surface LaTeX logs and provide reproducible shell command in UI.
- Large files performance: implement lazy file read/write and per-chapter editing to limit memory/CPU.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy
**MVP Approach:** Problem-focused — deliver the smallest, reliable product that makes a single-author novelist say “this is exactly what I needed.” Emphasize editing flow, contextual wiki access, safe git snapshots, and reproducible export.

**Resource posture:** Single-developer-first; design for extensibility and observability so you can iterate quickly.

### MVP Feature Set (Phase 1)
**Project model:** per-novel directory (~/.netwriter/<novel>/) with `manuscript/`, `wiki/`, `meta/`.

**Editor + UX:**
- Markdown editor with per-chapter files and single-chapter in-memory editing.
- Context menu on manuscript words: open/create wiki page in right-hand sidebar.
- Configurable Word Count widget: Manuscript / chapter / today.
- Native macOS spellchecker + wiki-derived dictionary suppression.
- Autosave to working files (no auto-commit).

**Versioning:**
- Snapshot/Commit UX (user-initiated), local commit history.
- Push/Pull via system Git + SSH agent; pre-sync snapshot/backups before destructive ops.
- Basic per-chapter visual diff (text diff) for conflict resolution.

**Export & Tooling:**
- Export Manuscript → single PDF using Pandoc + LaTeX (Homebrew install guidance).
- Artifact-based builds (artifacts/ directory) — no signed installer for MVP.

**Developer UX & Diagnostics:**
- `meta/` config and `meta/hooks` for scripts, `meta/backups/` for snapshots, accessible logs and diagnostics pane.

**Platform constraints:**
- macOS-only; use native file dialogs and native spellcheck API; no keychain/notifications in MVP.

### Phase 2 (Post-MVP)
- Improved merge UI: richer visual diffs, inline conflict editor, but avoid automatic three-way merges.
- Enhanced wiki: aliases/redirects, canonical page IDs, backlink graph.
- Search across novels, templates, and snippet library.
- Optional cloud sync (user opt-in); selective folder sync; conflict resolution UI improvements.
- On-device/offline NLP helpers (summaries, name extraction, writer suggestions).

### Phase 3 (Vision / Expansion)
- Multi-author collaboration with live presence and merge orchestration.
- Advanced typesetting controls, export presets for publishers.
- Marketplace for templates, export styles, and community plugins.

### Risk Mitigation Strategy
- Data loss: always create pre-sync snapshots; keep recovery files; one-click rollback UI.
- Merge confusion: per-chapter diffs and explicit user confirmation for merges; preserve both versions in backups.
- Export failures: capture LaTeX logs, provide CLI reproducible command, and surface actionable errors.
- Performance: lazy-load, limit in-memory buffer to current chapter, background indexing.

### Measurable Deliverables (MVP)
- Restore within ~5s at app open for typical novels.
- Sidebar wiki open ≤1s.
- Export success via Pandoc+LaTeX reproducible on macOS with Homebrew.
- Word count and spellchecker responsive within <1s.

### Rough Resource Estimate
- Team: 1 developer (you) feasible for MVP; contractor or part-time help speeds timeline.
- Timebox: 6–12 weeks of focused work for a stable MVP (editor + wiki sidebar + git snapshot + export), depending on available daily hours and reuse of Electron/Markdown editor components.

## Non-Functional Requirements

### Performance
- NFR1: Application startup and novel session restore complete within 5 seconds for typical novels (<= 100 chapters, <200k characters) on supported macOS hardware.
- NFR2: Right-hand wiki sidebar opens within 1 second after a context action 95% of the time under normal desktop load.
- NFR3: Word count and editor responsiveness (typing latency, simple edits) remain under 100ms for typical chapter sizes (<= 50k characters) through lazy-loading and single-chapter in-memory editing.

### Reliability & Recovery
- NFR4: Autosave occurs every 5 seconds of inactivity or on focus change; autosave must not corrupt user files.
- NFR5: Before any destructive remote operation (push/pull that alters local files), the system creates a pre-sync snapshot saved under `meta/backups/` and retains N most recent snapshots (configurable, default N=10).
- NFR6: Recovery from a pre-sync snapshot (restore) must complete without data loss and within a reasonable interactive timeframe (under 10 seconds for typical novels).

### Security & Privacy
- NFR7: Default storage is local only; the application must not transmit user content unless the user explicitly performs a push to a remote Git repo.
- NFR8: Sensitive operations (push/pull) require explicit user confirmation and use the system SSH agent; the application will not store remote credentials.
- NFR9: Optional local file encryption can be provided as an opt-in feature (documented in `meta/`) for users who want encrypted novel directories.

### Integration & Packaging
- NFR10: The app must detect missing external dependencies (Pandoc, LaTeX) and present clear Homebrew install commands; detection must be accurate on current macOS releases.
- NFR11: Builds for MVP are published to an `artifacts/` directory; installing/updating by replacing artifact files must be supported and documented.

### Maintainability & Observability
- NFR12: The app must write structured logs (rotating) to `meta/logs/` suitable for debugging export or Git issues; logs must be accessible from a Diagnostics view.
- NFR13: The `meta/` directory must include human-editable configuration and a `meta/hooks/` location for user scripts; the format must be simple (YAML or JSON) and documented.
- NFR14: Code and directory layout must be documented such that a developer familiar with Electron and Git can add or fix a small feature within ~1 hour (developer ergonomics target).

### Performance & Resource Constraints
- NFR15: Memory usage for editing should scale linearly with chapter size but keep the app memory footprint under reasonable desktop limits (target < 1GB for typical novels via lazy-load).

### Testability
- NFR16: Each NFR above must be expressible as an acceptance test or automated check (startup timing, sidebar latency, backup existence, export return codes).


## Functional Requirements

### Manuscript Editing
- FR1: [Author] can create a new Novel directory with the required structure (`manuscript/`, `wiki/`, `meta/`).
- FR2: [Author] can create, open, rename, and delete chapter files within `manuscript/`.
- FR3: [Author] can edit a single chapter in a Markdown editor and have changes autosaved to disk.
- FR4: [Author] can navigate between chapters and preserve cursor position and undo history per chapter.

### Wiki & World-Building
- FR5: [Author] can open a wiki page for any named entity from the manuscript via a context menu.
- FR6: [Author] can create a new wiki page from a selected manuscript word via context menu.
- FR7: [Author] can edit and save wiki pages stored under `wiki/` and have them indexed for dictionary and linking.
- FR8: [Author] can rename a wiki page and have the system create a redirect so manuscript links remain valid.

### Inline Context & Discovery
- FR9: [Author] can open the selected wiki page in a right-hand sidebar without losing manuscript context.
- FR10: [Author] can see link previews and backlinks for the currently viewed wiki page in the sidebar.

### Word Count & Spellchecking
- FR11: [Author] can view a configurable Word Count widget showing (Manuscript total | Open chapter | Words added today).
- FR12: [Author] can enable the macOS native spellchecker in the editor and have wiki page names suppressed from flags via a programmatic dictionary.

### Versioning & Git
- FR13: [Author] can initialize or clone a git repository into a novel directory using system Git and SSH.
- FR14: [Author] can create a Snapshot (local commit) with a message via the app UI.
- FR15: [Author] can push and pull to/from a remote repository via system SSH agent using explicit user actions.
- FR16: [Author] can view a basic per-chapter text diff for local changes and for merges detected during pull.
- FR17: [Author] can trigger a pre-sync backup automatically before any push or pull that could be destructive.

### Conflict Handling & Recovery
- FR18: [Author] can view conflicts at chapter granularity, choose which version to keep, or edit to merge manually within the editor.
- FR19: [Author] can restore from a pre-sync backup or recovery file with one click.

### Export & Tooling
- FR20: [Author] can export the entire Manuscript (chapters in order) to a single PDF using the Pandoc+LaTeX pipeline.
- FR21: [Author] can view export logs and a reproducible shell command to re-run export manually if it fails.

### Project Configuration & Developer UX
- FR22: [Author/Developer] can edit project-level settings in `meta/` including export options, backup retention, and hooks.
- FR23: [Developer] can add simple scripts under `meta/hooks/` that the app can call at defined lifecycle points.

### Diagnostics & Backups
- FR24: [Author] can open a Diagnostics view showing recent logs, last backups, and export history.
- FR25: [Author] can configure and view backup snapshots stored under `meta/backups/` and purge old backups.

### Search, Navigation & Performance
- FR26: [Author] can search across the open novel for text and wiki pages and open results from search.
- FR27: [Author] can load and edit novels with 200+ chapters and ~1M+ characters without UI freezes (via lazy loading).

### Integrations & Extensibility
- FR28: [Author/Developer] can run local Homebrew install checks for required dependencies and receive install guidance.
- FR29: [Developer] can inspect the per-novel directory and run or edit `meta/hooks` scripts to extend behavior.

### Administration & Onboarding
- FR30: [Author] can perform initial setup on macOS, including creating or cloning a novel repo and verifying Git+SSH connectivity.

### Traceability Note
- Each FR above maps to PRD sections (Executive Summary, Success Criteria, User Journeys, Domain Requirements, Project-Type, Scoping) and will drive epics and acceptance tests.



## User Journeys

### Primary User — Success Path
- Opening Scene: You open Netwriter, select a novel folder or clone an existing repo, and the editor restores your last cursor/chapter.
- Rising Action: You write in a chapter, highlight a character name, right-click → “Open Wiki Page” and the character’s wiki appears in the right-hand sidebar. You glance, refresh details, and continue without losing flow.
- Climax: You hit “Snapshot/Commit”, give a short note, then push via local SSH to your remote; UI shows a safe backup and success.
- Resolution: You export the full manuscript to PDF via the Pandoc+LaTeX pipeline, and the output matches chapter ordering and metadata.
- Requirements revealed: fast session restore, sidebar open ≤1s, context menu + wiki-sidebar, per-chapter file model, snapshot/commit UI, push/pull via SSH, Pandoc+LaTeX export.

### Primary User — Edge Case (Merge / Conflict Recovery)
- Opening Scene: You have been writing offline; later you pull and a chapter has diverged.
- Rising Action: Pull detects conflicts; Netwriter shows per-chapter visual diff and highlights conflicting paragraphs.
- Climax: You choose the correct version or merge manually in-editor; Netwriter creates a pre-sync backup snapshot and preserves the other version in a recovery file.
- Resolution: Push succeeds; your manuscript integrity is preserved and you continue writing.
- Requirements revealed: per-chapter diffs, conflict UI, automatic pre-sync backup, recovery file system, clear user guidance during merges.

### Admin / Setup (Single-User Developer Install & Repo Flow)
- Opening Scene: On macOS, you install Netwriter and run the initial setup wizard. Homebrew installs Pandoc/LaTeX if missing.
- Rising Action: You configure your local SSH key for pushes/pulls and optionally choose an existing repo to clone into `~/.netwriter/<novel>/`.
- Climax: The app validates Git connectivity and creates an initial snapshot commit; settings (export path, spellchecker options) are saved to `meta/`.
- Resolution: You can inspect the per-novel directory, extend scripts, or add features with minimal friction.
- Requirements revealed: macOS/HB installer guidance, SSH-based Git operations, clear meta/config files under `meta/`, developer-friendly layout.

### Support / Troubleshooting Journey
- Opening Scene: You notice an export failed or spellchecker is flagging many proper names.
- Rising Action: You open “Help & Diagnostics”; Netwriter shows logs, the last backups, and a quick “rebuild dictionary from wiki index” action.
- Climax: You trigger dictionary rebuild or restore from backup; the spellchecker stops false-flagging named entities.
- Resolution: Export completes; logs show successful recovery and you file a small issue or patch.
- Requirements revealed: accessible diagnostics, indexed wiki → dictionary rebuild action, visible backups, easy-to-export logs, straightforward issue/patch path for a developer user.

### Journey Requirements Map (short)
- Editor UX: session restore, fast sidebar, context menu actions, per-chapter navigation
- Versioning: snapshot/commit UI, per-chapter diffs, pre-sync backup, push/pull via SSH
- Wiki: indexed wiki, canonical IDs, dictionary generation, create-from-selection flow
- Export & Tooling: Pandoc+LaTeX pipeline, Homebrew install guidance, reproducible exports
- Diagnostics & Extensibility: logs, backups, meta/ config, editable directory layout

## Domain-Specific Requirements

### Compliance & Regulatory
- Domain complexity: low for regulated compliance (novel content itself does not trigger HIPAA/PCI/GDPR obligations).  
- Recommendation: treat user content as private by default; provide clear export/delete flows and an optional local-encryption setting (opt-in).

### Technical Constraints
- Local-first storage: per-novel directory under `~/.netwriter/<novel>/` with predictable `manuscript/`, `wiki/`, `meta/` layout.  
- Backups & recovery: automatic snapshot backups before any remote sync or destructive operation; retention policy configurable in `meta/`.  
- File permissions & sandboxing: ensure app respects macOS file permissions and entitlements; document access patterns for extensibility.  
- Spellchecker/dictionary: programmatic dictionary derived from wiki index; update on create/rename/delete operations without blocking the editor.  
- Performance: support 200+ chapters and ~1M+ characters; lazy-load large files and use per-chapter editing to limit memory/CPU.  
- Export toolchain: rely on Pandoc+LaTeX via Homebrew; detect and surface helpful error messages when LaTeX fails.

### Integration Requirements
- Git via local SSH: use system SSH agent for push/pull; avoid storing remote tokens.  
- Homebrew tool installation guidance: scripted checks and user prompts for missing dependencies (Pandoc, TeX).  
- Optional external editors/scripts: expose `meta/hooks` or a simple CLI for users to run custom scripts.

### Risk Mitigations
- Data loss: always create a pre-sync snapshot and keep a recovery file; provide one-click rollback.  
- Merge conflicts: per-chapter diffs + safe backup; show clear recovery options and preserve conflicting versions.  
- Export failures: run export in a sandboxed process, capture logs, and provide a reproducible command users can run manually via terminal.


