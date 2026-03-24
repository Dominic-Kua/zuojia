#!/usr/bin/env bash

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install it first: brew install gh" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

owner_repo="Dominic-Kua/zuojia"

create_issue() {
  local title="$1"
  local body="$2"

  gh issue create \
    --repo "$owner_repo" \
    --title "$title" \
    --body "$body"
}

create_issue \
  "V2: Packaging baseline" \
  "## Goal
Produce a local macOS package that runs outside the dev environment and is the base for distribution.

## Why
V2 is the distribution release. Before signing/notarization, the app needs a stable packaged build path for Electron + renderer + preload + IPC.

## In scope
- Validate/fix Electron app scaffold for production packaging
- Configure electron-builder for macOS packaging
- Produce local \\.dmg and \\.zip artifacts
- Verify packaged app launches from /Applications
- Lock artifact naming/versioning conventions

## Source stories
- 9.1 Electron App Scaffold
- 9.2 electron-builder Configuration
- 9.4 macOS Installer (local packaging path first)

## Acceptance criteria
- [ ] A build command produces macOS artifacts locally
- [ ] Packaged app launches outside dev mode
- [ ] Preload, IPC, and asset paths work in packaged build
- [ ] DMG contains an app bundle and Applications shortcut
- [ ] Packaging steps are documented for maintainers

## Notes
This issue is the prerequisite for notarization/release automation." 

create_issue \
  "V2: Signed and notarized macOS distribution" \
  "## Goal
Ship a standard macOS installer that passes Gatekeeper and can be distributed to end users.

## Why
Packaging alone is not enough for a real Mac release. V2 requires a DMG users can install without workaround prompts.

## In scope
- Apple Developer ID signing setup
- Notarization and ticket stapling
- Final DMG branding/assets
- CI or scripted build pipeline for signed releases
- Release artifact publishing process

## Source stories
- 9.4 macOS Installer (DMG + Notarization)

## Acceptance criteria
- [ ] Signed \\.app is produced from release build
- [ ] Notarized \\.dmg and \\.zip are generated
- [ ] Gatekeeper does not block first launch on a clean Mac
- [ ] DMG includes Applications symlink and branded assets
- [ ] Build/notarization secrets and process are documented
- [ ] Release artifacts can be attached to GitHub Releases

## Notes
This can be split further later if Apple signing setup and CI automation need separate execution tickets." 

create_issue \
  "V2: Trusted solo workflow (snapshot, commit, push, git config)" \
  "## Goal
Make the app trustworthy for day-to-day solo writing by giving users safe backup and outbound sync basics.

## Why
For V2, users need confidence that work can be snapshotted, committed, and pushed without leaving the app. Advanced merge conflict handling is explicitly out of scope for this release.

## In scope
- Snapshot/local backup creation
- Manual commit dialog and explicit commit messages
- Push to configured remote
- Git settings UI/configuration
- Safe pre-commit or pre-push backup behavior where applicable

## Source stories
- 4.1 Snapshot (Local Backup)
- 4.2 Commit (Stage & Track)
- 4.3 Push (Send to Remote)
- 4.5 Git Configuration

## Acceptance criteria
- [ ] Users can create a named snapshot from the app
- [ ] Users can create a manual commit with explicit file selection/message
- [ ] Users can push from the app with actionable failure messages
- [ ] Git settings persist across restart
- [ ] No silent failure path exists in snapshot/commit/push flow

## Out of scope
- Pull conflict resolution UI
- Multi-user merge workflows" 

create_issue \
  "V2: Diagnostics and recovery" \
  "## Goal
Give users and maintainers enough visibility and recovery tooling to safely support a distributed release.

## Why
Distribution without recovery creates support and data-loss risk. Diagnostics are part of the trust model for V2.

## In scope
- Diagnostics panel
- Backup listing and restore flow
- Index rebuild tooling
- Log viewing for export/git/index issues

## Source stories
- 7.1 Diagnostics Panel
- 7.2 Backup & Restore
- 7.3 Index Rebuild

## Acceptance criteria
- [ ] Diagnostics UI shows logs, backups, index status, and dependency checks
- [ ] Users can restore from a snapshot with a clear confirmation flow
- [ ] Users can rebuild index from disk and refresh sidebar state
- [ ] Recovery actions are surfaced with clear success/failure messages

