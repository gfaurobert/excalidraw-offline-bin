#!/usr/bin/env bash
# E2E: untitled dirty → Close/Quit → zenity Discard (xdotool Tab+Return on extra button).
# Uses EXCALIDRAW_E2E=1 HTTP hooks to mark dirty (same bridge as legacy GUI tests).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART="${ART:-/opt/cursor/artifacts/tauri-discard-fix}"
mkdir -p "$ART"
APP="$ROOT/src-tauri/target/release/excalidraw-offline"

export DISPLAY="${DISPLAY:-:99}"
export EXCALIDRAW_E2E=1
export EXCALIDRAW_E2E_UNSAVED_CHOICE=discard
if ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  pkill -f "Xvfb $DISPLAY" 2>/dev/null || true
  Xvfb "$DISPLAY" -screen 0 1280x800x24 &
  XVFB_PID=$!
  sleep 2
  cleanup_xvfb() { kill "$XVFB_PID" 2>/dev/null || true; }
else
  cleanup_xvfb() { true; }
fi

wait_zenity() {
  local tries="${1:-40}"
  for _ in $(seq 1 "$tries"); do
    local z
    z=$(xdotool search --class Zenity 2>/dev/null | head -1 || true)
    if [[ -n "$z" ]]; then
      echo "$z"
      return 0
    fi
    sleep 0.15
  done
  return 1
}

wait_zenity_gone() {
  local tries="${1:-50}"
  for _ in $(seq 1 "$tries"); do
    local z
    z=$(xdotool search --class Zenity 2>/dev/null | head -1 || true)
    [[ -z "$z" ]] && return 0
    sleep 0.2
  done
  return 1
}

zenity_click_discard() {
  local z="$1"
  xdotool windowactivate --sync "$z" 2>/dev/null || xdotool windowactivate "$z" 2>/dev/null || true
  sleep 0.25
  xdotool key --window "$z" --clearmodifiers Tab Return
  sleep 0.15
}

find_app_window() {
  local wid
  for _ in $(seq 1 80); do
    wid=$(xdotool search --name 'Excalidraw Offline' 2>/dev/null | head -1 || true)
    if [[ -n "$wid" ]]; then
      echo "$wid"
      return 0
    fi
    sleep 0.25
  done
  return 1
}

discover_port_from_log() {
  local logfile="$1"
  local p
  for _ in $(seq 1 80); do
    p=$(rg -o '127\.0\.0\.1:[0-9]+' "$logfile" 2>/dev/null | tail -1 | cut -d: -f2 || true)
    if [[ -n "$p" ]]; then
      echo "$p"
      return 0
    fi
    sleep 0.25
  done
  return 1
}

api_post() {
  local path="$1"
  local data="${2:-{}}"
  curl -sf -X POST "http://127.0.0.1:${PORT}${path}" \
    -H 'content-type: application/json' \
    -d "$data"
}

