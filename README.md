# 作家 (Zuojia)

A local-first desktop writing app for novelists who want Markdown files, wiki-style worldbuilding, and Git-backed safety.

## Table of Contents

- [What This App Does](#what-this-app-does)
- [Implemented Features](#implemented-features)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [How To Use The App](#how-to-use-the-app)
- [Developer Commands](#developer-commands)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Current Scope Notes](#current-scope-notes)

## What This App Does

作家 helps you manage a novel as plain files on your machine.

Each novel lives under `~/.zuojia/<novel-slug>/` and uses this structure:

- `manuscript/`: chapter Markdown files
- `wiki/`: wiki page Markdown files for characters, locations, lore
- `meta/`: index, backups, spellcheck dictionary, and metadata

The app focuses on a writing workflow where you can:

- Create or open a novel quickly
- Edit chapters with autosave behavior
- Create and maintain wiki pages
- Follow wiki links directly from the manuscript
- Track word counts (chapter, manuscript, today)
- Back up/push work through Git

## Implemented Features

This list reflects what is currently wired in the app code.

### Novel Management

- Create new novel projects from the app
- Open existing novel directories
- Validate novel folder structure
- Show recent novels from `~/.zuojia`

### Manuscript Editor

- Chapter selection from a searchable chapter dropdown
- Create chapter from the editor panel
- Load and save chapter files through IPC handlers
- Inline wiki-link highlighting for `[[Page]]` and `[[Page|Label]]`
- Wiki link click handling with:
  - open existing page
  - disambiguation UI when multiple pages match
  - create-page prompt when page does not exist
- Spellcheck integration with custom dictionary support

### Wiki Sidebar

- Wiki page CRUD (create, read, update, delete)
- Rename wiki pages
- Autosave wiki edits
- Wiki tags (frontmatter-based)
- Markdown preview mode
- Wiki links rendered in preview mode
- Image embed parsing for wiki content

### Statistics

- Chapter word count
- Manuscript word count
- "Words written today" count (from git history helper)

### Git and Backup Helpers

- Helper endpoint for chapter Git commits (`helper:git:commit`)
- Validated remote push flow from the UI `Push` button
- Git remote configuration from the UI `Settings` button
- Local snapshot helper APIs (create, list, restore)

## Requirements

- macOS
- Node.js and npm
- Git available in your shell
- Electron runtime dependencies installed via npm

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start development mode:

```bash
npm run dev
```

This starts Vite and Electron together using `scripts/dev.sh`.

3. In the app:

- Click `+ New Novel` to create a project, or
- Click `Open Novel` to load an existing novel folder

## How To Use The App

### 1. Create or Open a Novel

- Use the startup screen to create or open a novel
- New novels are created in `~/.zuojia`

### 2. Write in Chapters

- Select chapters from the chapter dropdown
- Edit content in the manuscript editor
- Chapter content is autosaved to disk through helper handlers

### 3. Build World Notes in Wiki

- Create wiki pages in the sidebar
- Add tags to wiki pages
- Switch between edit and preview modes

### 4. Use Wiki Links in Manuscript

Write links like:

```markdown
[[alice-the-protagonist]]
[[alice-the-protagonist|Alice]]
```

Clicking links opens or creates relevant wiki pages.

### 5. Watch Word Counts

The editor tracks:

- current chapter words
- full manuscript words
- words added today

### 6. Backup / Push

Use the top-bar `Settings` button to configure your remote URL, branch, and SSH key path.
Use `Push` to send committed work to that configured remote.

## Developer Commands

```bash
npm run dev           # Start Vite + Electron (recommended)
npm run dev:node      # Start dev via Node launcher
npm run dev:vite      # Start only Vite
npm start             # Start Electron app
npm run build         # Build renderer with Vite
npm run test          # Run unit tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run test:integration
npm run test:e2e
npm run test:all
```

## Testing

- Unit and integration tests run with Vitest
- E2E tests run with Playwright + Electron
- See `tests/e2e/README.md` for E2E details

## Project Structure

```text
src/                 React renderer code
electron/            Electron main/preload + IPC handlers
helper/              Helper modules for index/git/wiki/stats/backup logic
tests/               Unit, integration, and e2e tests
scripts/             Development launch scripts
_bmad-output/        Planning and implementation artifacts
```

## Current Scope Notes

Some helper endpoints and roadmap items exist in planning docs but are not fully surfaced in the UI yet (for example pull/merge UX and export pipeline wiring). The README above describes the functionality currently implemented in code and available in the running app.
