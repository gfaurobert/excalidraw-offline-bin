#!/usr/bin/env bash
# GTK dialogs on Tauri main thread: X11 + headless Weston (Wayland), real keyboard clicks.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART="/opt/cursor/artifacts/tauri-wayland-dialog-fix"
APP="$ROOT/src-tauri/target/release/excalidraw-offline"
mkdir -p "$ART"

export EXCALIDRAW_E2E=1
export PATH="/opt/cursor/artifacts/bin-empty-for-zenity:${PATH}"
mkdir -p /opt/cursor/artifacts/bin-empty-for-zenity

BACKEND="${GDK_BACKEND:-x11}"

discover_port() {
  local logfile="$1" p
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

setup_dirty() {
  api_post /api/e2e/ui-command '{"type":"new"}' >/dev/null
  sleep 2
  api_post /api/e2e/edit-marker '{"marker":"WAYLAND_E2E"}' >/dev/null
  sleep 0.6
}

shot() {
  local path="$1"
  if [[ "$BACKEND" == "wayland" && -z "${DISPLAY:-}" ]]; then
    grim "$path" 2>/dev/null || scrot "$path" 2>/dev/null || true
  else
    scrot "$path" 2>/dev/null || true
  fi
}

wait_for_unsaved_dialog() {
  if [[ "$BACKEND" == "wayland" && -z "${DISPLAY:-}" ]]; then
    sleep 1.2
    echo "wayland"
    return 0
  fi
  local w=""
  for _ in $(seq 1 50); do
    w=$(xdotool search --name 'Unsaved changes' 2>/dev/null | head -1 || true)
    [[ -n "$w" ]] && { echo "$w"; return 0; }
    sleep 0.15
  done
  return 1
}

click_dialog_button() {
  local choice="$1"
  local w="$2"
  local width height x y
  width=$(xdotool getwindowgeometry "$w" 2>/dev/null | rg 'Geometry:' | rg -o '[0-9]+x[0-9]+' | cut -dx -f1)
  height=$(xdotool getwindowgeometry "$w" 2>/dev/null | rg 'Geometry:' | rg -o '[0-9]+x[0-9]+' | cut -dx -f2)
  [[ -n "$width" && -n "$height" ]] || return 1
  case "$choice" in
    save) x=$((width * 18 / 100)); y=$((height * 88 / 100)) ;;
    cancel) x=$((width * 50 / 100)); y=$((height * 88 / 100)) ;;
    discard) x=$((width * 82 / 100)); y=$((height * 88 / 100)) ;;
    *) return 1 ;;
  esac
  xdotool mousemove --window "$w" "$x" "$y" click 1
}

# GTK MessageDialog: Save, Cancel, Discard (dialogs_linux.rs). X11: real mouse clicks on dialog window.
wayland_dialog_choice() {
  local choice="$1"
  command -v wtype >/dev/null 2>&1 || {
    echo "FAIL: wtype required for Wayland dialog clicks" | tee -a "$ART/run.log"
    return 1
  }
  # GTK MessageDialog buttons (left→right): Save, Cancel, Discard — Tab from initial focus, then activate.
  case "$choice" in
    save) wtype -k Return ;;
    cancel) wtype -k Tab; sleep 0.08; wtype -k Return ;;
    discard) wtype -k Tab; sleep 0.08; wtype -k Tab; sleep 0.08; wtype -k Return ;;
    *) return 1 ;;
  esac
}

send_dialog_choice() {
  local choice="$1"
  if [[ "$BACKEND" == "wayland" && -z "${DISPLAY:-}" ]]; then
    sleep 0.35
    wayland_dialog_choice "$choice"
    return $?
  fi
  local w
  w=$(wait_for_unsaved_dialog) || return 1
  [[ "$w" == "wayland" ]] && return 1
  click_dialog_button "$choice" "$w"
}

assert_no_gtk_panic() {
  local log="$1"
  if rg -q 'two different threads|Attempted to initialize GTK|tokio-rt-worker.*panicked' "$log" 2>/dev/null; then
    echo "FAIL: GTK/thread panic in $log" | tee -a "$ART/run.log"
    rg 'panic|GTK|two different threads' "$log" | tee -a "$ART/run.log"
    exit 1
  fi
}

run_unsaved_real_click() {
  local tag="$1"
  local choice="$2"
  local log="$ART/app-${tag}.log"
  unset EXCALIDRAW_E2E_UNSAVED_CHOICE
  : > "$log"
  : > "$ART/${tag}-response.json"
  "$APP" >>"$log" 2>&1 &
  local pid=$!
  PORT=$(discover_port "$log")
  for _ in $(seq 1 80); do curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break; sleep 0.25; done
  setup_dirty
  api_post /api/unsaved '{"reason":"untitled"}' >"$ART/${tag}-response.json" &
  local curl_pid=$!
  sleep 1.2
  shot "$ART/${tag}-unsaved-dialog.png"
  send_dialog_choice "$choice"
  wait "$curl_pid" || true
  sleep 0.5
  shot "$ART/${tag}-after.png"
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  assert_no_gtk_panic "$log"
  rg -q "\"choice\":\"$choice\"" "$ART/${tag}-response.json" || {
    echo "FAIL: expected choice=$choice in $ART/${tag}-response.json" | tee -a "$ART/run.log"
    cat "$ART/${tag}-response.json" | tee -a "$ART/run.log"
    exit 1
  }
  echo "OK $tag real-click unsaved ($choice)" | tee -a "$ART/run.log"
}

