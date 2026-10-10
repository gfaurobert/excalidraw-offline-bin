#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART="$ROOT/artifacts/tauri-poc"
mkdir -p "$ART"
FIXTURE="$ROOT/test-fixtures/e2e-export/matrix-demo.excalidraw"
APP="$ROOT/src-tauri/target/release/excalidraw-offline"
APPIMAGE="$ROOT/src-tauri/target/release/bundle/appimage/Excalidraw Offline_0.7.2_amd64.AppImage"

export DISPLAY=:99
pkill -f 'Xvfb :99' 2>/dev/null || true
Xvfb :99 -screen 0 1280x800x24 &
XVFB_PID=$!
sleep 2

cleanup() {
  pkill -f excalidraw-offline 2>/dev/null || true
  kill "$XVFB_PID" 2>/dev/null || true
}
trap cleanup EXIT

"$APP" "$FIXTURE" &
APP_PID=$!
sleep 18

WIN=$(xdotool search --name 'Excalidraw Offline' 2>/dev/null | head -1 || true)
if [[ -n "${WIN:-}" ]]; then
  xdotool windowactivate --sync "$WIN" 2>/dev/null || true
fi
sleep 1
scrot "$ART/01-app-with-drawing.png"

xdotool key alt+f
sleep 1.2
scrot "$ART/03-file-menu.png"

xdotool key Escape
sleep 0.4
xdotool key ctrl+shift+s
sleep 2
scrot "$ART/02-save-dialog.png"
xdotool key Escape 2>/dev/null || true

ps -o rss= -p "$APP_PID" | awk '{print "tauri_idle_rss_kb=" $1}' > "$ART/memory.txt"

kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true

EXPORT_DIR="$ART/cli-export"
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"
"$APP" export "$FIXTURE" --all-frames -d "$EXPORT_DIR" >/dev/null
cp "$EXPORT_DIR"/*.png "$ART/" 2>/dev/null || true

{
  echo "=== Binary sizes (bytes) ==="
  stat -c '%s %n' "$APP" 2>/dev/null || true
  if [[ -f "$APPIMAGE" ]]; then stat -c '%s %n' "$APPIMAGE"; fi
  if [[ -f "$ROOT/dist/linux/excalidraw-offline" ]]; then
    stat -c '%s %n' "$ROOT/dist/linux/excalidraw-offline"
  fi
  echo ""
  ls -lh "$APP" "$APPIMAGE" "$ROOT/dist/linux/excalidraw-offline" 2>/dev/null || true
} | tee "$ART/sizes.txt"

if [[ -x "$ROOT/dist/linux/excalidraw-offline" ]]; then
  "$ROOT/dist/linux/excalidraw-offline" "$FIXTURE" &
  DENO_PID=$!
  sleep 18
  ps -o rss= -p "$DENO_PID" | awk '{print "deno_idle_rss_kb=" $1}' >> "$ART/memory.txt"
  kill "$DENO_PID" 2>/dev/null || true
  wait "$DENO_PID" 2>/dev/null || true
fi

echo "Done: $ART"
