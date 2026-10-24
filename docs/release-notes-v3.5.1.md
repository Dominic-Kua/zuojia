# Release Notes: v3.5.1

## Summary

Version 3.5.1 improves Neo4j discovery for macOS installations outside Homebrew.

## Highlights

- Detect a Neo4j server in the `/Applications/Neo4j.app` bundle.
- Search Neo4j install directories under the current user's Application Support folder.
- Use macOS Spotlight as a final fallback after standard path lookup.

## Validation

- Focused Neo4j path-resolution tests cover Homebrew, app-bundle, user-level, PATH, and Spotlight discovery.
