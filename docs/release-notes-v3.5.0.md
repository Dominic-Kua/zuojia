# Release Notes: v3.5.0

## Summary

Version 3.5.0 adds automatic seasonal appearance themes and security hardening for shared novels.

## Highlights

### Seasonal Appearance

- Choose light or dark mode and optionally enable automatic seasonal themes from Appearance settings.
- Seasonal accents and top-bar glyphs are selected for Halloween, Christmas, and Lunar New Year, using London calendar dates.
- Seasonal glyph motion respects the system reduced-motion preference.

### Security

- Validate Git remotes and branches to block `ext::` remote execution and `--upload-pack` injection.
- Confirm trust on first use before pushing to a remote.
- Prevent path traversal through wiki embeds and contain file operations when symlinks are present.

## Validation

- Production renderer build and packaged-app UI smoke checks passed for both the `.app` bundle and mounted DMG.
- The release script produced a macOS DMG and SHA-256 checksum.
