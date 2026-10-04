# 作家 (Zuojia)

A local-first desktop writing app for novelists who want Markdown files, wiki-style worldbuilding, and Git-backed safety.

## Table of Contents

- [What This App Does](#what-this-app-does)
- [Implemented Features](#implemented-features)
- [Release Notes](#release-notes)
- [AI Foundation](#ai-foundation)
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

- `manuscript/` — chapter Markdown files
- `wiki/` — wiki page Markdown files for characters, locations, lore
- `meta/` — index, backups, spellcheck dictionary, and metadata

The app focuses on a writing workflow where you can:

- Create or open a novel quickly
- Edit chapters with autosave behavior
- Create and maintain wiki pages
- Follow wiki links directly from the manuscript
- Track word counts (chapter, manuscript, today)
- Back up/push work through Git
- Ask an LLM questions grounded in your worldbuilding notes

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
- Detachable floating panel: drag by the titlebar, resize from the corner handle, position/size persist across sessions
- Commit history and git sync status (branch, ahead/behind, uncommitted changes) with a `Pull` button when a remote is configured

### Workspace Layout

- Tiling manuscript/wiki split: drag the divider to give either pane any share of the desk, from a sliver up to the full window
- Top-bar presets: `Manuscript` (editor only), `Split` (50/50), `Wiki` (wiki only)
- `Reset UI` button restores the default layout, re-docks the wiki, and resets the floating panel position/size
- Layout choice persists across sessions; double-clicking the divider also resets

### Statistics

- Chapter word count
- Manuscript word count
- "Words written today" count (from git history helper)

### Git and Backup Helpers

- Helper endpoint for chapter Git commits (`helper:git:commit`)
- `Commit` button commits all novel files; generated directories are ignored on push
- Validated remote push flow from the UI `Push` button, inheriting the existing git remote and upstream branch when present
- SSH key auto mode supporting ed25519 keys and ssh-agent setups out of the box
- Git remote configuration from the UI `Settings` button
- Local snapshot helper APIs (create, list, restore)

### Export

- PDF export from the top-bar `Export` button
- Export dialog with title, author, and publication date metadata
- Chapter-order export driven by the manuscript index
- Export logs written under `meta/logs/`

## Release Notes

### Unreleased (since v3.0.0)

- Flexible tiling workspace: manuscript/wiki proportional split with `Manuscript` / `Split` / `Wiki` presets and a `Reset UI` button (PR #112)
- Resizable, draggable floating wiki panel with persisted position and size (PR #112)
- Fixed wiki editor, snapshot, and commit inputs rendering unreadable text in dark mode (PR #112)
- `Commit` now covers all novel files; `Push` ignores generated directories (PR #111)
- `Push` inherits the existing git remote and upstream branch instead of requiring reconfiguration (PR #111)
- SSH key auto mode so ed25519 and ssh-agent setups work out of the box (PR #111)
- Sidebar now shows commit history, sync status (branch, ahead/behind, last push), dirty-file indicator, and a `Pull` button for repos with a remote
- Writing Desk design-token theme across light and dark modes
- Test hygiene: global E2E teardown sweeps orphaned test novels; live-Synapse integration tests skip cleanly when Neo4j isn't available with the test credentials

### v3.0.0

- Replaced the Python bridge with a pure Node.js MCP client for Project Synapse
- Added dynamic Neo4j and JDK path resolution (Homebrew Cellar versions, PATH fallback)
- Extracted hardcoded config into shared defaults modules (`neo4j-defaults.js`, `llm-defaults.js`, `constants.js`, `platform-paths.js`)
- Aligned SettingsModal defaults with `llama-server` (port 8080, model auto-discovery)
- Fixed MCP tool error propagation so `WIKI_NOT_FOUND` and similar codes are preserved
- Added comprehensive test suite: 630+ unit, integration, and E2E tests

### v2.0.1

- Fixed packaged-app startup regressions that could lead to a blank or unusable app after installation
- Restored release branding in packaged builds, including the app name `作家` and app icon
- Hardened release behavior so release/test flows target production renderer mode while dev flows stay in development mode
- Added artifact-level release validation: local release now smoke-tests both the packaged `.app` bundle and the mounted `.dmg` artifact before publish
- Added checksum generation in the local mac release flow for uploaded DMG verification

For full release details, see `docs/release-notes-v3.1.0.md` and `docs/release-notes-v2.0.1.md`.

## AI Foundation

Local AI foundation with llama.cpp, Neo4j 2026, and Project Synapse:

- **LLM runtime:** `llama-server` (llama.cpp) with `unsloth/gemma-4-E2B-it-GGUF` Q3_K_S model (~2.3 GB, auto-downloaded)
- **Knowledge graph:** Neo4j 2026 with fulltext, vector, and property indexes
- **MCP bridge:** Project Synapse (Python/FastMCP) exposes `query_knowledge`, `ingest_text`, and wiki tools
- **Orchestrator:** Automatic 6-step startup when a novel opens: kill orphans → start Neo4j → start MCP → ingest wiki → start LLM
- **Per-novel storage:** Neo4j data at `<novel>/.zuojia/neo4j-data/`, LLM model at `~/.zuojia/models/`

### How It Works

1. Open a novel — orchestrator starts Neo4j, Project Synapse, and llama-server
2. Wiki `.md` files are ingested into Neo4j as entities, facts, and relationships
3. LLM Chat queries the knowledge graph via MCP when wiki-related keywords are detected
4. Wiki context is injected into the LLM system prompt for grounded responses

See `docs/llm-mcp-foundation.md` for full architecture, configuration, and schema details.

## Requirements

### App

- macOS
- Node.js and npm
- Git available in your shell
- Electron runtime dependencies installed via npm
- Pandoc and a TeX engine (`xelatex` or `pdflatex`) for PDF export

### AI Features (optional)

- Neo4j 2026 (`brew install neo4j`)
- llama.cpp (`brew install llama.cpp`)
- uv (`pip install uv` or `brew install uv`)
- Project Synapse cloned to `~/code/project-synapse-mcp`

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
Use `Push` to send committed work to that configured remote. If the novel already has a git remote and upstream branch, `Push` uses them automatically.
Use the sidebar `Pull` button to fetch and merge the remote's latest changes.

### 7. Arrange the Workspace

- Drag the divider between the manuscript and wiki to give either pane more room, up to the full window
- Use the top-bar `Manuscript`, `Split`, and `Wiki` buttons to jump to a preset arrangement
- Click `Detach` in the wiki header to float the wiki as a separate panel; drag it by the titlebar and resize it from the bottom-right corner
- If anything gets mis-sized or lost, click `Reset UI` to restore the default layout

### 8. Export PDF

Use the top-bar `Export` button to review chapter order, set export metadata, and generate a PDF.
Exported PDFs are written to `meta/exports/`, and export logs are written to `meta/logs/`.

## Developer Commands

```bash
npm run dev               # Start Vite + Electron (recommended)
npm run dev:node          # Start dev via Node launcher
npm run dev:vite          # Start only Vite
npm start                 # Start Electron app
npm run build             # Build renderer with Vite
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage
npm run test:integration  # Run integration tests
npm run test:e2e          # Run end-to-end tests
npm run test:all          # Run all tests
```

## Testing

The project has **690+ tests** across unit, integration, and E2E layers:

| Layer | Framework | Run with |
|-------|-----------|----------|
| Unit | Vitest (jsdom + node) | `npm run test` |
| Integration | Vitest | `npm run test:integration` |
| E2E | Playwright + Electron | `npm run test:e2e` |

### What's covered

- **Electron layer:** IPC handlers, orchestrator, Neo4j/MCP/LLM runtime managers
- **React UI:** Sidebar, chapter list, settings, LLM chat, word count hooks
- **Helper modules:** Wiki CRUD, word counting, spellcheck, git operations
- **MCP integration:** Client, config, transport, tool mapper, wiki tools

See `tests/e2e/README.md` for E2E test details.

## Project Structure

```text
src/                 React renderer code (components, hooks, lib)
electron/            Electron main/preload + IPC handlers, runtime managers
helper/              Helper modules (wiki CRUD, git, stats, MCP client)
tests/               Unit (Vitest), integration, and E2E (Playwright) tests
docs/                Architecture docs, release notes, plugin specs
scripts/             Development launch scripts and release tooling
_bmad-output/        Planning artifacts, story specs, sprint tracking
```

## Current Scope Notes

Some helper endpoints and roadmap items exist in planning docs but are not fully surfaced in the UI yet. The README above describes the functionality currently implemented in code and available in the running app. Merge-conflict resolution, for example, is still handled outside the app with standard git tooling.
