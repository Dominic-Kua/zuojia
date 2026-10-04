# End-to-End Testing Guide for 作家

## Overview

Playwright drives the real Electron app (`electron/main.cjs`) against the production renderer build (`dist/`). Specs run serially with a single worker.

## Running Tests

```bash
# Full E2E suite (rebuilds dist/ first via global setup)
npm run test:e2e

# One spec file
ZUOJIA_RENDERER_MODE=production npx playwright test tests/e2e/wiki-operations.spec.js

# Debug UI
npm run test:e2e:ui

# HTML report
npx playwright show-report
```

## Configuration

See `playwright.config.js` in the repo root:

- `timeout: 30000` per test, `workers: 1`, `fullyParallel: false`
- Retries: 1 locally, 2 on CI (service-backed specs are timing-sensitive back-to-back)
- `globalSetup` rebuilds `dist/` when sources are newer, so specs never test stale code
- `globalTeardown` sweeps orphaned test novels (`e2e-*`, `test-*`) from `~/.zuojia/`
- Reports: HTML (`playwright-report/e2e-report`), JSON (`playwright-report/e2e-results.json`)

## Test Structure

```
tests/e2e/
├── helpers/electron-launcher.js  # launch/close Electron, wait for React root
├── e2e-global-setup.js           # rebuild dist/ when stale
├── e2e-global-teardown.js        # sweep orphaned test novels
├── commit-flow.spec.js
├── diagnostics-restore.spec.js
├── export-pdf.spec.js
├── git-integration.spec.js
├── git-settings.spec.js
├── manuscript-editor.spec.js
├── novel-creation.spec.js
├── snapshot.spec.js
├── spellcheck.spec.js
├── wiki-floating-panel.spec.js
├── wiki-link-syntax.spec.js
├── wiki-online.spec.js           # needs Neo4j + Synapse checkout
└── wiki-operations.spec.js
```

## Conventions (idempotency)

Every spec must be re-runnable without manual cleanup:

1. **Unique novel names** per run: `` `e2e-<topic>-${Date.now()}` `` under `~/.zuojia/`, created in `beforeAll`, removed in `afterAll`.
2. **Clean renderer state** in `beforeEach`: `localStorage.clear()` + `page.reload()` before opening the novel, so layout/detach/theme state never leaks between tests.
3. **`data-testid` selectors** for reliable targeting (e.g. `novel-list`, `wiki-detach-button`, `sidebar-resizer`, `reset-layout-button`).
4. **Explicit waits** after file-system or IPC side effects (polling intervals apply: dirty state ~10s, sync status ~30s).

## Service Prerequisites

- Most specs run with no external services.
- `wiki-online.spec.js` requires Neo4j on `bolt://localhost:7687` and the Project Synapse checkout at `~/code/project-synapse-mcp`.
- The `tests/integration/bridge-esm.test.js` live-Synapse tests additionally require Neo4j to accept the `neo4j/neo4j` test credentials; otherwise they skip instead of failing.

## Debugging Tips

- Screenshots/video Traces land in `test-results/e2e/` on failure (`screenshot: only-on-failure`, `trace: on-first-retry`).
- Console and page errors are forwarded to stdout by `electron-launcher.js` (`PAGE LOG:` / `PAGE ERROR:`).
- `await page.pause()` and `PWDEBUG=1` work as usual with Playwright.
