# Full Code Review Findings — 2026-08-24

Scope: full repository review on branch `code-review/cleanup` (main @ a8cb8d38).
Areas: Electron main process (`electron/`), React renderer (`src/`), Node helper package (`helper/`), scripts/configs/tests/repo hygiene.

Severity counts: **7 Critical · 17 High · ~40 Medium · ~30 Low · ~25 Nitpick**

---

## CRITICAL

### C1. Shell/command injection via renderer-controlled LLM config
**File:** `electron/llm-runtime.js:47-50` (with `electron/ipc-handlers.js:43`)
`execSync(\`curl -L -o "${modelPath}" "${config.modelUrl}"\`)` interpolates config values into a shell string. `modelUrl` and `modelName` are renderer-overridable via `helper:llm:startRuntime`, so a compromised/XSS'd renderer achieves arbitrary command execution.
**Fix:** use `spawn('curl', ['-L','-o', modelPath, modelUrl], { shell:false })` or `fetch` + `pipeline()`.

### C2. Hardcoded Neo4j password committed to the repo
**File:** `scripts/test-mcp-client.js:76`
A live Neo4j password is hardcoded in plaintext and tracked (also in git history at commit `b2ea9389`).
**Fix:** rotate the credential immediately, read from `process.env`, purge from history (`git filter-repo`).

### C3. Debounced save can overwrite the newly selected chapter with the previous chapter's content
**File:** `src/components/Manuscript.jsx:526-546`
When `currentChapter` changes, the save effect re-runs with stale `content` and schedules `saveChapter(newChapter, oldContent)`. If the async load doesn't resolve within the 400ms window, the new chapter file is overwritten with another chapter's text — silent manuscript corruption.
**Fix:** gate saves on a "loaded content belongs to currentChapter" ref, or store `{chapter, content}` pairs atomically.

### C4. Out-of-order chapter loads corrupt editor state → cross-chapter save
**File:** `src/components/Manuscript.jsx:503-523`
Rapid A→B→C selection launches concurrent loads with no staleness guard; a late-resolving response calls `setContent(B)` while `currentChapter === 'C'`, then the save effect persists B's content into C.
**Fix:** request-id / compare-at-resolution guard; discard stale responses.

### C5. Word count is zero for Chinese manuscripts
**Files:** `helper/src/stats/word-count.js:42`; surfaced via `src/hooks/useWordCount.js`
`/\b[\w]+(?:[-']['\w]+)*\b/g` is ASCII-only — Han characters match nothing, so pure-Chinese chapters report **0 words** in all counters. For an app named 作家 this invalidates word-count stats, "words today", index rebuilds.
**Fix:** add CJK character counting (`/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu`) to the ASCII word total.

### C6. Synapse bridge cannot start — CommonJS `require` in an ESM package
**File:** `helper/src/mcp/project-synapse-bridge.js:8-10` (with `helper/package.json:6`)
The package declares `"type": "module"` and `electron/mcp-runtime.js:307` runs this file with `node`, so `require(...)` throws immediately — the Synapse bridge never boots.
**Fix:** convert to ESM imports or rename to `.cjs`.

### C7. Git commit via shell-interpolated strings
**File:** `helper/src/git/commit.js:318,329`
`execSync(\`git add "${relativeFile}"\`)` and `git commit -m "${commitMessage}"` execute arbitrary shell if filenames/messages contain quotes or `$(...)`. Everything else in the repo correctly uses arg arrays.
**Fix:** `execFileSync('git', ['add', '--', relativeFile], ...)` as already done at commit.js:172.

---

## HIGH

### H1. `canUseSynapse` referenced out of scope in catch block
**File:** `electron/mcp-runtime.js:555` (declared at :465)
On MCP connection errors the catch evaluates a block-scoped `const`, throwing `ReferenceError` that replaces the original error and skips reconnect logic entirely.
**Fix:** hoist the declaration above the `try`.

