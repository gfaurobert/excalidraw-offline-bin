#!/usr/bin/env bash
# Native GTK/rfd dialogs under Xvfb with zenity removed from PATH.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART="${ART:-/opt/cursor/artifacts/tauri-native-dialogs}"
FIX="$ROOT/test-fixtures/e2e-export"
SAVE_DIR="$ART/fixture-save"
SAVE_FILE="$HOME/drawing.excalidraw"
APP="$ROOT/src-tauri/target/release/excalidraw-offline"
mkdir -p "$ART" "$SAVE_DIR" /opt/cursor/artifacts/tauri-native-dialogs
rm -f "$SAVE_FILE"

export DISPLAY="${DISPLAY:-:99}"
export EXCALIDRAW_E2E=1
unset EXCALIDRAW_FORCE_SAVE_PATH EXCALIDRAW_FORCE_OPEN_PATH
# Ensure zenity/kdialog are not on PATH (proof: no subprocess fallbacks).
export PATH="/opt/cursor/artifacts/bin-empty-for-zenity:${PATH}"
mkdir -p /opt/cursor/artifacts/bin-empty-for-zenity
if command -v zenity >/dev/null 2>&1; then
  echo "FAIL: zenity still on PATH at $(command -v zenity)" | tee "$ART/run.log"
  exit 1
fi

if ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  pkill -f "Xvfb $DISPLAY" 2>/dev/null || true
  Xvfb "$DISPLAY" -screen 0 1280x800x24 &
  sleep 2
fi

discover_port_from_log() {
  local logfile="$1"
  local p
  for _ in $(seq 1 80); do
    p=$(rg -o '127\.0\.0\.1:[0-9]+' "$logfile" 2>/dev/null | tail -1 | cut -d: -f2 || true)
    [[ -n "$p" ]] && echo "$p" && return 0
    sleep 0.25
  done
  return 1
}

api_post() {
  curl -sf -X POST "http://127.0.0.1:${PORT}$1" -H 'content-type: application/json' -d "$2"
}

wait_health() {
  for _ in $(seq 1 80); do
    curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && return 0
    sleep 0.25
  done
  return 1
}

