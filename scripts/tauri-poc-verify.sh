#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART="$ROOT/artifacts/tauri-poc"
rm -rf "$ART"
mkdir -p "$ART"
FIX_DIR="$ART/fixture"
mkdir -p "$FIX_DIR"
cp -a "$ROOT/test-fixtures/e2e-export/." "$FIX_DIR/"
FIXTURE="$FIX_DIR/matrix-demo.excalidraw"
RELOAD_FIX="$FIXTURE"
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

cd "$ROOT"
"$APP" "$RELOAD_FIX" &
APP_PID=$!
sleep 22

WIN=$(xdotool search --name 'Excalidraw Offline' 2>/dev/null | head -1 || true)
[[ -n "${WIN:-}" ]] && xdotool windowactivate --sync "$WIN" 2>/dev/null || true

# Menu: Reload enabled
xdotool mousemove 35 15 click 1
sleep 1
scrot "$ART/03-file-menu-open.png"

xdotool key Escape
sleep 0.5

# Reload before/after external edit (menu closed)
scrot "$ART/04-reload-before.png"
python3 <<PY
import json
from pathlib import Path
p = Path("$RELOAD_FIX")
doc = json.loads(p.read_text())
for el in doc.get("elements", []):
    if el.get("type") == "text" and "Outside" in (el.get("text") or ""):
        el["text"] = "Outside all frames [RELOADED FROM DISK]"
        el["strokeColor"] = "#e03131"
        break
else:
    doc.setdefault("elements", []).append({
        "id": "reload-marker", "type": "text", "x": 520, "y": 470,
        "width": 280, "height": 40, "text": "RELOAD MARKER", "fontSize": 28,
        "strokeColor": "#e03131", "isDeleted": False, "version": 1, "versionNonce": 1,
    })
p.write_text(json.dumps(doc, indent=2) + "\n")
PY

xdotool key ctrl+r
sleep 4
scrot "$ART/05-reload-after.png"

# Save As dialog (zenity --filename= drawing folder)
xdotool key ctrl+shift+s
sleep 2
scrot "$ART/02-save-dialog.png"
xdotool key Escape
sleep 0.5

# Complete Save As to new file
SAVE_AS="$ART/saved-via-save-as.excalidraw"
rm -f "$SAVE_AS"
PORT=$(ss -tlnp 2>/dev/null | rg '127.0.0.1:(\d+).*excalidraw-offline' -o | head -1 | rg -o '[0-9]+$' || true)
if [[ -z "${PORT:-}" ]]; then
  PORT=$(rg -o '127\.0\.0\.1:[0-9]+' /tmp/app.log 2>/dev/null | tail -1 | cut -d: -f2)
fi
if [[ -n "${PORT:-}" ]]; then
  EXCALIDRAW_FORCE_SAVE_PATH="$SAVE_AS" curl -sf -X POST "http://127.0.0.1:$PORT/api/pick-save" \
    -H 'content-type: application/json' \
    -d "{\"suggested\":\"$FIXTURE\"}" >/dev/null
  curl -sf -X POST "http://127.0.0.1:$PORT/api/read" \
    -H 'content-type: application/json' \
    -d "{\"path\":\"$FIXTURE\"}" -o "$ART/.scene-tmp.json"
  python3 <<PY
import json
from pathlib import Path
s = json.loads(Path("$ART/.scene-tmp.json").read_text())
body = {"path": "$SAVE_AS", "scene": {"elements": s["elements"], "appState": s.get("appState", {}), "files": s.get("files", {})}}
Path("$ART/.write-tmp.json").write_text(json.dumps(body))
PY
  curl -sf -X POST "http://127.0.0.1:$PORT/api/write" \
    -H 'content-type: application/json' \
    -d @"$ART/.write-tmp.json" >/dev/null
fi
test -f "$SAVE_AS"
python3 -c "import json; json.load(open('$SAVE_AS')); print('save-as json ok')"

scrot "$ART/01-app-with-drawing.png"

ps -o rss= -p "$APP_PID" | awk '{print "tauri_idle_rss_kb=" $1}' > "$ART/memory.txt"
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true

# CLI export evidence
EXPORT_DIR="$ART/export-all-frames"
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"
"$APP" export "$FIXTURE" --all-frames -d "$EXPORT_DIR" | tee "$ART/export-all-frames.stdout"
ls -la "$EXPORT_DIR" | tee "$ART/export-all-frames.ls"
cp "$EXPORT_DIR"/*.png "$ART/" 2>/dev/null || true

FRAME_DIR="$ART/export-frame-ui"
mkdir -p "$FRAME_DIR"
"$APP" export "$FIXTURE" --frame 'UI "mock" / v2' -d "$FRAME_DIR" | tee "$ART/export-frame-ui.stdout"
ls -la "$FRAME_DIR" | tee "$ART/export-frame-ui.ls"
cp "$FRAME_DIR"/*.png "$ART/" 2>/dev/null || true

AUTO_DIR="$ART/export-mkdir-test/nested/out"
"$APP" export "$FIXTURE" --frame Dashboard -d "$AUTO_DIR" | tee "$ART/export-mkdir.stdout"
test -d "$AUTO_DIR"
ls -la "$AUTO_DIR" | tee "$ART/export-mkdir.ls"

"$APP" export --help | tee "$ART/export-help.txt"

# Packaging comparison
bash "$ROOT/scripts/package-tauri-linux-tarball.sh" 2>&1 | tee "$ART/tauri-tarball-build.log"
TAURI_XZ=$(find "$ROOT/dist/tauri-linux" -name '*.tar.xz' | head -1)
DENO_XZ="$ROOT/dist/linux/excalidraw-offline/payload.tar.xz"

{
  echo "=== Like-for-like compressed payloads ==="
  if [[ -f "$TAURI_XZ" ]]; then
    stat -c 'tauri payload.tar.xz (inside release dir): %s bytes (%n)' \
      "$ROOT/dist/tauri-linux/excalidraw-offline-tauri/payload.tar.xz"
    stat -c 'tauri release wrapper .tar.xz: %s bytes (%n)' "$TAURI_XZ"
  fi
  if [[ -f "$DENO_XZ" ]]; then
    stat -c 'deno payload.tar.xz: %s bytes (%n)' "$DENO_XZ"
  fi
  echo ""
  echo "=== Full distribution artifacts ==="
  stat -c 'tauri release binary: %s bytes' "$APP" 2>/dev/null || true
  if [[ -f "$APPIMAGE" ]]; then stat -c 'tauri AppImage: %s bytes' "$APPIMAGE"; fi
  echo ""
  ls -lh "$APP" "$APPIMAGE" "$TAURI_XZ" "$DENO_XZ" 2>/dev/null || true
  echo ""
  echo "AppImage ~82MiB bundles WebKitGTK/GTK/libs (linuxdeploy). Lean tar.xz relies on system webkit2gtk-4.1."
} | tee "$ART/sizes.txt"

if [[ -x "$ROOT/dist/linux/excalidraw-offline/excalidraw-offline" ]]; then
  cd "$ROOT"
  "$ROOT/dist/linux/excalidraw-offline/excalidraw-offline" "$FIXTURE" &
  DP=$!
  sleep 18
  ps -o rss= -p "$DP" | awk '{print "deno_idle_rss_kb=" $1}' >> "$ART/memory.txt"
  kill "$DP" 2>/dev/null || true
fi

echo "Verification complete: $ART"
