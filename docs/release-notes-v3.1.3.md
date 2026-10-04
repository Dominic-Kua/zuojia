# Release Notes: v3.1.3 (unreleased)

## Summary

Security hardening pass focused on the shared-novel threat model: novels exchanged over git can carry hostile content, and the app now treats that content as untrusted.

## Highlights

### Git remote trust (first-stage fix)
- `ext::` and `fd::` remote URLs rejected before any git subprocess runs (these transports execute arbitrary commands — previously reachable by opening a shared novel and hitting Push).
- Branch names validated against the charset real branch names use; `--` separators added to push/ls-remote invocations (blocks `--upload-pack=` option injection).
- Push trust-on-first-use: the first push to an unconfirmed remote shows a confirmation dialog naming the exact URL and branch; confirmations are recorded per-novel outside the novel directory.

### Wiki embed path traversal
- Embed filenames (`![[…]]`, `[[File:…]]`) are now validated per-segment: traversal (`..`), absolute paths, and encoded variants are refused and render a blocked placeholder instead of an image.
- Remote embeds pass through with `referrerpolicy="no-referrer"`.

### Symlink containment
- Novel validation rejects symlinked `manuscript`/`wiki`/`meta` directories.
- Chapter and wiki CRUD resolve through symlinks and verify containment (a symlinked `wiki/sub -> ~/.ssh` can no longer be read via slug `sub/…`).
- Index rebuild, word counts, spellcheck dictionary, MCP wiki tools, and snapshot copy/size skip symlinked entries.

## Validation

- Helper: 312 passed (incl. new path-guard, symlink-hardening, git trust-hardening suites).
- Unit + integration: 651 passed, 11 skipped.
- E2E: all 15 spec files pass (incl. new `wiki-embeds.spec.js` with real image fixtures).