### H2. Most IPC handlers perform zero input validation before fs/process access
**File:** `electron/ipc-handlers.js:83-358` et al.
`novelPath`, `filename`, `slug`, `timestamp` flow straight from renderer into file ops; path traversal (`filename: '../../...'`) is reachable unless each helper independently sanitizes (and several don't — see M-findings on readChapter/commit/markNovelOpened).
**Fix:** shared validator enforcing containment under the novel root.

### H3. Preload exposes generic invoke passthrough — no channel allowlist
**File:** `electron/preload.cjs:14`
`invoke: (handler, payload) => ipcRenderer.invoke(handler, payload)` lets the renderer call *any* channel; XSS in renderer equals full access to fs/git/process handlers.
**Fix:** expose named methods per operation.

### H4. Orphaned child processes on quit — `before-quit` not awaited
**File:** `electron/ipc-handlers.js:76-80`
Electron does not await `before-quit` listeners; `orchestrator.stopAll()` races `app.quit()`, leaving llama-server/Neo4j/MCP children alive.
**Fix:** `event.preventDefault()`, stop children, re-invoke `app.quit()`.

### H5. Neo4j startup timeout leaves spawned process untracked
**File:** `electron/neo4j-runtime.js:217-221`
On the 30s deadline the promise rejects but the `neo4j console` child is neither killed nor deregistered.
**Fix:** kill child + clear state before rejecting.

### H6. Hardcoded machine-specific Neo4j/JDK paths
**File:** `electron/neo4j-runtime.js:125,133`
`/opt/homebrew/Cellar/neo4j/2026.06.0/libexec` and pinned Openjdk `21.0.12` break on any other Mac or Homebrew upgrade.
**Fix:** resolve via `brew --prefix neo4j` (cached), env var, or bundle runtime.

### H7. IME (Chinese input) composition broken by mid-typing DOM replacement
**File:** `src/components/Manuscript.jsx:724-746,297`
The idle-rehighlight replaces DOM nodes under active IME composition, aborting/corrupting input — core UX failure for a Chinese writing app.
**Fix:** skip re-highlight during composition events; or migrate to the CodeMirror editor the repo already ships.

### H8. Snapshot restore races pending/in-flight autosave
**Files:** `src/components/Manuscript.jsx:526-546`; `src/components/DiagnosticsPanel.jsx:120-149`; `src/App.jsx:284`
An in-flight `saveChapter` promise cannot be cancelled and can land after restore completes, overwriting restored files with pre-restore content.
**Fix:** flush-and-quiesce outstanding saves before restore, then remount.

### H9. Sidebar wiki page reload wipes unsaved edits
**File:** `src/components/Sidebar.jsx:178-215` (deps array at :215)
Any `pages` refresh re-runs the load effect, resetting `wikiContent` and `isDirty=false` mid-typing.
**Fix:** depend only on `[novelPath, selectedSlug]`; bail out when dirty.

### H10. Stale-content window on wiki page switch can overwrite edits
**File:** `src/components/Sidebar.jsx:111-124,217-248`
Fire-and-forget flush save isn't awaited; switching back to a page re-reads it pre-write, showing stale text with `isDirty=false`, then autosave persists the stale text over user edits.
**Fix:** await the flush / serialize saves per slug.

### H11. Undefined-variable dead code in Neo4j stale-auth wipe
**File:** `electron/neo4j-runtime.js:105`
`path.join(dataDir, 'dbms','auth')` throws `ReferenceError` (variable is `dataPath`), silently swallowed — the entire auth-reset branch never executes.
**Fix:** rename to `dataPath`.

### H12. Chinese text rejected by novel-name slug generation
**File:** `helper/src/index/create.js:27-38`
Slug strips non-ASCII, so Chinese titles produce empty slugs and creation fails ("must contain at least one alphanumeric character").
**Fix:** allow `\p{L}\p{N}` slugs (as list-pages.js:117 does) or document ASCII-only naming.

### H13. Wiki link slug resolution strips Chinese — links break
**File:** `src/lib/wiki-link-parser.js:97-109` (consumed at `Sidebar.jsx:96`)
`resolveSlug` removes all non-ASCII, so `[[林黛玉]]` produces an empty slug and clicks fail with "Wiki page not found". Duplicates/conflicts with the unicode-aware `normalizeSlug` in `src/lib/wiki-link.js:74-97`.
**Fix:** one unicode-aware slugifier everywhere, matching the helper backend.

### H14. pdflatex fallback breaks all Chinese PDF exports; LuaTeX-only package unconditional
**Files:** `helper/src/export/latex-template.tex:7-20,43`; `helper/src/export/validate-deps.js:39-50`
Template uses `[T1]{fontenc}`/lmodern (cannot render Chinese) and no xeCJK under xelatex; `selnolig` errors under xelatex/pdflatex. A machine without xelatex silently produces broken PDFs.
**Fix:** require xelatex, add `\usepackage{xeCJK}` + CJK font, remove/guard selnolig.

### H15. `_bmad/` (456 files) and `_bmad-output/` are gitignored yet still tracked
**Files:** `.gitignore:3-4`; git index
Ignore patterns only prevent *new* files; tracked files keep being committed. Also includes a tracked `.DS_Store`.
**Fix:** decide deliberately, then `git rm -r --cached` or un-ignore.

### H16. Dev launchers orphan Vite; port races point Electron at wrong server
**Files:** `scripts/dev-launcher.js:88,211`; `scripts/dev.sh:39,108-109`; `vite.config.ts:7-10`
SIGTERM to `npm` doesn't kill the vite grandchild (port 5173 held); `strictPort: false` lets Vite drift ports while launchers assume fixed 5173; "port in use" treated as "ready".
**Fix:** process-group kill or spawn vite directly; set `strictPort: true`; verify the responder is actually Vite.

### H17. Tautology/placeholder tests green-wash suites; whole LLM suites skipped
**Files:** `tests/unit/mcp-types.test.js:10-14`; `tests/e2e/smoke.spec.js:3-7`; `tests/unit/electron/llm-config.test.js:9`; `tests/unit/electron/llm-runtime.test.js:6,51`
`expect(true).toBe(true)` placeholder specs provide zero coverage; two entire LLM test suites are `describe.skip`ed with no tracking issue.
**Fix:** delete placeholders; ticket or reinstate skipped suites.

---

## MEDIUM

### Electron

- **M1. `execSync` model download blocks main thread up to 10 min** — `electron/llm-runtime.js:47-49`. Freeze of all IPC/UI. Use async spawn/fetch with progress.
- **M2. Path-traversal-capable `modelName`** — `electron/llm-config.js:60-63`; `getModelPath()` joins it raw; `../..` values let renderer write/delete outside models dir. Validate `/^[A-Za-z0-9._-]+$/`.
- **M3. Orchestrator SIGKILLs whatever listens on 7687/7474** — `electron/orchestrator.js:18-29`. Kills unrelated user Neo4j instances. Scope to PIDs we spawned.
- **M4. `currentNovelPath` latched despite partial startup failure** — `electron/orchestrator.js:236`. Later `startAll` returns `already_running` with degraded services, no recovery. Latch only on success.
- **M5. Bare `node` spawn won't exist in packaged app** — `electron/mcp-runtime.js:307`. Use `process.execPath` + `ELECTRON_RUN_AS_NODE`.
- **M6. `dbName` vs `databaseName` param mismatch silently ignores custom DB name** — `electron/neo4j-runtime.js:63` vs `ipc-handlers.js:815`.
- **M7. Driver credential inconsistency: start() no-auth vs health() basic-auth** — `electron/neo4j-runtime.js:226,329`. Unify driver config.
- **M8. Driver leak on early-return `stop()`; JVM orphaning when killing the `neo4j` wrapper script** — `electron/neo4j-runtime.js:260-265,134,278-291`. Close driver on all paths; kill process group.
- **M9. Duplicate entry points `main.js`/`preload.js` already drifted from `.cjs` canonical** — `electron/main.js`, `electron/preload.js` (preload.js forwards raw `event`; .cjs strips it). Delete the `.js` pair.
- **M10. Arbitrary-path write in `app:markNovelOpened`** — `electron/ipc-handlers.js:748-765`. Enforce containment under `~/.zuojia`.
- **M11. Unbounded Cypher execution from renderer incl. DELETE** — `ipc-handlers.js:893-914` + `neo4j-runtime.js:491-531`. Restrict to read-only or remove.
- **M12. Inconsistent error envelopes; many handlers reject raw Errors breaking the documented contract** — `ipc-handlers.js:83-195,267-358` vs wrapped ones. Route everything through one wrapper.
- **M13. Monolithic 1000-line ipc-handlers.js with copy-pasted envelope boilerplate** — extract `ok()/fail()` helpers, split per domain.
- **M14. No navigation lock on the BrowserWindow** — `electron/main.cjs:40-48`. Add `will-navigate` preventDefault + deny-all `setWindowOpenHandler`.
- **M15. `app.whenReady().then(...)` has no `.catch`** — `electron/main.cjs:62`.

### Renderer

- **M16. Loading any chapter triggers a redundant byte-identical save back to disk** — `src/components/Manuscript.jsx:503-546`. Track lastSavedContentRef; skip unchanged writes.
- **M17. `hasUnsavedChanges={false}` hardcoded — unsaved indicator & onBeforeSwitch permanently dead** — `src/components/Manuscript.jsx:774`; `src/components/Navigation/ChapterList.jsx:8-9,30-43,64`.
- **M18. Default-chapter creation latch set before success; transient failure means never created** — `src/components/Manuscript.jsx:145,468-493`.
- **M19. Spellcheck effect catch ignores `cancelled` → setState after unmount** — `src/components/Manuscript.jsx:589-595`.
- **M20. Popover positioned with viewport coords + absolute positioning; drifts on scroll** — `src/components/Manuscript.jsx:429-439`; `src/components/WikiLinkPopover.jsx:20-25`. Use fixed positioning or convert coordinates.
- **M21. 100ms timeout handshake for opening wiki pages is racy; event silently lost** — `src/App.jsx:187-197`; `Sidebar.jsx:126-130`. Pass `{slug, nonce}`, consume via callback.
- **M22. Closing a novel discards unsaved edits without warning or flush** — `src/App.jsx:159-168`.
- **M23. Two independent `useWikiPages` instances hold divergent page lists** — `src/App.jsx:119` vs `Sidebar.jsx:20`. Hoist one instance or add an update event.
- **M24. Sidebar title rename fires per keystroke burst through intermediate titles; timer survives page switch** — `src/components/Sidebar.jsx:274-305,250-256`.
- **M25. Fake "Sync Status" hardcoded strings presented as live status** — `src/components/Sidebar.jsx:507-511`. Remove or wire real data.
- **M26. DOMPurify default URI policy likely strips `file:` images from preview** — `src/components/Sidebar.jsx:74-87,105-108`. Escape attrs; deliberately extend allowed URIs.
- **M27. Rules-of-Hooks violation: early return above useEffect (latent crash)** — `src/components/SettingsModal.jsx:29,33-49`; same in `CommitButton.jsx:27,49-85`.
- **M28. SettingsModal Save persists only the active tab; other-tab edits silently lost** — `src/components/SettingsModal.jsx:90-110`.
- **M29. Export reads disk without flushing debounced save → PDFs missing recent edits** — `src/components/ExportDialog.jsx:48-86,149-173`.
- **M30. DiagnosticsPanel loadData lacks stale-guard/cancellation** — `src/components/DiagnosticsPanel.jsx:45-64`.
- **M31. Single fuzzy partial match auto-opens an unrelated wiki page** — `src/hooks/useWikiLinks.js:55-58`; `src/lib/wiki-link.js:131-154`. Require stronger threshold.
- **M32. useChapters lacks cancellation on novel switch; stale list overwrite** — `src/hooks/useChapters.js:10-33`.
- **M33. Invalid novel opens silently do nothing (no error shown)** — `src/components/Navigation/NovelSelector.jsx:47-68`.
- **M34. Validator message/slug-preview disagree with actual rules; Chinese titles preview empty dir names** — `src/components/Navigation/NovelSelector.jsx:19-28,74-76,199-203`.
- **M35. Dead CodeMirror artifacts: unused buggy components/extensions** — `src/components/Manuscript/CodeMirrorEditor.jsx` (double-fire on blur, innerHTML wipe, sync fights typing), `src/lib/codemirror-wiki-link.js` (links rendered twice, listener churn), `src/lib/codemirror-extensions/wiki-links.js` (full reparse per keystroke), `src/hooks/useAutosave.js` (stale-capture bug). Delete or fix.

### Helper

- **M36. Snapshot restore deletes novel dir before verifying copy succeeds** — `helper/src/backup/snapshot.js:402-404`. Copy to temp then swap; snapshot current state first.
- **M37. Duplicated directory lists drift between create and restore** — `snapshot.js:11` vs `:159` (`meta` missing from restore list).
- **M38. Illegal Cypher parameters in variable-length path bounds — related/find-paths tools fail 100%** — `helper/src/mcp/synapse-server.js:132,172` (`[*1..$depth]`). Clamp depth in JS and interpolate validated int.
- **M39. readChapter has no traversal validation (write does)** — `helper/src/index/chapter.js:14`; also chapter.js:72 traversal check second clause is vacuous.
- **M40. Commit traversal prefix check misses sibling dirs (`../manuscript-evil/`)** — `helper/src/git/commit.js:288`. Use `path.relative`.
- **M41. Dead "nothing to commit" detection — stderr discarded via stdio:'ignore'** — `helper/src/git/commit.js:329-336`; same flaw `helper/src/git/backup.js:82`.
- **M42. `generateSlug` strips Chinese → UUID filenames never match link targets** — `helper/src/wiki/crud.js:196` vs wiki-tools' `\p{L}\p{N}` normalization. Align schemes.
- **M43. `git add -A` stages backups/exports/logs into every backup commit** — `helper/src/git/backup.js:69`. Stage selectively.
- **M44. Non-atomic index.json write** — `helper/src/index/rebuild.js:100`; also non-atomic writeFile in crud.js:253,455. Temp+rename pattern exists elsewhere.
- **M45. Duplicate wrong word counter in rebuild (whitespace-based)** — `helper/src/index/rebuild.js:29-31`. Use calculateWordCount.
- **M46. mcp-client sends non-MCP `shutdown` RPC that always throws** — `helper/src/mcp/mcp-client.js:187-188`. Just destroy transport.
- **M47. Hand-rolled YAML parser/writer lossy on round-trip** — `helper/src/git/config.js:31-89`.
- **M48. Driver-creation race leaks connections; wiki_* tools lack try/catch unlike neo4j tools** — `helper/src/mcp/synapse-server.js:28-40,367-400`.
- **M49. Response normalizer error-sniffs by `includes('error')` and fabricates relevance scores** — `helper/src/mcp/response-normalizer.js:255,142,294`.

### Scripts / Configs / Hygiene

- **M50. `run_all.sh` exports every secret in `.env` into the entire dev process tree** — `run_all.sh:4-8` (`set -a; source .env`). Whitelist vars instead.
- **M51. release-mac-local.sh: hard-fails without `.env`, blanket-exports secrets, newest-DMG glob can validate a stale artifact, smoke fn ignores its arg** — `scripts/release-mac-local.sh:6-8,41,16-31,54`.
- **M52. Tracked compiled bytecode despite "Python removed" commit ca8dbdff; dead Python stack remains** — `helper/src/mcp/__pycache__/*.pyc` (tracked); `helper/api.py`, `cli.py`, `pyproject.toml`, `src/mcp/project-synapse-bridge.py`; `scripts/dev-launcher.js:126` still references api.py. Delete all; ignore `__pycache__/`.
- **M53. Junk dirs from buggy absolute-path joins** — `Users/dominickua/...` (empty tree at repo root), `temp_test_manifests/` (empty csv), empty root `test/` dir. Delete; audit scripts for non-normalized joins.
- **M54. helper/package.json broken: `main` points at nonexistent index.js; coverage dep missing; vitest pinned ^1 vs root ^4** — `helper/package.json:5,8,12,27`.
- **M55. Integration tests run twice (`test:all` overlaps `npm test`)** — `vitest.config.ts:10`; `package.json:17,20,23`. Exclude integration from default include.
- **M56. Test-only `@testing-library/dom` shipped in runtime dependencies** — `package.json:29`. Move to devDependencies.
- **M57. Port-in-use assumed to be our Vite (wrong-server hazard + TOCTOU)** — `scripts/dev.sh:102-104`; `dev-launcher.js:43-83`.
- **M58. dev.sh trap double-fires on Ctrl+C, masks exit codes** — `scripts/dev.sh:47,26-44`.
- **M59. test-mcp-client.js: hardcoded `/Users/dominickua` fallback; timeout leaks bridge proc and timer** — `scripts/test-mcp-client.js:68,128-133`.
- **M60. tsconfig includes only src+tests — electron/ and helper/ fully unchecked** — `tsconfig.json:15`.
- **M61. ~15 fixed waitForTimeout sleeps across e2e specs = flaky + slow** — spellcheck/wiki-link-syntax/snapshot/diagnostics specs. Use `expect.poll` on observable state.
- **M62. e2e wiki-operations spec asserts near-nothing (`toBeTruthy()` on a locator always passes)** — `tests/e2e/wiki-operations.spec.js:108-122`.
- **M63. Skipped integration test whose implementation exists** — `tests/integration/word-count-flow.test.js:89-110` vs `helper/src/git/history.js:17`.
- **M64. Shared e2e launcher logs debug noise + unconditional 500ms sleep** — `tests/e2e/helpers/electron-launcher.js:41-46`.

---

## LOW

### Electron
- External-server confusion in llm-runtime `stop()` (silent no-op for unowned servers) — `electron/llm-runtime.js:122-131,238-241`.
- Hardcoded external-health port 8080 ignoring configured port — `electron/llm-runtime.js:287`.
- Suspicious/hallucinated-looking default model id `gemma-4-E2B-it-Q3_K_S` — `electron/llm-config.js:7-8`; verify it resolves or first-run download always fails.
- Prompt content logged to console on every chat call (privacy leak) — `electron/ipc-handlers.js:561`.
- Unbounded response buffering in chatLlamaCpp — `electron/ipc-handlers.js:512-516`.
- `hasWikiData()` false-negative after restart + `CREATE` (not `MERGE`) duplicates graph data — `electron/neo4j-runtime.js:354,430`.
- Sequential per-node/per-edge Cypher round trips — `electron/neo4j-runtime.js:428-463`. Batch with `UNWIND`.

### Renderer
- Click listener torn down/re-added every render (fresh object dep) — `src/components/Manuscript.jsx:389-445`.
- Highlighter regex rejects empty display segment `[[Page|]]` — `src/components/Manuscript.jsx:186`.
- `escapeForRegex` duplicates lib/spellcheck escapeRegExp — `Manuscript.jsx:611-613`.
- Debug console.log spam in production paths — `LlmChatWindow.jsx` (10 sites), `NovelSelector.jsx:21-26,81-83,192`, `mcp-runtime.js` hot path.
- Stale `isMcpRunning` skips wiki context on first message after auto-start — `src/components/LlmChatWindow.jsx:75-86,162`.
- LLM reply silently dropped if placeholder vanished mid-flight — `LlmChatWindow.jsx:189-200`.
- Health polled every 5s forever even with chat window closed — `LlmChatWindow.jsx:30-60`.
- `formatBytes` renders "NaN MB" on missing size — `DiagnosticsPanel.jsx:4-8`.
- ExportDialog shared `error` state conflates export and log-view failures — `ExportDialog.jsx:100-109,272-304`.
- Dead updater-style branch in handleLlmChange — `SettingsModal.jsx:138-143`.
- Numeric settings fields can't be cleared (NaN ignored); float ports accepted — `SettingsModal.jsx:145-153`.
- `ref` passed to non-forwardRef Sidebar (stays null) — `App.jsx:19,300-305`.
- Duplicated identical novel-open/created handler bodies — `App.jsx:127-157`.
- ChapterList mutates DOM directly (`event.target.value = ...`) on controlled select — `ChapterList.jsx:40,50`.
- useWordCount clamps manuscript total up via cached chapter count (masks staleness) — `useWordCount.js:69`; duplicate immediate today-fetch on chapter switch — `:114-156`.
- useGitHistory keeps stale commits beneath error banner — `useGitHistory.js:21-24`.
- Half of useWikiLinks' returned state is dead (never rendered); hover preview leaks filesystem paths — `useWikiLinks.js:14-17,113-122,80`.
- spellcheck word extraction splits accented Latin ("café" → misspelled "é") — `src/lib/spellcheck.js:32`; case-sensitive replace vs case-insensitive detect — `:56-63`.
- Module-scope `/g` regex mutation hazard — `src/lib/wiki-link.js:6,47`; dead exports — `:162-182`.
- ipc-client console.errors benign codes like DIALOG_CANCELED — `src/lib/ipc-client.ts:34-37`.
- No StrictMode / no error boundary (white-screen on render exceptions) — `src/main.jsx`.

### Helper
- Bare `git push` with no remote/upstream check after successful local backup — `helper/src/git/backup.js:90`.
- Duplicated ensureGitRepo/getChangedFiles/validateNovelPath/frontmatter-parser across modules — commit.js/config.js/push.js/backup.js; crud.js vs list-pages.js frontmatter subtly divergent.
- TOCTOU race on wiki create (exists-check); update doesn't refresh spellcheck dict while create/delete do — `helper/src/wiki/crud.js:241-246,253-310`.
- Raw fs error codes (ENOENT/EACCES) leaked as API error codes — `crud.js:262,299` etc.; pervasive misuse of SUBPROCESS_FAILED for non-subprocess failures.
- Pandoc args starting with `-` could parse as flags — `helper/src/export/command-builder.js:2` (make paths absolute / insert `--`).
- sanitizeChapterOrder drops bad entries silently — `helper/src/export/pdf.js:34-47`; log line ambiguous for spaced paths — `:151`.
- `readdir ... withFileTypes 'recursive'` + `split(path.sep)` filter never matches on Windows — `wiki-tools.js:62`; `list-pages.js:105`; `rebuild-dict.js:143`.
- BFS via `queue.shift()` O(n²) — `synapse-server.js:346`; search lowercases query but CONTAINS is case-sensitive per stored casing — `:97`.
- Concurrent initialize() double-sends; dead notifications/initialized handler — `helper/src/mcp/mcp-client.js:106-136,88-91`.
- Dead code: DEFAULT_CONFIG/deepMerge in mcp-config.js — `helper/src/mcp/mcp-config.js:6-45,87-99`.
- No subprocess output cap or timeout (hung pandoc stalls export forever) — `helper/src/util/subprocess.js`.
- history.js baseline racy across processes; nested-dir counts diverge from manuscript-count — `helper/src/git/history.js:102-118`.
- Performance assertion (<1s wall clock) flaky on CI — `tests/integration/word-count-flow.test.js:165-183`.
- Playwright artifacts written under tracked `_bmad-output/test-artifacts/` — `playwright.config.js:27-28,53`.
- `dev:old` legacy script retained — `package.json:11`.
- Stray untracked docs at risk: SESSION_SUMMARY.md, prior findings doc — repo root/docs.
- 12 MB unrotated log in logs/ — add rotation or write to $TMPDIR.
- Empty agent-manifest.csv in junk temp dir — delete.

---

## NITPICKS

- Mojibake comments (`ä½å®¶` ← 作家): `playwright.config.js:4`, `scripts/dev-launcher.js:4`.
- Listener accumulation in llm-runtime stop() (should be `.once`) — `electron/llm-runtime.js:244-246`.
- Unused `novelPath` param in orchestrator ingest — `electron/orchestrator.js:31`.
- Formatting glitch before createMcpRuntimeManager — `electron/mcp-runtime.js:121-122`.
- Verbose per-call console logging incl. serialized args — `electron/mcp-runtime.js:466-518`.
- Dead TODO trailing ipc-handlers.js — `electron/ipc-handlers.js:999-1000`.
- Monolithic Manuscript.jsx (862 lines) — extract DOM/text utils to lib; split editor/spellcheck/resize concerns.
- Messages keyed by array index; deprecated onKeyPress; no focus trap/Escape in chat overlay — `LlmChatWindow.jsx:375,437,313-322`.
- Popover `<li onClick>` not keyboard focusable; classnames don't match app conventions — `WikiLinkPopover.jsx:40,52,55`.
- Only SnapshotButton handles Escape; sibling modals don't; none trap focus.
- Identical toast useEffect blocks across Commit/Push/Snapshot/Export/Diagnostics — extract useToast hook.
- Dialog shows previous session's files momentarily on reopen — `CommitButton.jsx:43-47`.
- Drop-reorder semantics differ by drag direction; no keyboard reorder — `ExportDialog.jsx:132-144`.
- Author/date metadata reset on every dialog open — `ExportDialog.jsx:18,56`.
- Magic storage keys/threshold literals scattered in App.jsx — extract constants module.
- formatDate shows "0m ago"; inline confirm swaps shift layout — `WikiPageList/index.jsx:84-89,167-194`.
- Hardcoded machine defaults (/opt/homebrew/bin/ollama, gemma4:e2b) — `SettingsModal.jsx:11-12`.
- Inconsistent import specifier style (`../lib/ipc-client.ts` w/ extension vs extensionless) — useWikiLinks.js:3, useSpellcheck.js:6.
- Step numbering inconsistent ([1/4] then [2/5]) — `release-mac-local.sh:33,38`.
- One-shot issue-creation script kept in repo without guard — `create-release-roadmap-issues.sh`.
- Redundant duplicated exclude entries in vitest.config.ts.
- skipLibCheck:true in otherwise strict config — `tsconfig.json:10`.
- wordSet + wordSetLowercase dual state; loading flashes on every dict event — `useSpellcheck.js:38-39`.
- Full chapter content serialized over IPC per keystroke burst — `useWordCount.js:44`.
- Tests share `helper/tests/temp` root (potential parallel collision) — `helper/tests/index.test.js:15`.
- copyDirectory wraps errors losing err.code — `snapshot.js:74`; no stdin backpressure in bridge — `project-synapse-bridge.js:92-95`.
- simple-git dependency unused — `helper/package.json:24`.

---

## Cross-cutting themes

### Follow-up findings (2026-08-24, post-fix e2e runs)

**Fixed in second pass:**
- **[High] E2E suite ran against stale dist/ builds** — the Playwright launcher forces production mode, so Electron loads dist/index.html; running `npx playwright test` directly (vs `npm run test:e2e`) silently tested old code. The mysterious `helper:git:isRepo` handler-missing log was a ghost from a July 27 build (the caller was already removed from source). Fixed: added tests/e2e/e2e-global-setup.js which rebuilds dist/ when source is newer, wired into playwright.config.js globalSetup.
- **[High] "Start LLM" button was a silent no-op** — LlmChatWindow checked `config.status === 'ok'` on an already-unwrapped config, so startRuntime was never called. Fixed; unit-test mocks that enshrined the wrong envelope shape updated to match reality.
- **[High] Failed chapter load silently disabled all saves** — introduced by the C3/C4 ownership guard: on load error `loadedChapterRef` stayed null and every save path silently bailed. Now surfaces a visible error banner explaining editing is paused until reselect.
- **[Medium] Restore could be clobbered by autosave fired mid-restore** — flush protocol extended with suspend/resume; saves are suspended for the duration of restore and resumed in a finally block.
- **[Medium] Backend slugifier divergence** — helper `generateSlug` made unicode-aware so created pages match renderer link slugs end-to-end (CJK and accented titles).
- **[Low] Sidebar page-switch interleave** — navigation is optimistic; per-slug pending-flush map makes the loader await its own in-flight write.
- **[Low] before-quit double-entry + unbounded hang** — teardown re-entry guarded; stopAll raced against a 10s timeout.
- **[Low] Neo4j/JDK version probe sorted lexicographically; brew --prefix output used without existence check** — both fixed.
- **[Low] Dead `gitHandlers.pull` channel removed** — no handler existed; would have failed at the preload gate.

**Documented, not fixed (need design decisions / larger refactors):**
- **[Medium] Quit during service startup can orphan newly spawned children** (`orchestrator.js`) — needs a shutdown-requested flag checked by each start step.
- **[Medium] Wiki ingest silently no-ops when Synapse isn't initialized** — degraded status should surface to UI.
- **[Medium] Wiki list-pages normalizes filenames into slugs but CRUD uses them verbatim** — pages whose filenames aren't kebab-case are visible but inert. Needs one canonical round-trip.
- **[Medium] Renaming a wiki page breaks inbound [[links]]** — no reference rewriting; feature-level fix required.
- **[Low] LaTeX template hardcodes PingFang SC (macOS-only)** — acceptable if macOS-only is the product invariant; otherwise probe fonts in validate-deps.

1. **Save-path races** need one primitive: a per-target "flush pending writes and await quiescence" reused by chapter switch, novel close, snapshot restore, export, and wiki page switch (C3, C4, H8, H9, H10, M16, M22, M29).
2. **CJK correctness is the product's core promise (作家) and currently fails** in word count (C5), IME stability (H7), novel creation (H12), wiki links (H13), PDF export (H14).
3. **Security posture**: shell injection (C1, C7), leaked credential (C2), no IPC validation/allowlist (H2, H3). Fix these before any packaging/release.
4. **Dead code accumulation**: duplicate Electron entrypoints, four unused CodeMirror/editor artifacts, dead Python stack, dead hook state — delete aggressively; several bugs live only in dead code.
5. **Hygiene contradictions**: gitignored-but-tracked `_bmad*/`, tracked `.pyc`/`.DS_Store`, junk `Users/` tree — one cleanup commit resolves all.