run_pick_open_no_panic() {
  local tag="$1"
  local log="$ART/app-${tag}.log"
  export EXCALIDRAW_FORCE_OPEN_PATH="$ROOT/test-fixtures/e2e-export/matrix-demo.excalidraw"
  : > "$log"
  "$APP" >>"$log" 2>&1 &
  local pid=$!
  PORT=$(discover_port "$log")
  for _ in $(seq 1 80); do curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break; sleep 0.25; done
  api_post /api/pick-open '{}' >/dev/null || true
  sleep 1
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  unset EXCALIDRAW_FORCE_OPEN_PATH
  assert_no_gtk_panic "$log"
  echo "OK $tag pick-open (main thread)" | tee -a "$ART/run.log"
}

start_weston() {
  pkill -9 weston 2>/dev/null || true
  sleep 1
  export XDG_RUNTIME_DIR="/tmp/xdg-wayland-e2e-$$"
  mkdir -p "$XDG_RUNTIME_DIR"
  chmod 700 "$XDG_RUNTIME_DIR"
  weston --backend=headless-backend.so --width=1280 --height=800 >>"$ART/weston.log" 2>&1 &
  WESTON_PID=$!
  sleep 3
  export WAYLAND_DISPLAY
  WAYLAND_DISPLAY=$(ls "$XDG_RUNTIME_DIR"/wayland-* 2>/dev/null | rg -o 'wayland-[0-9]+' | head -1 || true)
  [[ -n "$WAYLAND_DISPLAY" ]] || { echo "FAIL: no wayland socket"; exit 1; }
  unset DISPLAY
  export GDK_BACKEND=wayland
  BACKEND=wayland
  echo "Wayland: $WAYLAND_DISPLAY" | tee -a "$ART/run.log"
}

start_xvfb() {
  pkill -f 'Xvfb :99' 2>/dev/null || true
  Xvfb :99 -screen 0 1280x800x24 &
  sleep 2
  export DISPLAY=:99
  unset WAYLAND_DISPLAY
  export GDK_BACKEND=x11
  BACKEND=x11
}

echo "=== wayland/x11 main-thread dialog E2E $(date -Iseconds) ===" | tee "$ART/run.log"
[[ -x "$APP" ]] || cargo build --release --manifest-path "$ROOT/src-tauri/Cargo.toml"

# --- X11 ---
start_xvfb
for c in discard save cancel; do
  run_unsaved_real_click "x11-unsaved-$c" "$c"
done
run_pick_open_no_panic "x11-pick-open"

run_dialog_heartbeat_during_open() {
  local tag="$1"
  export EXCALIDRAW_E2E_MAIN_LOOP_HEARTBEAT=1
  local log="$ART/app-${tag}.log"
  : > "$log"
  "$APP" >>"$log" 2>&1 &
  local pid=$!
  PORT=$(discover_port "$log")
  for _ in $(seq 1 80); do curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break; sleep 0.25; done
  local before
  before=$(rg -c 'main-loop-heartbeat' "$log" 2>/dev/null || echo 0)
  api_post /api/pick-open '{}' >/dev/null &
  local curl_pid=$!
  sleep 3
  local after
  after=$(rg -c 'main-loop-heartbeat' "$log" 2>/dev/null || echo 0)
  kill "$curl_pid" 2>/dev/null || true
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  unset EXCALIDRAW_E2E_MAIN_LOOP_HEARTBEAT
  if [[ "$after" -le "$before" ]]; then
    echo "FAIL: heartbeat did not advance during open dialog ($before -> $after)" | tee -a "$ART/run.log"
    exit 1
  fi
  echo "OK $tag heartbeat during pick-open ($before -> $after)" | tee -a "$ART/run.log"
}

# --- Wayland (Weston headless) ---
start_weston
for c in discard save cancel; do
  run_unsaved_real_click "wayland-unsaved-$c" "$c"
done
run_pick_open_no_panic "wayland-pick-open"
run_dialog_heartbeat_during_open "wayland-pick-open-heartbeat"
kill "$WESTON_PID" 2>/dev/null || true

cargo test --manifest-path "$ROOT/src-tauri/Cargo.toml" dialogs_main --quiet 2>&1 | tee -a "$ART/run.log"

echo "PASS: no GTK cross-thread panics; real Discard/Save/Cancel on X11 + Wayland" | tee -a "$ART/run.log"
echo "Artifacts:" | tee -a "$ART/run.log"
find "$ART" -type f | sort | tee -a "$ART/run.log"
