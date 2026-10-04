# Release Notes: v3.1.2

## Summary

Version 3.1.2 adds a master AI on/off switch for writers who want a pure offline writing app.

## Highlights

### AI toggle

- Top-bar `AI On` / `AI Off` switch, on by default (opt-out).
- Switching AI off stops the novel services (Neo4j, MCP/Synapse, LLM runtime) and hides the LLM chat window; switching on starts services again and restores chat.
- Opening a novel with AI off never starts services.
- The preference persists across sessions (`zuojia-ai-enabled`).
- Local writing, wiki, git, and export features are unaffected.

## Validation

- Unit + integration: 633 passed, 11 skipped (includes 4 new AI-toggle tests).
- E2E: all 14 spec files pass (includes new `ai-toggle.spec.js`: default state, off-hides-chat with reload persistence, on-restores).
- Local mac release: `npm run release:mac:local` (build + DMG + bundle/DMG smoke tests + SHA-256).
