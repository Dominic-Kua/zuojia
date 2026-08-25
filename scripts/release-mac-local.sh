#!/usr/bin/env bash
set -euo pipefail

# Load environment variables from .env file if present (must be placed in root
# directory). Sourced without `set -a` so secrets are not auto-exported to every
# child process; only explicitly needed vars are exported below.
if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  # shellcheck disable=SC1091
  source .env || true
else
  echo "No .env file found; continuing without it."
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_FILE="/tmp/zuojia_packaged_smoke.log"
DMG_SMOKE_LOG="/tmp/zuojia_dmg_smoke.log"

run_playwright_smoke() {
  local output_path="$1"

  ZUOJIA_RENDERER_MODE=production node --input-type=module - <<'NODE' >"$output_path" 2>&1
import { _electron as electron } from 'playwright';

const executablePath = process.env.ZUOJIA_SMOKE_EXECUTABLE;
const app = await electron.launch({ executablePath });
const page = await app.firstWindow();
await page.waitForSelector('[data-testid="new-novel-button"]', { timeout: 20000 });
await page.waitForSelector('text=Recent novels', { timeout: 20000 });
console.log('SMOKE_OK');
await app.close();
NODE
}

echo "[1/5] Building renderer..."
# Export NEO4J_PASSWORD so it's available during the build process if needed by the source code
export NEO4J_PASSWORD
npm run build

echo "[2/5] Packaging macOS DMG..."
PACKAGE_START_TS="$(date +%s)"
ZUOJIA_RENDERER_MODE=production npm run package:mac

DMG_PATH="$(ls -1t dist/zuojia-v*.dmg 2>/dev/null | head -n 1 || true)"
if [[ -z "$DMG_PATH" ]]; then
  echo "No zuojia-v*.dmg artifact found in dist/."
  exit 1
fi

# Guard against picking up a stale DMG: the chosen artifact must be newer than
# the moment packaging started.
DMG_MTIME="$(stat -f %m "$DMG_PATH")"
if (( DMG_MTIME < PACKAGE_START_TS )); then
  echo "Newest DMG ($DMG_PATH) predates this packaging run — stale artifact. Aborting."
  exit 1
fi

APP_BIN="dist/mac-arm64/作家.app/Contents/MacOS/作家"
if [[ ! -x "$APP_BIN" ]]; then
  echo "Packaged app binary missing at $APP_BIN"
  exit 1
fi

echo "[3/5] Smoke testing packaged app bundle UI..."
ZUOJIA_SMOKE_EXECUTABLE="$APP_BIN" run_playwright_smoke "$LOG_FILE"
if ! grep -q "SMOKE_OK" "$LOG_FILE"; then
  echo "Packaged app bundle smoke test failed. See $LOG_FILE"
  tail -n 120 "$LOG_FILE"
  exit 1
fi

echo "[4/5] Smoke testing mounted DMG artifact UI..."
MOUNT_POINT=""
cleanup_mount() {
  if [[ -n "$MOUNT_POINT" ]]; then
    hdiutil detach "$MOUNT_POINT" >/dev/null 2>&1 || true
  fi
}
trap cleanup_mount EXIT

MOUNT_POINT="$(hdiutil attach "$DMG_PATH" -nobrowse | awk '/\/Volumes\// {print substr($0,index($0,"/Volumes/")); exit}')"
if [[ -z "$MOUNT_POINT" ]]; then
  echo "Failed to mount DMG artifact for smoke test"
  exit 1
fi

MOUNTED_APP_PATH="$(find "$MOUNT_POINT" -maxdepth 2 -name '*.app' | head -n 1 || true)"
if [[ -z "$MOUNTED_APP_PATH" ]]; then
  echo "No .app bundle found inside mounted DMG at $MOUNT_POINT"
  exit 1
fi

MOUNTED_EXE="$MOUNTED_APP_PATH/Contents/MacOS/$(basename "$MOUNTED_APP_PATH" .app)"
if [[ ! -x "$MOUNTED_EXE" ]]; then
  echo "Mounted app executable missing at $MOUNTED_EXE"
  exit 1
fi

ZUOJIA_SMOKE_EXECUTABLE="$MOUNTED_EXE" run_playwright_smoke "$DMG_SMOKE_LOG"
if ! grep -q "SMOKE_OK" "$DMG_SMOKE_LOG"; then
  echo "Mounted DMG artifact smoke test failed. See $DMG_SMOKE_LOG"
  tail -n 120 "$DMG_SMOKE_LOG"
  exit 1
fi

cleanup_mount
trap - EXIT

echo "[5/5] Writing checksum..."
DMG_NAME="$(basename "$DMG_PATH")"
(
  cd dist
  shasum -a 256 "$DMG_NAME" > "$DMG_NAME.sha256"
)

echo "Local mac release artifact is ready:"
echo "- DMG: $DMG_PATH"
echo "- SHA256: dist/$DMG_NAME.sha256"
echo "- Bundle smoke log: $LOG_FILE"
echo "- DMG smoke log: $DMG_SMOKE_LOG"