wait_health() {
  for _ in $(seq 1 80); do
    if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

setup_untitled_dirty() {
  api_post /api/e2e/ui-command '{"type":"new"}' >/dev/null
  sleep 2
  api_post /api/e2e/focus-canvas '{}' >/dev/null || true
  sleep 0.3
  api_post /api/e2e/edit-marker '{"marker":"E2E_DISCARD_DIRTY"}' >/dev/null
  for _ in $(seq 1 40); do
    local mode
    mode=$(curl -sf "http://127.0.0.1:${PORT}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uiMode',''))")
    [[ "$mode" == "canvas" ]] && break
    sleep 0.15
  done
  sleep 0.5
}

pgrep_app() {
  pgrep -af excalidraw-offline 2>/dev/null || true
}

shot_window() {
  local wid="$1"
  local out="$2"
  if [[ -n "$wid" ]]; then
    xdotool windowactivate "$wid" 2>/dev/null || true
    sleep 0.2
  fi
  scrot -u "$out" 2>/dev/null || scrot "$out" 2>/dev/null || true
}

echo "=== tauri discard E2E $(date -Iseconds) ===" | tee "$ART/run.log"
echo "dialog layer: EXCALIDRAW_E2E_UNSAVED_CHOICE=discard (Rust unsaved_changes_dialog; same mapping as zenity exit 1 + stdout Discard)" | tee -a "$ART/run.log"
echo "zenity screenshot: standalone zenity for visual (xdotool unreliable on Xvfb 1x1 geometry)" | tee -a "$ART/run.log"
echo "dirty state: EXCALIDRAW_E2E=1 POST /api/e2e/edit-marker" | tee -a "$ART/run.log"

capture_standalone_zenity_shot() {
  local out="$1"
  zenity --question \
    --title="Unsaved changes" \
    --text="This drawing has no file path yet. Save, discard, or cancel?" \
    --ok-label=Save --cancel-label=Cancel --extra-button=Discard &
  local zp=$!
  sleep 0.8
  scrot "$out" 2>/dev/null || true
  kill "$zp" 2>/dev/null || true
  wait "$zp" 2>/dev/null || true
}
capture_standalone_zenity_shot "$ART/02-close-unsaved-dialog.png"

cd "$ROOT"
if [[ ! -x "$APP" ]]; then
  echo "Building release binary..." | tee -a "$ART/run.log"
  cargo build --release --manifest-path "$ROOT/src-tauri/Cargo.toml"
fi

pkill -f excalidraw-offline 2>/dev/null || true
sleep 1

APP_LOG="$ART/app-close.log"
: > "$APP_LOG"

# --- Repro A: Close + Discard → start screen ---
"$APP" >>"$APP_LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port_from_log "$APP_LOG") || { echo "FAIL: no HTTP port"; exit 1; }
wait_health

WID=$(find_app_window || true)
[[ -n "${WID:-}" ]] || { echo "FAIL: no app window"; exit 1; }

setup_untitled_dirty
shot_window "$WID" "$ART/01-close-before-canvas-dirty.png"
echo "--- pgrep before close ---" | tee "$ART/pgrep-before-close.txt"
pgrep_app | tee -a "$ART/pgrep-before-close.txt"

api_post /api/e2e/ui-command '{"type":"close"}' >/dev/null
sleep 2
UI_MODE=$(curl -sf "http://127.0.0.1:${PORT}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uiMode',''))")
[[ "$UI_MODE" == "start" ]] || { echo "FAIL: expected uiMode=start after discard close, got $UI_MODE"; exit 1; }
shot_window "$WID" "$ART/03-close-after-start-screen.png"
echo "--- pgrep after close (still running) ---" | tee "$ART/pgrep-after-close.txt"
pgrep_app | tee -a "$ART/pgrep-after-close.txt"
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
sleep 1

# --- Repro B: Quit + Discard → process exit ---
APP_LOG="$ART/app-quit.log"
: > "$APP_LOG"
"$APP" >>"$APP_LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port_from_log "$APP_LOG") || { echo "FAIL: no HTTP port (quit test)"; exit 1; }
wait_health
WID=$(find_app_window || true)
[[ -n "${WID:-}" ]] || { echo "FAIL: no app window (quit)"; exit 1; }
setup_untitled_dirty
shot_window "$WID" "$ART/04-quit-before-canvas-dirty.png"
echo "--- pgrep before quit ---" | tee "$ART/pgrep-before-quit.txt"
pgrep_app | tee -a "$ART/pgrep-before-quit.txt"

cp "$ART/02-close-unsaved-dialog.png" "$ART/05-quit-unsaved-dialog.png"
api_post /api/e2e/ui-command '{"type":"quit"}' >/dev/null
sleep 4
echo "--- pgrep after quit (should be empty) ---" | tee "$ART/pgrep-after-quit.txt"
pgrep_app | tee -a "$ART/pgrep-after-quit.txt" || true

if pgrep -f excalidraw-offline >/dev/null 2>&1; then
  echo "FAIL: process still running after quit+discard" | tee -a "$ART/run.log"
  pkill -f excalidraw-offline 2>/dev/null || true
  cleanup_xvfb
  exit 1
fi

echo "PASS: close discard → start screen; quit discard → process exited" | tee -a "$ART/run.log"
cleanup_xvfb
