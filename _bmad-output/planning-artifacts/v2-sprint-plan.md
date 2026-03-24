# V2 Sprint Plan

**Last Updated:** 2026-03-24  
**Release Theme:** Distribution Release  
**Target Outcome:** A signed, installable macOS app that supports safe solo writing workflows and PDF export.

## Planning Assumptions

- Sprint cadence: 1 week per sprint
- Scope baseline: roadmap issues #62 through #67
- Explicitly out of scope for V2: #68 Pull conflict resolution, #69 Plugin system
- Sequence optimizes for release risk first: packaging, installability, trust, export, hardening
- If a sprint overruns, lower-priority polish/testing expansion moves right before core release capabilities do

## V2 Release Definition

V2 ships when a user can:

- Download and install the app from a macOS DMG
- Launch the app outside the dev environment
- Create/open a project and write safely
- Create backups, commit, and push without terminal work
- Export a manuscript to PDF
- Recover from common operational failures with actionable diagnostics

## Sprint Overview

| Sprint | Theme | Primary Issues | Main Outcome |
|--------|-------|----------------|--------------|
| Sprint 1 | Packaging Baseline | #62 | Local packaged app and DMG build path works |
| Sprint 2 | macOS Distribution | #63 | Signed/notarized DMG and first-run install confidence |
| Sprint 3 | Trusted Solo Workflow | #64, #65 | In-app backup, commit, push, recovery, git settings |
| Sprint 4 | PDF Export | #66 | Production PDF export flow with diagnostics |
| Sprint 5 | Release Hardening | #67 | Performance, test gates, RC validation, release readiness |

## Sprint 1: Packaging Baseline

**Primary issue:** #62  
**Goal:** Prove the app can be built and launched as a packaged macOS application.

### Scope

- Validate/fix Electron production packaging path
- Confirm renderer, preload, and IPC behavior in packaged mode
- Configure electron-builder for local `.dmg` and `.zip` generation
- Produce local build artifacts with stable naming/versioning
- Document the local packaging command and expected outputs

### Target Stories

- 9.1 Electron App Scaffold
- 9.2 electron-builder Configuration
- 9.3 Renderer & Helper Integration
- 9.4 macOS Installer (local packaging path only)

### Exit Criteria

- `npm run pack` or equivalent produces local macOS artifacts
- Packaged app launches from `/Applications`
- No production-only preload, asset, or IPC breakage remains
- Local DMG contains app bundle and Applications shortcut

### Risks

- Production path resolution
- Missing Electron builder config details
- Preload / IPC breakage only visible outside dev

## Sprint 2: macOS Distribution

**Primary issue:** #63  
**Goal:** Turn the local package into a distributable macOS installer.

### Scope

- Developer ID signing setup
- Notarization and stapling
- DMG branding/assets polish
- Release build automation (manual script or CI)
- First-run dependency guidance where installability depends on external tools

### Target Stories

- 9.4 macOS Installer (signing + notarization)
- 8.3 App Initialization (dependency guidance for first launch)
- Selected 10.3 error-message work for startup/install failures

### Exit Criteria

- Signed `.app`, notarized `.dmg`, and `.zip` are produced
- Gatekeeper-safe launch on a clean macOS machine
- Release build process is documented and repeatable

### Risks

- Apple signing/notarization setup friction
- Secrets management for CI/notarization
- Fresh-machine launch edge cases

## Sprint 3: Trusted Solo Workflow

**Primary issues:** #64, #65  
**Goal:** Make the app trustworthy for daily solo writing and recovery.

### Scope

- Snapshot/local backup flow
- Manual commit dialog
- Push to remote flow
- Git configuration UI
- Diagnostics surface for logs, dependencies, and index state
- Backup restore and index rebuild

### Target Stories

- 4.1 Snapshot (Local Backup)
- 4.2 Commit (Stage & Track)
- 4.3 Push (Send to Remote)
- 4.5 Git Configuration
- 7.1 Diagnostics Panel
- 7.2 Backup & Restore
- 7.3 Index Rebuild

### Exit Criteria

- Users can snapshot, commit, push, and restore without terminal work
- Git configuration persists across restarts
- Diagnostics surface the information needed to troubleshoot failures
- No silent failure path remains in supported backup/commit/push flows

### Risks

- Data integrity during backup/restore
- SSH/git environment variability across machines
- UI complexity if commit selection and diagnostics are both underbuilt

## Sprint 4: PDF Export

**Primary issue:** #66  
**Goal:** Let authors export a shareable PDF with enough control and diagnostics to support real use.

### Scope

- Export dialog and PDF export command path
- Metadata entry
- Chapter ordering and selection
- Dependency validation and install guidance
- Export logs surfaced for troubleshooting

### Target Stories

- 5.1 Manuscript to PDF Export
- 5.2 Metadata & Chapter Ordering
- 5.3 Export Validation & Logs

### Exit Criteria

- Users can export a manuscript to PDF from the app
- Metadata is included and chapter ordering is controllable
- Missing Pandoc/TeX dependencies produce actionable guidance
- Failed exports are diagnosable through logs

### Risks

- Pandoc/TeX support complexity
- Styling/template scope creep
- Export failure messaging quality

## Sprint 5: Release Hardening

**Primary issue:** #67  
**Goal:** Convert the implemented V2 scope into a release candidate and shipping build.

### Scope

- Startup performance measurement/fixes
- Editor responsiveness pass
- Error and toast polish
- Targeted unit, integration, and E2E coverage for V2-critical flows
- RC checklist and release validation

### Target Stories

- 10.1 Startup Performance
- 10.2 Editor Responsiveness
- 10.3 Error Messages & Toasts
- 11.1 Helper Unit Tests (release-critical areas)
- 11.2 Component & Hook Tests (release-critical areas)
- 11.3 End-to-End Tests (release-critical flows)

### Exit Criteria

- Install, launch, write, backup, commit, push, and export are validated
- No open P1 defects remain
- Release candidate passes checklist on packaged build
- Release notes and artifact process are ready

### Risks

- Late discovery of packaging-only regressions
- Insufficient E2E coverage on critical flows
- Performance issues in packaged build rather than dev mode

## Priority Order If Capacity Shrinks

Protect these first:

1. Sprint 1 packaging baseline
2. Sprint 2 signed/notarized macOS distribution
3. Sprint 3 trusted solo workflow
4. Sprint 4 core PDF export
5. Sprint 5 release hardening

Trim these before core release capability:

1. Non-essential visual polish
2. Broader editor preference work
3. Additional testing beyond release-critical flows
4. Nice-to-have diagnostics enhancements that do not affect recovery or supportability

## GitHub Mapping

- #62: Sprint 1 owner issue
- #63: Sprint 2 owner issue
- #64: Sprint 3 owner issue (workflow)
- #65: Sprint 3 supporting issue (diagnostics/recovery)
- #66: Sprint 4 owner issue
- #67: Sprint 5 owner issue
- #68: Deferred to V3
- #69: Deferred to V3

## Suggested Execution Order

1. Finish Sprint 1 and prove packaged build viability before starting signing work
2. Finish Sprint 2 before expanding workflow/export surface area
3. Complete Sprint 3 before Sprint 4 closes, because export without trust/recovery weakens release value
4. Reserve Sprint 5 for stabilization, not feature invention

## Release Gate

Do not call V2 complete until all of the following are true:

- Signed/notarized DMG exists
- Packaged app launches cleanly on macOS
- Trusted solo workflow is usable end-to-end
- PDF export is usable end-to-end
- Release-critical tests pass
- Outstanding V2 issues are either closed or explicitly re-cut