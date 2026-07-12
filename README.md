# 作家 (Zuojia)

A local-first desktop writing app for novelists who want Markdown files, wiki-style worldbuilding, and Git-backed safety.

## Table of Contents

- [What This App Does](#what-this-app-does)
- [Implemented Features](#implemented-features)
- [Release Notes](#release-notes)
- [AI Foundation (V3 Preview)](#ai-foundation-v3-preview)
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

### Export

- PDF export from the top-bar `Export` button
- Export dialog with title, author, and publication date metadata
- Chapter-order export driven by the manuscript index
- Export logs written under `meta/logs/`

## Release Notes

### v2.0.1

- Fixed packaged-app startup regressions that could lead to a blank or unusable app after installation.
- Restored release branding in packaged builds, including the app name `作家` and app icon.
- Hardened release behavior so release/test flows target production renderer mode while dev flows stay in development mode.
- Added artifact-level release validation: local release now smoke-tests both the packaged `.app` bundle and the mounted `.dmg` artifact before publish.
- Added checksum generation in the local mac release flow for uploaded DMG verification.

For full release details, see `docs/release-notes-v2.0.1.md`.

## AI Foundation (V3 Preview)

An initial local AI foundation is now scaffolded for v3 planning:

- local llama.cpp runtime direction with Qwen2.5 7B Instruct model family
- Neo4j-enhanced Synapse MCP server with wiki tools and Neo4j knowledge graph integration
- Automatic wiki querying when relevant keywords detected in LLM chat
- Per-novel Neo4j database storage at `~/.zuojia/<novel>/neo4j-data/`

### Neo4j Installation

To use the enhanced wiki querying features with Neo4j knowledge graph:

1. **Install Neo4j Desktop** (recommended) or Neo4j Community Edition:
   - Download from https://neo4j.com/download-center/
   - Follow installation instructions for your platform

2. **Start Neo4j Database**:
   - Neo4j Desktop: Create a new database and start it
   - Neo4j Community: Start with `neo4j console` command
   - Default credentials: `neo4j:neo4j` (change in production)

3. **Enable Neo4j in app**:
   - The app will automatically start Neo4j for each novel when opened
   - Wiki data is automatically imported into Neo4j on first use
   - LLM chat automatically queries wiki via MCP when relevant keywords detected

### MCP Server (Synapse)

The read-only MCP Synapse server provides:
- Legacy wiki tools (`wiki_list_pages`, `wiki_get_page`, `wiki_search`, `wiki_get_backlinks`, `wiki_build_graph`)
- Neo4j knowledge graph tools (`wiki_neo4j_search`, `wiki_neo4j_get_related`, `wiki_neo4j_find_paths`, `wiki_neo4j_query`)

See `docs/llm-mcp-foundation.md` for the model naming, runtime notes, and MCP server usage.

## Requirements

- macOS
- Node.js and npm
- Git available in your shell
- Electron runtime dependencies installed via npm
- Pandoc and a TeX engine (`xelatex` or `pdflatex`) for PDF export

## Getting Started

1. Install dependencies:

```bash
npm install
```

1. Start development mode:

```bash
npm run dev
```

This starts Vite and Electron together using `scripts/dev.sh`.

1. In the app:

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

### 7. Export PDF

Use the top-bar `Export` button to review chapter order, set export metadata, and generate a PDF.
Exported PDFs are written to `meta/exports/`, and export logs are written to `meta/logs/`.

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

Some helper endpoints and roadmap items exist in planning docs but are not fully surfaced in the UI yet (for example pull/merge UX). The README above describes the functionality currently implemented in code and available in the running app.