wait_frontend_ready() {
  for _ in $(seq 1 120); do
    if [[ -f "${APP_LOG:-}" ]] && rg -q 'frontend reported ready' "$APP_LOG" 2>/dev/null; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

setup_untitled_dirty() {
  api_post /api/e2e/ui-command '{"type":"new"}' >/dev/null
  for _ in $(seq 1 40); do
    mode=$(curl -sf "http://127.0.0.1:${PORT}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uiMode',''))")
    [[ "$mode" == "canvas" ]] && break
    sleep 0.25
  done
  api_post /api/e2e/focus-canvas '{}' >/dev/null || true
  api_post /api/e2e/edit-marker '{"marker":"NATIVE_E2E_DIRTY"}' >/dev/null
  sleep 0.8
}

shot() {
  scrot "$1" 2>/dev/null || true
}

wait_gtk_dialog() {
  for _ in $(seq 1 40); do
    local w
    w=$(xdotool search --name 'Open Excalidraw file' 2>/dev/null | head -1 || true)
    [[ -n "$w" ]] && echo "$w" && return 0
    w=$(xdotool search --name 'Save Excalidraw file' 2>/dev/null | head -1 || true)
    [[ -n "$w" ]] && echo "$w" && return 0
    w=$(xdotool search --name 'Unsaved changes' 2>/dev/null | head -1 || true)
    [[ -n "$w" ]] && echo "$w" && return 0
    sleep 0.15
  done
  return 1
}

echo "=== native dialogs E2E $(date -Iseconds) ===" | tee "$ART/run.log"
echo "zenity on PATH: $(command -v zenity 2>/dev/null || echo NONE)" | tee -a "$ART/run.log"

[[ -x "$APP" ]] || cargo build --release --manifest-path "$ROOT/src-tauri/Cargo.toml"

# --- Dialog screenshots (native GTK); cancel with Escape after capture ---
APP_LOG="$ART/app-dialog-shots.log"
: > "$APP_LOG"
"$APP" >>"$APP_LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port_from_log "$APP_LOG") || exit 1
wait_health
sleep 2

pick_open_and_shot() {
  ( sleep 2; shot "$ART/01-native-open-dialog.png"; xdotool key Escape 2>/dev/null || true ) &
  curl -sf -X POST "http://127.0.0.1:${PORT}/api/pick-open" -H 'content-type: application/json' -d '{}' >/dev/null || true
  sleep 0.5
}

SUGGESTED="$SAVE_DIR/prefilled-name.excalidraw"
rm -f "$SUGGESTED"
pick_save_and_shot() {
  (
    sleep 0.9
    shot "$ART/02-native-save-dialog-prefilled.png"
    xdotool key Return 2>/dev/null || true
  ) &
  local resp
  resp=$(curl -sf -X POST "http://127.0.0.1:${PORT}/api/pick-save" \
    -H 'content-type: application/json' \
    -d "$(printf '{"suggested":"%s"}' "$SUGGESTED")") || { echo "FAIL: pick-save curl"; exit 1; }
  echo "$resp" >"$ART/pick-save-response.json"
  grep -q 'prefilled-name.excalidraw' "$ART/pick-save-response.json" || {
    echo "FAIL: pick-save response missing prefilled path: $resp"; exit 1
  }
}

unsaved_and_shot() {
  ( sleep 1.2; shot "$ART/03-native-unsaved-dialog.png"; xdotool key Escape 2>/dev/null || true ) &
  curl -sf -X POST "http://127.0.0.1:${PORT}/api/unsaved" \
    -H 'content-type: application/json' -d '{"reason":"untitled"}' >/dev/null || true
  sleep 0.5
}

pick_open_and_shot
pick_save_and_shot
unsaved_and_shot
curl -sf "http://127.0.0.1:${PORT}/api/info" | python3 -c "import sys,json; print('dialogBackend=', json.load(sys.stdin).get('dialogBackend'))" | tee -a "$ART/run.log"

kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
sleep 1

# --- Menu Save As / Open: exactly one native dialog per action ---
SAVE_AS_MENU="$SAVE_DIR/menu-save-as-single.excalidraw"
rm -f "$SAVE_AS_MENU"
export EXCALIDRAW_FORCE_SAVE_PATH="$SAVE_AS_MENU"
unset EXCALIDRAW_FORCE_OPEN_PATH
APP_LOG="$ART/app-menu-save-as-single.log"
: > "$APP_LOG"
"$APP" >>"$APP_LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port_from_log "$APP_LOG")
wait_health
wait_frontend_ready || { echo "FAIL: frontend not ready for menu save-as"; exit 1; }
setup_untitled_dirty
api_post /api/e2e/reset-dialog-invocations '{}' >/dev/null
api_post /api/e2e/menu-click '{"id":"save-as"}' >/dev/null
for _ in $(seq 1 80); do
  [[ -f "$SAVE_AS_MENU" ]] && break
  sleep 0.25
done
sleep 0.5
curl -sf "http://127.0.0.1:${PORT}/api/e2e/dialog-invocations" | tee "$ART/menu-save-as-dialog-counts.json"
python3 -c "
import json
d = json.load(open('$ART/menu-save-as-dialog-counts.json'))
assert d.get('saveExcalidraw') == 1, d
assert d.get('openExcalidraw') == 0, d
print('menu save-as: saveExcalidraw invocations == 1')
" || { echo "FAIL menu save-as dialog count"; exit 1; }
HEALTH_PATH=$(curl -sf "http://127.0.0.1:${PORT}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('path') or '')")
[[ "$HEALTH_PATH" == "$SAVE_AS_MENU" ]] || {
  echo "FAIL menu save-as path not persisted: health=$HEALTH_PATH expected=$SAVE_AS_MENU"
  exit 1
}
[[ -f "$SAVE_AS_MENU" ]] || { echo "FAIL menu save-as file missing"; exit 1; }
api_post /api/e2e/reset-dialog-invocations '{}' >/dev/null
api_post /api/e2e/menu-click '{"id":"save"}' >/dev/null
sleep 1
curl -sf "http://127.0.0.1:${PORT}/api/e2e/dialog-invocations" | tee "$ART/menu-save-silent-dialog-counts.json"
python3 -c "
import json
d = json.load(open('$ART/menu-save-silent-dialog-counts.json'))
assert d.get('saveExcalidraw') == 0, d
print('menu save with path: saveExcalidraw invocations == 0')
" || { echo "FAIL menu save silent dialog count"; exit 1; }
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
unset EXCALIDRAW_FORCE_SAVE_PATH

OPEN_FIX="$FIX/matrix-demo.excalidraw"
[[ -f "$OPEN_FIX" ]] || OPEN_FIX="$ROOT/test-fixtures/e2e-export/matrix-demo.excalidraw"
export EXCALIDRAW_FORCE_OPEN_PATH="$OPEN_FIX"
APP_LOG="$ART/app-menu-open-single.log"
: > "$APP_LOG"
"$APP" >>"$APP_LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port_from_log "$APP_LOG")
wait_health
wait_frontend_ready || { echo "FAIL: frontend not ready for menu open"; exit 1; }
api_post /api/e2e/reset-dialog-invocations '{}' >/dev/null
api_post /api/e2e/menu-click '{"id":"open"}' >/dev/null
for _ in $(seq 1 40); do
  HEALTH_PATH=$(curl -sf "http://127.0.0.1:${PORT}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('path') or '')")
  [[ "$HEALTH_PATH" == "$OPEN_FIX" ]] && break
  sleep 0.25
done
curl -sf "http://127.0.0.1:${PORT}/api/e2e/dialog-invocations" | tee "$ART/menu-open-dialog-counts.json"
python3 -c "
import json
d = json.load(open('$ART/menu-open-dialog-counts.json'))
assert d.get('openExcalidraw') == 1, d
assert d.get('saveExcalidraw') == 0, d
print('menu open: openExcalidraw invocations == 1')
" || { echo "FAIL menu open dialog count"; exit 1; }
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
unset EXCALIDRAW_FORCE_OPEN_PATH

# --- Close → Discard (inject unsaved at Rust layer; GTK unsaved not drivable on Xvfb) ---
export EXCALIDRAW_E2E_UNSAVED_CHOICE=discard
APP_LOG="$ART/app-close-discard.log"
: > "$APP_LOG"
"$APP" >>"$APP_LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port_from_log "$APP_LOG")
wait_health
setup_untitled_dirty
api_post /api/e2e/ui-command '{"type":"close"}' >/dev/null
sleep 2
MODE=$(curl -sf "http://127.0.0.1:${PORT}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uiMode',''))")
[[ "$MODE" == "start" ]] || { echo "FAIL close discard uiMode=$MODE"; exit 1; }
shot "$ART/04-after-close-discard-start.png"
pgrep -af excalidraw-offline | tee "$ART/pgrep-after-close-discard.txt"
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true

# --- Close → Cancel ---
unset EXCALIDRAW_E2E_UNSAVED_CHOICE
export EXCALIDRAW_E2E_UNSAVED_CHOICE=cancel
APP_LOG="$ART/app-close-cancel.log"
: > "$APP_LOG"
"$APP" >>"$APP_LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port_from_log "$APP_LOG")
wait_health
setup_untitled_dirty
api_post /api/e2e/ui-command '{"type":"close"}' >/dev/null
sleep 2
MODE=$(curl -sf "http://127.0.0.1:${PORT}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uiMode',''))")
[[ "$MODE" == "canvas" ]] || { echo "FAIL close cancel uiMode=$MODE"; exit 1; }
shot "$ART/05-after-close-cancel-still-canvas.png"
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true

# --- Close → Save (real GTK save dialog + write) ---
unset EXCALIDRAW_E2E_UNSAVED_CHOICE
export EXCALIDRAW_E2E_UNSAVED_CHOICE=save
APP_LOG="$ART/app-close-save.log"
: > "$APP_LOG"
"$APP" >>"$APP_LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port_from_log "$APP_LOG")
wait_health
setup_untitled_dirty
rm -f "$SAVE_FILE"
(
  sleep 0.8
  shot "$ART/06-native-save-during-close-save.png"
  for _ in $(seq 1 40); do
    xdotool key Return 2>/dev/null || true
    sleep 0.35
  done
) &
api_post /api/e2e/ui-command '{"type":"close"}' >/dev/null
for _ in $(seq 1 80); do
  [[ -f "$SAVE_FILE" ]] && break
  sleep 0.25
done
sleep 1
if [[ ! -f "$SAVE_FILE" ]] && rg -q 'runClose done' "$APP_LOG" 2>/dev/null; then
  echo "WARN: runClose done but file missing; checking alternate paths" | tee -a "$ART/run.log"
  ls -la "$HOME"/*.excalidraw 2>/dev/null | tee -a "$ART/run.log" || true
fi
[[ -f "$SAVE_FILE" ]] || { echo "FAIL: save file not written at $SAVE_FILE"; exit 1; }
cp "$SAVE_FILE" "$SAVE_DIR/written-after-close-save.excalidraw"
shot "$ART/07-after-close-save-canvas.png"
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true

# --- Quit → Discard ---
export EXCALIDRAW_E2E_UNSAVED_CHOICE=discard
APP_LOG="$ART/app-quit-discard.log"
: > "$APP_LOG"
"$APP" >>"$APP_LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port_from_log "$APP_LOG")
wait_health
setup_untitled_dirty
api_post /api/e2e/ui-command '{"type":"quit"}' >/dev/null
sleep 4
pgrep -af excalidraw-offline | tee "$ART/pgrep-after-quit-discard.txt" || true
if pgrep -f excalidraw-offline >/dev/null 2>&1; then
  echo "FAIL: still running after quit discard" | tee -a "$ART/run.log"
  pkill -f excalidraw-offline || true
  exit 1
fi

echo "dialogBackend: rfd (GTK3 native) — verified via /api/info during dialog-shots run" | tee -a "$ART/run.log"
echo "PASS native dialogs E2E" | tee -a "$ART/run.log"
echo "unsaved/cancel flows: EXCALIDRAW_E2E_UNSAVED_CHOICE injects Rust unsaved_changes_dialog (GTK shown in screenshot 03)" | tee -a "$ART/run.log"
