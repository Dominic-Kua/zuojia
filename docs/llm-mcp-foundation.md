# LLM + MCP Foundation

This document defines the local AI foundation for 作家, covering the LLM runtime, knowledge graph, MCP bridge, and orchestrator startup sequence.

## Model Selection

Canonical model: `unsloth/gemma-4-E2B-it-GGUF` (Q3_K_S quantization)

- File: `gemma-4-E2B-it-Q3_K_S.gguf`
- Size: ~2.3 GB
- Source URL: `https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q3_K_S.gguf`
- Local path: `~/.zuojia/models/gemma-4-E2B-it-Q3_K_S.gguf`

The GGUF is downloaded automatically on first launch via `curl` (the `hf download` command is not used due to hanging issues).

## LLM Runtime

Runtime: `llama-server` (llama.cpp) via Homebrew at `/opt/homebrew/bin/llama-server`

Configuration stored in `~/Library/Application Support/作家/llm-config.json`:

| Setting       | Default Value                                          |
|---------------|--------------------------------------------------------|
| provider      | `llamacpp`                                             |
| executablePath| `/opt/homebrew/bin/llama-server`                       |
| modelName     | `gemma-4-E2B-it-Q3_K_S`                               |
| host          | `127.0.0.1`                                            |
| port          | `8080`                                                 |
| ngl           | `99` (all layers GPU)                                  |
| ctxSize       | `0` (use model default)                                |
| temperature   | `0.7`                                                  |
| maxTokens     | `4096`                                                 |

The `llm-runtime.js` module manages the lifecycle:

1. `ensureModel()` — Downloads the GGUF via `curl -L` if missing or corrupt (files <100MB are auto re-downloaded)
2. `start()` — Spawns `llama-server -m <model> --host 127.0.0.1 --port 8080 -ngl 99`, polls `/health` until ready (max 60s)
3. `stop()` — Sends SIGTERM, waits 2s, then SIGKILL

Chat uses the OpenAI-compatible API at `http://127.0.0.1:8080/v1/chat/completions` with `Authorization: Bearer no-key`.

## Neo4j Knowledge Graph

Neo4j version: **2026.06.0** (Homebrew at `/opt/homebrew/Cellar/neo4j/2026.06.0/libexec`)

### Per-Novel Storage

Each novel gets its own Neo4j data directory and config:

```
<novelPath>/.zuojia/neo4j-data/     # Database files
<novelPath>/.zuojia/neo4j.conf      # Neo4j configuration
```

### Configuration

Neo4j config uses the `server.*` property names (Neo4j 2026 syntax):

```properties
server.memory.heap.initial_size=512m
server.memory.heap.max_size=1g
server.memory.pagecache.size=512m
server.directories.data=<novelPath>/.zuojia/neo4j-data
server.directories.import=<novelPath>/wiki
initial.dbms.default_database=wiki
dbms.security.auth_enabled=false
```

- Auth is **disabled** (`dbms.security.auth_enabled=false`). The driver connects with `neo4j.auth.none()`.
- Database name is `wiki` (not the default `neo4j`).
- `NEO4J_CONF` env var points to the directory containing `neo4j.conf`.
- `NEO4J_HOME` env var points to the Neo4j installation directory.
- `neo4j console` accepts **no CLI flags** — config is read from the `NEO4J_CONF` directory.

### Schema Initialization

Project Synapse creates the schema on connect. The following indexes are created:

**Constraints:**
- `entity_id_unique` — `Entity.id` uniqueness
- `fact_id_unique` — `Fact.id` uniqueness
- `zettel_id_unique` — `Zettel.id` uniqueness

**Property indexes:**
- `entity_name_index` — `Entity.name`
- `fact_source_index` — `Fact.source`
- `zettel_topic_index` — `Zettel.topic`

**Vector indexes** (for ANN semantic search):
- `entity_embedding` — cosine similarity on `Entity.embedding`
- `fact_embedding` — cosine similarity on `Fact.embedding`
- `zettel_embedding` — cosine similarity on `Zettel.embedding`

**Fulltext indexes** (for BM25 keyword search):
- `entity_fulltext` — on `Entity.name`, `Entity.type`
- `fact_fulltext` — on `Fact.content`

Fulltext indexes use the Neo4j 5.x+ DDL syntax:

```cypher
CREATE FULLTEXT INDEX fact_fulltext IF NOT EXISTS
FOR (f:Fact) ON EACH [f.content]
OPTIONS {indexConfig: {`fulltext.analyzer`: 'standard'}}
```

**Important:** The old `CALL db.index.fulltext.createNodeIndex()` procedure does not exist in Neo4j 2026. Use `CREATE FULLTEXT INDEX` DDL instead.

### Orphaned Process Detection

Before starting Neo4j, the orchestrator uses `lsof -ti :7687 -ti :7474` to find and kill any orphaned Neo4j processes. This prevents port conflicts from stale instances.

## MCP Server (Project Synapse)

