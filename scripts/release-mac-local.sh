#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_FILE="/tmp/zuojia_packaged_smoke.log"

echo "[1/4] Building renderer..."
npm run build

echo "[2/4] Packaging macOS DMG..."
npm run package:mac

DMG_PATH="$(ls -1t dist/zuojia-v*.dmg 2>/dev/null | head -n 1 || true)"
if [[ -z "$DMG_PATH" ]]; then
  echo "No zuojia-v*.dmg artifact found in dist/."
  exit 1
fi

APP_BIN="dist/mac-arm64/作家.app/Contents/MacOS/作家"
if [[ ! -x "$APP_BIN" ]]; then
  echo "Packaged app binary missing at $APP_BIN"
  exit 1
fi

echo "[3/4] Smoke testing packaged app startup..."
ELECTRON_ENABLE_LOGGING=1 ELECTRON_ENABLE_STACK_DUMPING=1 "$APP_BIN" >"$LOG_FILE" 2>&1 &
APP_PID=$!
sleep 8
kill "$APP_PID" >/dev/null 2>&1 || true

if grep -E "ERR_FILE_NOT_FOUND|Failed to load URL|Cannot find module|preload" "$LOG_FILE" >/dev/null 2>&1; then
  echo "Packaged smoke test failed. See $LOG_FILE"
  tail -n 120 "$LOG_FILE"
  exit 1
fi

echo "[4/4] Writing checksum..."
DMG_NAME="$(basename "$DMG_PATH")"
(
  cd dist
  shasum -a 256 "$DMG_NAME" > "$DMG_NAME.sha256"
)

echo "Local mac release artifact is ready:"
echo "- DMG: $DMG_PATH"
echo "- SHA256: dist/$DMG_NAME.sha256"
echo "- Smoke log: $LOG_FILE"
