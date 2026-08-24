# Code Review Findings — 2026-07-25

**Branch:** `make_llm_talk_to_synapse_knowledge_base`
**Commits reviewed:** `b3e1a427` + `498d0bf1`
**Review mode:** no-spec

**Summary:** 5 HIGH, 9 MEDIUM, 9 LOW findings (3 dismissed as noise)

---

## HIGH — Patch

### 1. `dataDir` undefined variable
**File:** `electron/neo4j-runtime.js:105`

`path.join(dataDir, 'dbms', 'auth')` — `dataDir` is never declared in any scope. The correct variable is `dataPath` (declared at line 89). This code path executes when a stale system database directory exists AND the config contains `auth_enabled=false`.

**Impact:** `ReferenceError` thrown inside `start()`, preventing Neo4j from launching. Caught by orchestrator but user sees "Neo4j start failed" with no actionable detail.

### 2. `execSync` blocks event loop during 2.3GB model download
**File:** `electron/llm-runtime.js:46-53`

`execSync(\`curl -L -o "${modelPath}" "${config.modelUrl}"\`, { stdio: 'pipe', timeout: 600000 })` freezes the entire main process for 1-10 minutes. During download, no IPC responses, no UI repaints, no health checks execute.

**Impact:** Electron main process unresponsive. CSS animation continues (compositor thread) but the button stays disabled because IPC handlers are blocked.

### 3. `lsof -ti` syntax wrong — port 7687 never matched
**File:** `electron/orchestrator.js:21`

`lsof -ti :7687 -ti :7474` — on macOS, multiple `-ti` flags cause the last `-i` to override earlier ones. Only port 7474 is searched. Orphaned Neo4j processes on port 7687 (bolt) are never found or killed.

**Fix:** Use `lsof -ti :7687,7474` or run two separate `execSync` calls.

### 4. `stopAll` races `startAll` — no mutual exclusion
**File:** `electron/orchestrator.js:244-270`

`startAll()` sets `startupInProgress` but `stopAll()` never reads or writes it. Both functions mutate shared `processRef` state on `neo4jRuntime`, `mcpRuntime`, and `llmRuntime`. If `stopAll()` runs during `startAll()`, both modules fight over child process lifecycles. Additionally, `currentNovelPath` is set to null by `stopAll()` but then restored by the concurrently-running `startAll()`.

**Impact:** Corrupted process state, leaked child processes, orchestrator believes services are running when they aren't.

### 5. Command injection via `modelUrl`
**File:** `electron/llm-runtime.js:48` + `electron/llm-config.js:65`

`config.modelUrl` is interpolated into an `execSync` curl argument with zero sanitization. The value is validated as non-empty but not for protocol (`https://` only), domain allowlist, or shell metacharacters. User-persisted `llm-config.json` is the attack surface.

**Impact:** If the config file is compromised, full RCE in the Electron main process via shell injection (`$(...)`, backticks, `;`).

---

## MEDIUM — Patch

### 6. Inconsistent label checking
**File:** `electron/neo4j-runtime.js:351` vs `:375`

`hasWikiData()` queries `MATCH (e:Entity) RETURN count(e)` but `importWikiData()` checks for `WikiPage` nodes. Legacy import creates `WikiPage` nodes, Synapse's `ingest_text` creates `Entity` nodes.

**Impact:** `hasWikiData()` always returns 0 for legacy-imported data, triggering unnecessary re-ingestion on every novel open.

### 7. No overall timeout on wiki ingestion
**File:** `electron/orchestrator.js:173-202`

Each file has a per-call timeout of 120s, but the `ingestWikiViaSynapse` loop over N files has no overall deadline. Total wall-clock wait = N × 120s max.

**Impact:** Startup can stall for hours if MCP calls hang.

### 8. Partial failure false positive
**File:** `electron/orchestrator.js:236`

`currentNovelPath = novelPath` is set regardless of whether services succeeded. Next `startAll()` call for the same novel hits the early-return at line 1796 and returns `{status: 'already_running'}` with health details showing stopped services.

**Impact:** User is stuck — cannot trigger a re-start without closing and re-opening the novel.

### 9. `health()` hardcodes 127.0.0.1:8080
**File:** `electron/llm-runtime.js:287`

External health check at line 287: `const apiHealth = await checkHealth('127.0.0.1', 8080)` — ignores configured host/port. Reports `stopped` when server is running on a non-default port.

### 10. LLM starts even when Neo4j/MCP failed
**File:** `electron/orchestrator.js:219-234`

Steps 3 and 4 set `result.neo4j`/`result.mcp` to error status but don't abort. Step 6 runs unconditionally. User sees LLM running but gets no wiki context because Neo4j or MCP are down.

### 11. No orphan MCP process killer
**File:** `electron/orchestrator.js`

Step 1 calls `mcpRuntime.stop()` (tracked process only). There is no `killOrphanedMCP()` equivalent to the `killOrphanedNeo4j()` in Step 2. Previous MCP orphans are never cleaned up.

**Impact:** MCP port conflicts after ungraceful crash.

