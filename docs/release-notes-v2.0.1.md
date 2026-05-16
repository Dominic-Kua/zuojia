# Release Notes: v2.0.1

## Summary

Version 2.0.1 focuses on release stability and packaging correctness for macOS artifacts.

## Highlights

- Fixed packaged startup regressions that could produce a blank app after installation.
- Restored release branding assets, including app name `作家` and icon in packaged outputs.
- Ensured release/test paths run in production renderer mode, while dev commands stay in development mode.
- Hardened local release workflow to validate the actual install artifact before publish.

## Release Validation Flow

Use the local release pipeline before publishing:

```bash
npm run release:mac:local
```

This workflow now:

1. Builds the renderer.
2. Packages the macOS DMG.
3. Smoke-tests the packaged `.app` bundle UI.
4. Mounts the DMG and smoke-tests the app inside the mounted artifact.
5. Writes a SHA-256 checksum file for the DMG.

## Produced Artifacts

- DMG: `dist/zuojia-v<version>-arm64.dmg`
- Checksum: `dist/zuojia-v<version>-arm64.dmg.sha256`
- Bundle smoke log: `/tmp/zuojia_packaged_smoke.log`
- DMG smoke log: `/tmp/zuojia_dmg_smoke.log`

## Notes

These changes are intended to prevent publishing unusable installers by validating the release artifact itself (not only the unpacked build output).
