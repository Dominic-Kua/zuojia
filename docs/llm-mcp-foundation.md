# LLM + MCP Foundation (v3)

This document defines the initial local AI foundation for 作家.

## Model Selection

Canonical base model:

- `Qwen/Qwen2.5-7B-Instruct`

Recommended llama.cpp GGUF file pattern:

- `qwen2.5-7b-instruct-q4_k_m.gguf`

A common GGUF source repository is:

- `bartowski/Qwen2.5-7B-Instruct-GGUF`

Pinned initial artifact for implementation:

- File: `Qwen2.5-7B-Instruct-Q4_K_M.gguf`
- Source URL: `https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf`
- SHA-256: `65b8fcd92af6b4fefa935c625d1ac27ea29dcb6ee14589c55a8f115ceaaa1423`

Pin an exact file URL and SHA-256 before production use.

## Runtime Direction

- Inference runtime: `llama.cpp`
- Access pattern: local process managed by app runtime
- Data policy: local-first, no automatic cloud upload

## MCP Server (Initial Slice)

A read-only MCP server is provided in helper package:

- Entry: `helper/src/mcp/wiki-server.js`
- Tool logic: `helper/src/mcp/wiki-tools.js`

Current tools:

- `wiki_list_pages`
- `wiki_get_page`
- `wiki_search`
- `wiki_get_backlinks`
- `wiki_build_graph`

## Run Locally

From `helper/`:

```bash
npm install
ZUOJIA_NOVEL_PATH=/absolute/path/to/novel npm run mcp:wiki
```

The server uses stdio transport and is ready for MCP clients.

## Knowledge Graph Strategy

Current graph is lightweight and inferred from wiki links:

- Nodes: wiki pages
- Edges: internal wiki links (`wiki_link`)

Future improvements:

- typed entities (character/place/event)
- evidence spans per edge
- contradiction and timeline checks

## Safety Defaults

- Read-only wiki operations in initial server
- No write-back tools in v1
- Explicit novel path required via `ZUOJIA_NOVEL_PATH`