### 12. Broad `'error'` substring match
**File:** `helper/src/mcp/response-normalizer.js:254`

`textContent.includes('error')` matches any text containing the word "error" (e.g., "no error found", "error handling"). Should use `/\berror\b/i` word-boundary regex.

**Impact:** False-positive error flags on legitimate responses.

### 13. No download progress feedback
**File:** `electron/llm-runtime.js:46-53`

`execSync` pipes stdio but no progress is forwarded to the renderer. UI shows only a static CSS spinner for 1-10 minutes.

**Impact:** Users stare at "Connecting" with no ETA, no byte counter, no way to distinguish slow download from stuck process.

### 14. Connecting state is uncancellable
**File:** `src/components/LlmChatWindow.jsx`

`disabled={servicesLoading}` disables the chat button. No cancel button or abort signal exposed in the UI.

**Impact:** If startup hangs (curl timeout, Neo4j config error, port conflict), the only way out is to kill and relaunch the app.

---

## MEDIUM — Deferred

### 15. Orphan killer sends SIGKILL to any process on ports 7687/7474
**File:** `electron/orchestrator.js:26`

`lsof -ti :7687 -ti :7474` + `process.kill(pid, 'SIGKILL')` — kills any process on those ports without warning.

**Reason:** Intended behavior — Neo4j-specific ports, force kill is by design. Acceptable risk.

---

## LOW — Patch

### 16. Stale Ollama `llm-config.json` breaks new defaults
**File:** `electron/llm-config.js:29-32`

`validateLlmConfig` uses `{...DEFAULT_LLM_CONFIG, ...input}` which keeps old Ollama port (11434) when user has persisted config. New fields (`ngl`, `ctxSize`) are missing.

**Impact:** llama-server starts on wrong port or without GPU acceleration.

### 17. Dead credentials in child-process environment
**File:** `electron/mcp-runtime.js:304-305`

`NEO4J_USER` and `NEO4J_PASSWORD` are passed to the bridge process despite `dbms.security.auth_enabled=false`.

**Impact:** Credentials leak to `ps` output and crash dumps, though currently harmless since auth is disabled.

### 18. Empty `choices` array from llama-server
**File:** `electron/ipc-handlers.js:787`

`const content = parsed.choices?.[0]?.message?.content || ''` — if the model returns `{ choices: [] }`, the entire chain collapses to `''` with no error.

**Impact:** User sees an empty response with no error message.

### 19. No download resume on partial failure
**File:** `electron/llm-runtime.js:46-53`

No `-C -` (resume) flag on the curl command. If download fails mid-way, the partial file is not cleaned up.

**Impact:** Re-download starts from 0 on every retry.

---

## LOW — Deferred

### 20. Hardcoded `/opt/homebrew` paths
**Files:** `electron/neo4j-runtime.js:125`, `electron/llm-config.js:6`

Pinned Homebrew paths (`/opt/homebrew/Cellar/neo4j/2026.06.0/libexec`, `/opt/homebrew/bin/llama-server`) make the app macOS ARM-only.

**Reason:** macOS-only is intentional but undocumented. Should be documented but not blocking.

### 21. Python 3.13 version hardcoded
**File:** `helper/src/mcp/mcp-config.js`

`pythonCommand: 'python3.13'` — fails on systems with Python 3.11/3.12/3.14.

**Reason:** Pre-existing, not introduced by this diff.

### 22. Monolithic `startAll` function
**File:** `electron/orchestrator.js:81-242`

Single 160-line function with six sequential steps, each wrapped in individual try-catch blocks with deeply nested conditionals.

**Reason:** Pre-existing design choice. Hard to test but functional.

### 23. Service status badges disappear after startup
**File:** `src/components/LlmChatWindow.jsx`

`showStartupStatus` is only true during initial `servicesLoading` or non-ok status. Once services appear "ready", badges vanish.

**Reason:** Feature gap, not a bug. Live service monitoring would be a separate feature.

### 24. No GGUF header validation
**File:** `electron/llm-runtime.js`

Only file size is checked (>100MB). No GGUF magic bytes or SHA-256 verification.

**Reason:** Pre-existing, not introduced by this diff.

### 25. No wiki file size/count limit
**File:** `electron/orchestrator.js:36-78`

`findMdFiles` walks entire wiki directory. No limit on file count, individual file size, or total content size.

**Reason:** Unlikely to trigger in practice with typical novel wiki sizes.

### 26. `isWikiRelatedQuery` heuristic removed
**File:** `src/components/LlmChatWindow.jsx`

Old code only queried wiki on keyword match. New code queries on every message when MCP is available.

**Reason:** Intentional change — Synapse determines relevance server-side. 3-minute embedding download timeout on first query is the known trade-off.

---

## Dismissed

| Finding | Reason |
|---------|--------|
| `setTimeoutFn` hangs | Runtime default `setTimeout` used; injected for testing only |
| `servicesStatus` null | Optional chaining short-circuits to `false` — no real issue |
| `startAll` no wait promise | By design — caller polls `status()` for async result |

---

*Generated by bmad-code-review. No code was modified.*
