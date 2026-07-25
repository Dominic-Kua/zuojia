# MCP Client Implementation Plan

## Current State

The MCP client architecture is **fully implemented** and operational. This document now serves as a reference for the implemented architecture and future enhancements.

### Implemented Components

| Component | File | Status |
|-----------|------|--------|
| JSON-RPC Transport | `helper/src/mcp/mcp-transport.js` | ✅ Complete |
| MCP Client Core | `helper/src/mcp/mcp-client.js` | ✅ Complete |
| Tool Name Mapping | `helper/src/mcp/tool-mapper.js` | ✅ Complete |
| Argument Transformation | `helper/src/mcp/argument-transformer.js` | ✅ Complete |
| Response Normalization | `helper/src/mcp/response-normalizer.js` | ✅ Complete |
| MCP Runtime Manager | `electron/mcp-runtime.js` | ✅ Complete |
| Python Bridge | `helper/src/mcp/project-synapse-bridge.py` | ✅ Complete |
| Orchestrator | `electron/orchestrator.js` | ✅ Complete |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Electron App (Node.js)                                  │
│  ├── mcp-runtime.js         MCP lifecycle management     │
│  ├── mcp-client.js          JSON-RPC client              │
│  ├── mcp-transport.js       stdio transport              │
│  ├── tool-mapper.js         Zuojia ↔ Synapse mapping     │
│  ├── argument-transformer.js  Argument transforms        │
│  └── response-normalizer.js   Response normalization     │
│                          │                               │
│                     stdio JSON-RPC                        │
│                          ▼                               │
│  project-synapse-bridge.py   Python proxy                │
│  └── uv run python -m synapse_mcp.server                │
│       └── Project Synapse (FastMCP)                      │
│            └── Neo4j driver → bolt://localhost:7687/wiki │
└─────────────────────────────────────────────────────────┘
```

---

## Tool Mapping Reference

### Zuojia → Project Synapse

| Zuojia Tool              | Project Synapse Tool      | Status    | Notes                          |
|--------------------------|---------------------------|-----------|--------------------------------|
| `wiki_list_pages`        | `wiki_list_pages`         | ✅ Direct | Same name                      |
| `wiki_search`            | `wiki_search`             | ✅ Direct | Same name                      |
| `wiki_get_page`          | `wiki_read_page`          | ✅ Mapped | `slug` → `path` transform      |
| `wiki_get_backlinks`     | —                         | ⚠️ Local  | Falls back to `wiki-tools.js`  |
| `wiki_build_graph`       | —                         | ⚠️ Local  | Falls back to `wiki-tools.js`  |
| `wiki_traverse_graph`    | `explore_connections`     | ✅ Mapped | Partial match                  |
| `wiki_neo4j_search`      | `query_knowledge`         | ✅ Mapped | Fulltext BM25 search           |
| `wiki_neo4j_get_related` | `explore_connections`     | ✅ Mapped | Partial match                  |
| `wiki_neo4j_find_paths`  | `explore_connections`     | ✅ Mapped | Partial match                  |
| `wiki_neo4j_query`       | —                         | ⚠️ Local  | Falls back to direct Neo4j     |
| `ingest_text`            | `ingest_text`             | ✅ Direct | Wiki ingestion into graph      |

### Response Normalization

The response normalizer (`response-normalizer.js`) handles:

- `query_knowledge` → normalizes to `{ status, results: [...] }`
- `ingest_text` → normalizes to `{ status: 'ok', data: { entities, facts } }`
- `wiki_*` tools → normalizes to `{ status, data, pages }` envelope
- Error detection: Synapse error text (`❌`, `Knowledge query failed`) → `status: 'error'`

---

## Environment Variables

The bridge script (`project-synapse-bridge.py`) receives these env vars from `mcp-runtime.js`:

| Variable           | Default Value                | Description                    |
|--------------------|------------------------------|--------------------------------|
| `ZUOJIA_NOVEL_PATH`| (current novel path)         | Novel root directory           |
| `NEO4J_URI`        | `bolt://localhost:7687`      | Neo4j bolt endpoint            |
| `NEO4J_USER`       | `neo4j`                      | Neo4j username (unused, auth disabled) |
| `NEO4J_PASSWORD`   | `neo4j`                      | Neo4j password (unused, auth disabled) |
| `NEO4J_DATABASE`   | `wiki`                       | Target database name           |

---

## Configuration

MCP client configuration in `helper/src/mcp/mcp-config.js`:

```js
{
  process: {
    pythonCommand: 'python3.13',
    serverPath: 'helper/src/mcp/project-synapse-bridge.py',
  },
  mcpClient: {
    maxRetries: 3,
    retryBaseDelay: 1000,
    maxRetryDelay: 10000,
    callToolTimeoutMs: 180000,   // 3 min (embedding model download)
    initializeTimeoutMs: 120000, // 2 min (embedding model download)
  },
  synapse: {
    enabled: true,
    fallbackToLocal: true,
    maxReconnectAttempts: 5,
  },
}
```

### Tool-Specific Timeouts

| Tool                  | Timeout (ms) | Reason                     |
|-----------------------|-------------|----------------------------|
| `wiki_neo4j_search`   | 180000      | Embedding model download   |
| `wiki_neo4j_*`        | 30000       | Graph traversal            |
| `wiki_*` (local)      | 5000        | File I/O                   |
| `wiki_build_graph`    | 10000       | Graph construction         |

---

## Error Handling Strategy

**Implemented:** Option B — Warning with fallback

- When Synapse tool fails, a warning is logged
- The system falls back to local implementations where available
- `query_knowledge` failures trigger automatic fallback to `wiki_search`
- The LLM Chat button shows connection status during startup

---

## Known Limitations

1. **`wiki_get_backlinks`** — No Synapse equivalent; uses local wiki-tools.js
2. **`wiki_build_graph`** — No Synapse equivalent; uses local wiki-tools.js
3. **`wiki_neo4j_query`** — No Synapse equivalent; would need direct Cypher passthrough
4. **Embedding model download** — First `query_knowledge` call may take 2-3 minutes while the embedding model downloads

---

## Future Enhancements

### Potential Improvements

1. **Direct Cypher passthrough** — Map `wiki_neo4j_query` to a Synapse tool that executes raw Cypher
2. **Connection pooling** — Reuse MCP connections across tool calls instead of per-call
3. **Caching** — Cache `wiki_list_pages` and `wiki_search` results
4. **Streaming responses** — Stream LLM responses instead of waiting for full completion
5. **Embedding caching** — Cache embeddings to avoid re-computation on repeat queries

### Neo4j 2026 Compatibility Notes

- Fulltext indexes use `CREATE FULLTEXT INDEX` DDL, not `CALL db.index.fulltext.createNodeIndex()`
- Config uses `server.*` properties, not `dbms.*`
- `neo4j console` accepts no CLI flags — config is via `NEO4J_CONF` env var
- Auth is disabled (`dbms.security.auth_enabled=false`); driver connects with `neo4j.auth.none()`