### Architecture

```
Electron App (Node.js)
  └─ mcp-runtime.js
       └─ project-synapse-bridge.py  (stdio JSON-RPC proxy)
            └─ uv run python -m synapse_mcp.server  (Project Synapse)
                 └─ Neo4j driver → bolt://localhost:7687/wiki
```

The bridge script (`helper/src/mcp/project-synapse-bridge.py`) proxies JSON-RPC messages between the Node.js MCP client and the Project Synapse Python server. It passes through:

- `ZUOJIA_NOVEL_PATH`
- `NEO4J_URI`
- `NEO4J_USER` / `NEO4J_PASSWORD`
- `NEO4J_DATABASE` (set to `wiki` by `mcp-runtime.js`)

### Tool Mapping

Zuojia tool names are mapped to Project Synapse tool names via `helper/src/mcp/tool-mapper.js`:

| Zuojia Tool              | Project Synapse Tool      | Notes                          |
|--------------------------|---------------------------|--------------------------------|
| `wiki_list_pages`        | `wiki_list_pages`         | Direct mapping                 |
| `wiki_search`            | `wiki_search`             | Direct mapping                 |
| `wiki_get_page`          | `wiki_read_page`          | Argument transform: `slug` → `path` |
| `wiki_get_backlinks`     | —                         | Falls back to local wiki       |
| `wiki_build_graph`       | —                         | Falls back to local wiki       |
| `wiki_traverse_graph`    | `explore_connections`     | Partial match                  |
| `wiki_neo4j_search`      | `query_knowledge`         | Fulltext BM25 search           |
| `wiki_neo4j_get_related` | `explore_connections`     | Partial match                  |
| `wiki_neo4j_find_paths`  | `explore_connections`     | Partial match                  |
| `wiki_neo4j_query`       | —                         | Falls back to local Neo4j      |
| `ingest_text`            | `ingest_text`             | Wiki ingestion into graph      |

When a tool maps to `null` (no Synapse equivalent), the MCP runtime falls back to the local wiki implementation in `helper/src/mcp/wiki-tools.js`.

### Response Normalization

`helper/src/mcp/response-normalizer.js` transforms Project Synapse responses back to Zuojia's expected `{ status: 'ok'|'error', data: ..., error: ... }` envelope.

The normalizer detects Synapse error text (`❌`, `Knowledge query failed`) in `query_knowledge` responses and returns `status: 'error'`, which triggers a fallback to basic `wiki_search`.

## Orchestrator Startup Sequence

When a novel is opened, `electron/orchestrator.js` runs a 6-step startup sequence:

```
Step 1: Kill orphaned MCP processes (lsof -ti :3000)
Step 2: Kill orphaned Neo4j processes (lsof -ti :7687 -ti :7474)
Step 3: Start Neo4j
         → Write neo4j.conf to <novel>/.zuojia/
         → Spawn `neo4j console` with NEO4J_CONF and NEO4J_HOME
         → Wait for port 7687 (bolt) to be listening
Step 4: Start MCP (Project Synapse bridge)
         → Spawn bridge.py with NEO4J_DATABASE=wiki
         → Wait for MCP server to initialize
Step 5: Conditionally ingest wiki data
         → Check if Neo4j has Entity nodes (hasWikiData)
         → If empty: read all .md files from wiki/ directory
         → Call Synapse's `ingest_text` for each file
Step 6: Start LLM (llama-server)
         → Download GGUF if missing/corrupt
         → Spawn llama-server
         → Poll /health until ready
```

Steps 3-4 and Step 6 run in parallel where possible. The LLM Chat button shows a "Connecting" overlay during startup and becomes clickable once all services are ready.

### Shutdown

On novel close or switch, the orchestrator stops services in reverse order: LLM → MCP → Neo4j.

## LLM Chat Wiki Integration

When a user sends a message in the LLM Chat window:

1. The renderer calls `helper:llm:chat` with the message
2. IPC handler checks for wiki-related keywords in the message
3. If keywords detected, calls `wiki_neo4j_search` → maps to `query_knowledge` via MCP → Project Synapse
4. Query results are added to the system prompt as wiki context
5. If `query_knowledge` fails (e.g., fulltext index not ready), falls back to `wiki_search` (local text search)

## Requirements

- **macOS** (primary platform)
- **Node.js** and npm
- **Neo4j 2026** (installed via Homebrew: `brew install neo4j`)
- **llama.cpp** (installed via Homebrew: `brew install llama.cpp`)
- **uv** (for Project Synapse: `pip install uv` or `brew install uv`)
- **Project Synapse** at `~/code/project-synapse-mcp` (pre-installed)

## Manual Verification

After implementation, verify the full stack:

1. `npm run dev` — open a novel
2. Check logs for the 6-step startup sequence
3. LLM Chat button shows "Connecting" overlay, then becomes clickable
4. Send a message — response should include wiki context in system prompt
5. Close novel — all services stop (ports 7687, 8080 freed)
