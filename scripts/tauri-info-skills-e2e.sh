#!/usr/bin/env bash
# Info + Skills menus under Xvfb; zenity must not be on PATH.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART="${ART:-/opt/cursor/artifacts/tauri-info-skills}"
APP="$ROOT/src-tauri/target/release/excalidraw-offline"
mkdir -p "$ART"

export DISPLAY="${DISPLAY:-:99}"
export EXCALIDRAW_E2E=1
export PATH="/opt/cursor/artifacts/bin-empty-for-zenity:${PATH}"
mkdir -p /opt/cursor/artifacts/bin-empty-for-zenity
command -v zenity >/dev/null 2>&1 && { echo "FAIL: zenity on PATH"; exit 1; }

if ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  Xvfb "$DISPLAY" -screen 0 1280x800x24 &
  sleep 2
fi

discover_port() {
  local logfile="$1" p
  for _ in $(seq 1 80); do
    p=$(rg -o '127\.0\.0\.1:[0-9]+' "$logfile" 2>/dev/null | tail -1 | cut -d: -f2 || true)
    [[ -n "$p" ]] && echo "$p" && return 0
    sleep 0.25
  done
  return 1
}

api_menu() {
  curl -sf -X POST "http://127.0.0.1:${PORT}/api/e2e/menu-click" \
    -H 'content-type: application/json' \
    -d "$(printf '{"id":"%s"}' "$1")" >/dev/null
}

shot() { scrot "$1" 2>/dev/null || true; }

echo "=== info/skills E2E $(date -Iseconds) ===" | tee "$ART/run.log"
echo "zenity: $(command -v zenity 2>/dev/null || echo NONE)" | tee -a "$ART/run.log"

[[ -x "$APP" ]] || cargo build --release --manifest-path "$ROOT/src-tauri/Cargo.toml"

# --- Info menu dialogs (pause for screenshot, auto-OK) ---
export EXCALIDRAW_E2E_DIALOG_PAUSE_MS=1800
export EXCALIDRAW_E2E_INFO_AUTOOK=0
LOG="$ART/app-info.log"
: > "$LOG"
"$APP" >>"$LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port "$LOG")
for _ in $(seq 1 80); do curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break; sleep 0.25; done

for item in info-runtime info-assets info-about-app info-about-excalidraw; do
  ( sleep 0.9; shot "$ART/info-${item}.png" ) &
  api_menu "$item"
  wait || true
  sleep 0.5
done

# Menu bar screenshot via main window
W=$(xdotool search --name 'Excalidraw Offline' 2>/dev/null | head -1 || true)
[[ -n "$W" ]] && xdotool mousemove 60 12 click 1 && sleep 0.4 && shot "$ART/info-menu-open.png"
xdotool key Escape 2>/dev/null || true

kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
sleep 1

# --- Skills install screenshots (inject after pause) ---
export EXCALIDRAW_E2E_DIALOG_PAUSE_MS=2000
unset EXCALIDRAW_E2E_SKILL_CANCEL EXCALIDRAW_E2E_SKILL_MODE EXCALIDRAW_E2E_SKILL_HARNESS EXCALIDRAW_E2E_SKILL_PROJECT EXCALIDRAW_E2E_SKILL_OVERWRITE EXCALIDRAW_E2E_INFO_AUTOOK

LOG="$ART/app-skills-shots.log"
: > "$LOG"
"$APP" >>"$LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port "$LOG")
for _ in $(seq 1 80); do curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break; sleep 0.25; done

export EXCALIDRAW_E2E_SKILL_MODE=global
export EXCALIDRAW_E2E_SKILL_HARNESS=agents,claude
( sleep 1.0; shot "$ART/skills-01-choice-dialog.png" ) &
api_menu skills-install-sketching &
sleep 3
( sleep 0.5; shot "$ART/skills-02-checklist-defaults.png" ) &
wait || true
sleep 2
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true

