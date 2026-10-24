# Release Notes: v3.5.2

## Summary

Version 3.5.2 restores regression coverage for the optional local LLM runtime and configuration.

## Highlights

- Re-enabled LLM runtime tests for startup, health, stop, and missing-executable behavior.
- Updated configuration tests to validate current settings, persistence, and recovery from invalid saved configuration.

## Validation

- Unit suite: 760 passed, 2 environment-dependent integration tests skipped.
- macOS DMG build and packaged-app smoke checks passed.