## Notes
This issue pairs with the trusted solo workflow issue and should be planned alongside it." 

create_issue \
  "V2: PDF export" \
  "## Goal
Let authors export a publication-ready PDF with metadata and chapter ordering controls.

## Why
PDF export is in scope for V2 and is one of the clearest user-facing outcomes of the release.

## In scope
- Export dialog
- PDF generation pipeline
- Metadata entry
- Chapter ordering/selection
- Dependency validation and install guidance
- Export logs for support/debugging

## Source stories
- 5.1 Manuscript to PDF Export
- 5.2 Metadata & Chapter Ordering
- 5.3 Export Validation & Logs

## Acceptance criteria
- [ ] Users can export a manuscript to PDF from the app
- [ ] Export supports title/author/date metadata
- [ ] Chapter order can be reviewed and adjusted before export
- [ ] Missing Pandoc/TeX dependencies produce actionable guidance
- [ ] Export stdout/stderr and timing are logged
- [ ] Failed exports are diagnosable without inspecting raw code

## Notes
If TeX styling becomes a bottleneck, template customization can be split out later without dropping core PDF export." 

create_issue \
  "V2: Release hardening" \
  "## Goal
Stabilize the packaged app enough for an external V2 release.

## Why
Release quality depends on startup, typing responsiveness, understandable failures, and targeted test coverage around critical workflows.

## In scope
- Startup performance pass
- Editor responsiveness pass
- User-facing error/toast cleanup
- Release-critical unit/component/E2E coverage
- Release checklist / RC validation

## Source stories
- 10.1 Startup Performance (<5s)
- 10.2 Editor Responsiveness (<100ms)
- 10.3 Error Messages & Toasts
- 11.1 Helper Unit Tests
- 11.2 Component & Hook Tests
- 11.3 End-to-End Tests
- 8.3 App Initialization (first-run dependency checks)

## Acceptance criteria
- [ ] Install, launch, write, save, backup, push, and export flows are covered by targeted test coverage
- [ ] Startup and typing performance are measured in packaged builds
- [ ] Critical user-facing errors are actionable and non-technical
- [ ] First-run checks guide users through missing dependencies
- [ ] Release checklist exists and is used against an RC build

## Notes
This is the final gate before publishing the V2 release." 

create_issue \
  "V3: Pull conflict resolution" \
  "## Goal
Support inbound sync and safe conflict resolution for multi-machine or collaborative workflows.

## Why
Conflict handling increases UX and data-integrity complexity. It is intentionally deferred until after the V2 distribution release.

## In scope
- Pull flow from remote
- Conflict detection per chapter/file
- Conflict resolution UI
- Post-resolution staging/commit flow
- Preservation of pre-merge backups

## Source story
- 4.4 Pull with Conflict Detection

## Acceptance criteria
- [ ] Users can pull from configured remotes in-app
- [ ] Conflicts are detected and surfaced clearly
- [ ] Users can choose local/remote/manual resolution paths
- [ ] Conflict resolution preserves backups and creates a clear merge commit trail

## Notes
This remains explicitly out of scope for V2." 

create_issue \
  "V3: Plugin system" \
  "## Goal
Add a safe extensibility model for commands, UI extensions, and content-processing plugins.

## Why
Plugins increase product surface area, security requirements, and API stability obligations. They are better introduced after the distribution release is proven.

## In scope
- Manifest-driven plugin loading
- Permission model and validation
- Editor/command extension points
- Content pipeline APIs
- Safe isolation/sandbox boundaries

## Source stories
- 12.1 Plugin Manifest & Loading
- 12.2 Editor Extension Points
- 12.3 Content Pipelines

## Acceptance criteria
- [ ] Plugin manifest schema is defined and validated
- [ ] Plugins load from a defined location with explicit permissions
- [ ] Extension points exist for commands/UI/content transforms
- [ ] Host app protects filesystem and IPC access behind permission gates
- [ ] Failures are diagnosable through logs/diagnostics

## Notes
Keep this out of V2 unless distribution scope is materially reduced." 

echo "Created roadmap issues in ${owner_repo}."