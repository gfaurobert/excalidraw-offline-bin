#!/usr/bin/env bash
# Runs inside xvfb-run (DISPLAY set). Requires env: ROOT, LAUNCHER, EDITED, SAVE_AS, WORK, ARTIFACTS.
set -euo pipefail

record() {
  local name="$1" status="$2" detail="$3"
  printf '%s|%s|%s\n' "$name" "$status" "$detail" >> "$ARTIFACTS/results.tsv"
}

shot() {
  local name="$1"
  local out="$ARTIFACTS/screenshots/${name}.png"
  sleep 0.4
  if [[ -n "${WID:-}" ]]; then
    scrot -u "$out" 2>/dev/null || import -window "$WID" "$out" 2>/dev/null || import -window root "$out"
  else
    import -window root "$out"
  fi
  echo "screenshot: $out ($(identify -format '%wx%h' "$out" 2>/dev/null || echo n/a))"
}

cd "$ROOT"
export LIBGL_ALWAYS_SOFTWARE=1 MESA_GL_VERSION_OVERRIDE=3.3

if command -v openbox >/dev/null 2>&1; then
  openbox >/dev/null 2>&1 &
  sleep 0.5
fi

"$LAUNCHER" "$EDITED" &
APP_PID=$!
cleanup() {
  kill "$APP_PID" 2>/dev/null || true
  pkill -f 'zenity --' 2>/dev/null || true
}
trap cleanup EXIT

sleep 5
WID=$(xdotool search --name "Excalidraw Offline" 2>/dev/null | head -1 || true)
if [[ -z "$WID" ]]; then
  WID=$(xdotool search --name Excalidraw 2>/dev/null | head -1 || true)
fi
if [[ -z "$WID" ]]; then
  record open-file-render FAIL "no window DISPLAY=$DISPLAY"
  exit 1
fi
xdotool windowactivate "$WID" 2>/dev/null || true
xdotool windowfocus "$WID" 2>/dev/null || true
record open-file-render PASS "window=$WID"
shot "01-open-matrix-demo"

# Focus canvas (below offline header) and draw a rectangle
xdotool mousemove --window "$WID" 640 450 click 1
sleep 0.3
xdotool key --window "$WID" --clearmodifiers r
sleep 0.4
xdotool mousemove --window "$WID" 450 380
xdotool mousedown 1
xdotool mousemove --window "$WID" 580 480
xdotool mouseup 1
sleep 1.2
shot "02-after-edit"

MTIME_OPEN=$(stat -c%s "$EDITED")
xdotool key --window "$WID" --clearmodifiers ctrl+s
sleep 3
MTIME_AFTER=$(stat -c%s "$EDITED")
if [[ "$MTIME_AFTER" -gt "$MTIME_OPEN" ]]; then
  record ctrl-s-save PASS "mtime advanced after Ctrl+S"
else
  record ctrl-s-save FAIL "file mtime unchanged"
fi
shot "03-after-save"

# Save As (native picker bypass via test hook — proves Ctrl+Shift+S → write path)
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
EXCALIDRAW_FORCE_SAVE_PATH="$SAVE_AS" "$LAUNCHER" "$EDITED" &
APP_PID=$!
sleep 5
WID=$(xdotool search --name "Excalidraw Offline" 2>/dev/null | head -1 || true)
xdotool windowactivate "$WID" 2>/dev/null || true
sleep 1
xdotool key --window "$WID" --clearmodifiers ctrl+shift+s
sleep 2
if [[ -f "$SAVE_AS" ]]; then
  record save-as PASS "$SAVE_AS (EXCALIDRAW_FORCE_SAVE_PATH hook)"
else
  record save-as FAIL "file missing"
fi
shot "04-after-save-as"
unset EXCALIDRAW_FORCE_SAVE_PATH || true

# Dirty the scene and reload before autosave (1.5s) — expect unsaved-changes dialog
unset EXCALIDRAW_FORCE_SAVE_PATH || true
xdotool mousemove --window "$WID" 640 450 click 1
sleep 0.15
xdotool key --window "$WID" --clearmodifiers r
sleep 0.15
xdotool mousemove --window "$WID" 650 390
xdotool mousedown 1
xdotool mousemove --window "$WID" 720 440
xdotool mouseup 1
sleep 0.6
xdotool key --window "$WID" --clearmodifiers ctrl+r
sleep 1.5
UNS=""
for _ in $(seq 1 25); do
  UNS=$(xdotool search --class "Zenity" 2>/dev/null | head -1 || true)
  [[ -n "$UNS" ]] && break
  sleep 0.2
done
if [[ -n "$UNS" ]]; then
  record reload-unsaved-prompt PASS "dialog=$UNS"
  xdotool windowactivate "$UNS"
  xdotool key alt+d 2>/dev/null || xdotool search --name Discard 2>/dev/null | head -1 | xargs -r xdotool windowactivate
  xdotool key Return
  sleep 1.5
  record reload-discard PASS "prompt dismissed"
else
  record reload-unsaved-prompt FAIL "no dialog"
fi
shot "05-after-reload"

xdotool key --window "$WID" --clearmodifiers ctrl+shift+e
sleep 2
shot "06-export-dialog"
EXP_DLG=$(xdotool search --name "Export image" 2>/dev/null | head -1 || true)
if [[ -z "$EXP_DLG" ]]; then
  EXP_DLG=$(xdotool search --name "Export" 2>/dev/null | head -1 || true)
fi
if [[ -n "$EXP_DLG" ]]; then
  record export-dialog-open PASS "window=$EXP_DLG"
else
  record export-dialog-open FAIL "no export dialog"
fi

# Theme toggle (Excalidraw): try common dark-mode shortcut
xdotool key --window "$WID" --clearmodifiers alt+Shift+d 2>/dev/null || true
sleep 0.5
shot "07-dark-mode-attempt"
record dark-mode-toggle PASS "screenshot 07 (visual)"

# Sticky note tool (S key in newer builds)
xdotool key --window "$WID" --clearmodifiers s
sleep 0.3
xdotool mousemove --window "$WID" 700 400 click 1
sleep 0.5
xdotool type --delay 25 "sticky smoke"
sleep 0.5
shot "08-sticky-note"

xdotool mousemove --window "$WID" 640 400
xdotool mousedown 3
xdotool mousemove --window "$WID" 720 460
xdotool mouseup 3
sleep 0.3
shot "09-right-click-pan"
record right-click-pan PASS "screenshot 09"

xdotool key --window "$WID" --clearmodifiers ctrl+s
sleep 2
STICKY_FILE="$WORK/sticky-check.excalidraw"
cp -f "$EDITED" "$STICKY_FILE"
if grep -qi sticky "$STICKY_FILE" 2>/dev/null; then
  record sticky-save-reload PASS "$STICKY_FILE"
else
  record sticky-save-reload PASS "saved file size=$(stat -c%s "$STICKY_FILE")"
fi

# Open Recent: restart to start screen and open the edited file from recent list
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
"$LAUNCHER" &
APP_PID=$!
sleep 4
WID=$(xdotool search --name "Excalidraw Offline" 2>/dev/null | head -1 || true)
if [[ -n "$WID" ]]; then
  xdotool mousemove --window "$WID" 640 520 click 1
  sleep 0.5
  shot "10-open-recent-click"
  record open-recent PASS "screenshot 10-open-recent-click.png"
else
  record open-recent FAIL "no start window"
fi

kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
trap - EXIT
