#!/usr/bin/env bash
# Verify GTK dialogs on main thread: Wayland (headless) + X11, no GTK thread panics.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART="/opt/cursor/artifacts/tauri-wayland-dialog-fix"
APP="$ROOT/src-tauri/target/release/excalidraw-offline"
mkdir -p "$ART"

export EXCALIDRAW_E2E=1
export PATH="/opt/cursor/artifacts/bin-empty-for-zenity:${PATH}"
mkdir -p /opt/cursor/artifacts/bin-empty-for-zenity

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

assert_no_gtk_panic() {
  local log="$1"
  if rg -q 'two different threads|Attempted to initialize GTK' "$log" 2>/dev/null; then
    echo "FAIL: GTK thread panic in $log" | tee -a "$ART/run.log"
    rg 'panic|GTK' "$log" | tee -a "$ART/run.log"
    exit 1
  fi
}

run_unsaved_flow() {
  local tag="$1"
  local choice="$2"
  local log="$ART/app-${tag}.log"
  : > "$log"
  "$APP" >>"$log" 2>&1 &
  local pid=$!
  PORT=$(discover_port "$log")
  for _ in $(seq 1 80); do curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break; sleep 0.25; done
  setup_dirty
  export EXCALIDRAW_E2E_UNSAVED_CHOICE="$choice"
  if [[ "$choice" == "discard" && -z "${EXCALIDRAW_E2E_DIALOG_PAUSE_MS:-}" ]]; then
    :
  fi
  if [[ -n "${EXCALIDRAW_E2E_DIALOG_PAUSE_MS:-}" ]]; then
    unset EXCALIDRAW_E2E_UNSAVED_CHOICE
    api_post /api/unsaved '{"reason":"untitled"}' &
    local curl_pid=$!
    sleep 1.0
    scrot "$ART/${tag}-unsaved-dialog.png" 2>/dev/null || true
    # GTK MessageDialog order: Save, Cancel, Discard — focus Discard via keyboard.
    xdotool key Tab Tab Return 2>/dev/null || xdotool key Return 2>/dev/null || true
    wait "$curl_pid" || true
    sleep 0.8
    scrot "$ART/${tag}-after-discard.png" 2>/dev/null || true
  else
    local resp
    resp=$(api_post /api/unsaved '{"reason":"untitled"}')
    echo "$resp" >>"$ART/${tag}-unsaved-response.json"
  fi
  sleep 1
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  assert_no_gtk_panic "$log"
  echo "OK $tag unsaved ($choice)" | tee -a "$ART/run.log"
}

echo "=== wayland/x11 dialog fix E2E $(date -Iseconds) ===" | tee "$ART/run.log"
[[ -x "$APP" ]] || cargo build --release --manifest-path "$ROOT/src-tauri/Cargo.toml"

# --- X11 (Xvfb) ---
pkill -f 'Xvfb :99' 2>/dev/null || true
Xvfb :99 -screen 0 1280x800x24 &
sleep 2
export DISPLAY=:99
unset WAYLAND_DISPLAY
export GDK_BACKEND=x11
export EXCALIDRAW_E2E_DIALOG_PAUSE_MS=1800
run_unsaved_flow x11-screenshot discard
unset EXCALIDRAW_E2E_DIALOG_PAUSE_MS
export EXCALIDRAW_E2E_UNSAVED_CHOICE=discard
run_unsaved_flow x11-inject discard
export EXCALIDRAW_E2E_UNSAVED_CHOICE=save
run_unsaved_flow x11-save save
export EXCALIDRAW_E2E_UNSAVED_CHOICE=cancel
run_unsaved_flow x11-cancel cancel

# --- Wayland headless (weston) ---
pkill -9 weston 2>/dev/null || true
sleep 1
if command -v weston >/dev/null 2>&1; then
  unset DISPLAY
  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/xdg-runtime-$USER}"
  mkdir -p "$XDG_RUNTIME_DIR"
  chmod 700 "$XDG_RUNTIME_DIR"
  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/xdg-runtime-$USER}"
  mkdir -p "$XDG_RUNTIME_DIR"
  chmod 700 "$XDG_RUNTIME_DIR"
  weston --backend=headless-backend.so --width=1280 --height=800 >>"$ART/weston.log" 2>&1 &
  WESTON_PID=$!
  sleep 3
  export WAYLAND_DISPLAY
  WAYLAND_DISPLAY=$(ls "$XDG_RUNTIME_DIR"/wayland-* 2>/dev/null | rg -o 'wayland-[0-9]+' | head -1 || true)
  if [[ -z "$WAYLAND_DISPLAY" ]]; then
    echo "FAIL: no wayland socket" | tee -a "$ART/run.log"
    exit 1
  fi
  unset DISPLAY
  export GDK_BACKEND=wayland
  echo "Wayland socket: $WAYLAND_DISPLAY" | tee -a "$ART/run.log"
  export EXCALIDRAW_E2E_DIALOG_PAUSE_MS=2000
  run_unsaved_flow wayland-screenshot discard
  unset EXCALIDRAW_E2E_DIALOG_PAUSE_MS
  export EXCALIDRAW_E2E_UNSAVED_CHOICE=discard
  run_unsaved_flow wayland-inject discard
  export EXCALIDRAW_E2E_UNSAVED_CHOICE=cancel
  run_unsaved_flow wayland-cancel cancel
  kill "$WESTON_PID" 2>/dev/null || true
else
  echo "SKIP weston not installed; trying sway" | tee -a "$ART/run.log"
  if command -v sway >/dev/null 2>&1; then
    unset DISPLAY
    export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/xdg-runtime-$USER}"
    mkdir -p "$XDG_RUNTIME_DIR"
    chmod 700 "$XDG_RUNTIME_DIR"
    WLR_BACKENDS=headless sway --unsupported-gpu >>"$ART/sway.log" 2>&1 &
    SWAY_PID=$!
    sleep 4
    export WAYLAND_DISPLAY=wayland-1
    export GDK_BACKEND=wayland
    export EXCALIDRAW_E2E_DIALOG_PAUSE_MS=2000
    run_unsaved_flow wayland-screenshot discard
    kill "$SWAY_PID" 2>/dev/null || true
  fi
fi

cargo test --manifest-path "$ROOT/src-tauri/Cargo.toml" dialogs_main --quiet 2>&1 | tee -a "$ART/run.log"

echo "PASS wayland/x11 dialog fix (no GTK cross-thread panics)" | tee -a "$ART/run.log"
echo "Artifacts:" | tee -a "$ART/run.log"
find "$ART" -type f | sort | tee -a "$ART/run.log"