# Project folder picker screenshot
LOG="$ART/app-skills-folder.log"
: > "$LOG"
export EXCALIDRAW_E2E_SKILL_MODE=project
export EXCALIDRAW_E2E_SKILL_HARNESS=agents
unset EXCALIDRAW_E2E_SKILL_PROJECT
PROJECT_DIR="$ART/sample-project"
mkdir -p "$PROJECT_DIR"
"$APP" >>"$LOG" 2>&1 &
APP_PID=$!
PORT=$(discover_port "$LOG")
for _ in $(seq 1 80); do curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break; sleep 0.25; done
( sleep 2.5; shot "$ART/skills-03-project-folder-picker.png"; xdotool key Escape ) &
api_menu skills-install-sketching &
wait || true
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true

# --- Install tests with inject (no pause = no UI wait) ---
unset EXCALIDRAW_E2E_DIALOG_PAUSE_MS
export EXCALIDRAW_E2E_INFO_AUTOOK=1
export EXCALIDRAW_E2E_SKILL_OVERWRITE=yes

run_install() {
  local name="$1"
  shift
  export HOME="$ART/home-$name"
  rm -rf "$HOME"
  mkdir -p "$HOME"
  local log="$ART/install-$name.log"
  : > "$log"
  "$APP" >>"$log" 2>&1 &
  local pid=$!
  PORT=$(discover_port "$log")
  for _ in $(seq 1 80); do curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break; sleep 0.25; done
  api_menu skills-install-sketching
  sleep 2
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  find "$HOME" -type f 2>/dev/null | sort >"$ART/find-$name.txt" || true
  find "$PROJECT_DIR" -type f 2>/dev/null | sort >"$ART/find-project-$name.txt" || true
}

# Global + All (inject at gtk layer: MODE + HARNESS env, no zenity)
(
  export EXCALIDRAW_E2E_SKILL_MODE=global
  export EXCALIDRAW_E2E_SKILL_HARNESS=all
  unset EXCALIDRAW_E2E_SKILL_PROJECT EXCALIDRAW_E2E_SKILL_CANCEL
  run_install global-all
)

# Project + .agents + .claude (inject PROJECT path)
(
  export EXCALIDRAW_E2E_SKILL_MODE=project
  export EXCALIDRAW_E2E_SKILL_HARNESS=agents,claude
  export EXCALIDRAW_E2E_SKILL_PROJECT="$PROJECT_DIR"
  unset EXCALIDRAW_E2E_SKILL_CANCEL
  run_install project-agents-claude
)

# Cancel at choice (inject CANCEL)
(
  export EXCALIDRAW_E2E_SKILL_CANCEL=1
  unset EXCALIDRAW_E2E_SKILL_MODE EXCALIDRAW_E2E_SKILL_HARNESS EXCALIDRAW_E2E_SKILL_PROJECT
  run_install cancel
)

grep -q 'SKILL.md' "$ART/find-global-all.txt" || { echo "FAIL global-all"; exit 1; }
grep -q 'SKILL.md' "$ART/find-project-project-agents-claude.txt" || { echo "FAIL project install"; exit 1; }
! grep -q 'SKILL.md' "$ART/find-cancel.txt" 2>/dev/null || { echo "FAIL cancel installed files"; exit 1; }

echo "Injection: EXCALIDRAW_E2E_SKILL_MODE/HARNESS/PROJECT/CANCEL read in gtk_dialogs.rs (skip UI when DIALOG_PAUSE_MS unset)" | tee -a "$ART/run.log"
echo "Screenshots: real GTK shown when EXCALIDRAW_E2E_DIALOG_PAUSE_MS set; auto-select via env after pause" | tee -a "$ART/run.log"
echo "PASS info/skills E2E" | tee -a "$ART/run.log"

rg -n 'zenity|kdialog' "$ROOT/src-tauri" && exit 1 || echo "No zenity/kdialog under src-tauri" | tee -a "$ART/run.log"
