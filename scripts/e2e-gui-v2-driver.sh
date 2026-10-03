#!/usr/bin/env bash
# GUI E2E v2 — runs inside one xvfb session. Requires EXCALIDRAW_E2E=1 on app process.
set -euo pipefail

TAG="${TAG:?TAG required (old|new)}"
EXPECT_STICKY="${EXPECT_STICKY:-0}"
EXPECT_RCLICK_PAN="${EXPECT_RCLICK_PAN:-0}"
ROOT="${ROOT:?}"
LAUNCHER="${LAUNCHER:?}"
ARTIFACTS="${ARTIFACTS:?}"
DOC="${DOC:-$ROOT/test-fixtures/e2e-export/matrix-demo.excalidraw}"

mkdir -p "$ARTIFACTS/screenshots" "$ARTIFACTS/logs"
RESULTS="$ARTIFACTS/results.tsv"
SUMMARY="$ARTIFACTS/summary.md"
LOG="$ARTIFACTS/run.log"
: > "$RESULTS"

record() {
  printf '%s|%s|%s\n' "$1" "$2" "$3" >> "$RESULTS"
}

LAST_SHOT_MD5=""
SHOT_MANIFEST="$ARTIFACTS/screenshot-md5.txt"
: > "$SHOT_MANIFEST"

force_dismiss_zenity() {
  pkill -f 'zenity --' 2>/dev/null || true
  wait_zenity_gone 40 || true
  sleep 0.2
}

shot_app() {
  local name="$1"
  local out="$ARTIFACTS/screenshots/${name}.png"
  force_dismiss_zenity
  sleep 0.35
  xdotool windowactivate --sync "$WID" 2>/dev/null || xdotool windowactivate "$WID" 2>/dev/null || true
  sleep 0.15
  import -window "$WID" "$out" 2>/dev/null || scrot -u "$out"
  register_shot "$name" "$out"
}

shot_zenity() {
  local name="$1"
  local out="$ARTIFACTS/screenshots/${name}.png"
  local z
  z=$(xdotool search --class "Zenity" 2>/dev/null | head -1 || true)
  sleep 0.25
  if [[ -n "$z" ]]; then
    import -window "$z" "$out" 2>/dev/null || import -window "$WID" "$out"
  else
    import -window "$WID" "$out"
  fi
  register_shot "$name" "$out"
}

register_shot() {
  local name="$1" out="$2"
  local md5
  md5=$(md5sum "$out" | awk '{print $1}')
  echo "$name $md5" >> "$SHOT_MANIFEST"
  echo "screenshot: $out md5=$md5"
  if [[ -n "$LAST_SHOT_MD5" && "$md5" == "$LAST_SHOT_MD5" ]]; then
    record screenshot-distinct FAIL "consecutive identical md5=$md5 at $name"
    echo "FATAL: screenshot $name is identical to previous step (md5=$md5)" >&2
    exit 1
  fi
  LAST_SHOT_MD5="$md5"
}

shot() {
  shot_app "$1"
}

canvas_center_coords() {
  eval "$(xdotool getwindowgeometry --shell "$WID" 2>/dev/null || echo 'X=0 Y=0 WIDTH=1024 HEIGHT=768')"
  echo "$((X + WIDTH / 2)) $((Y + HEIGHT / 2 + 40))"
}

right_click_pan_drag() {
  local cx cy x y i
  read -r cx cy <<< "$(canvas_center_coords)"
  xdotool windowactivate --sync "$WID" 2>/dev/null || true
  api_post "/api/e2e/focus-canvas" '{}' >/dev/null || true
  sleep 0.2
  xdotool mousemove --window "$WID" "$cx" "$cy"
  sleep 0.05
  xdotool mousedown 3
  for i in $(seq 1 30); do
    x=$((cx + i * 10))
    y=$((cy + i * 6))
    xdotool mousemove --window "$WID" "$x" "$y"
    sleep 0.015
  done
  xdotool mouseup 3
  sleep 0.3
}

img_mean() {
  convert "$1" -colorspace Gray -format '%[mean]' info: 2>/dev/null || echo "0"
}

json_file_has() {
  local file="$1" pattern="$2"
  grep -q "$pattern" "$file" 2>/dev/null
}

inspect_py() {
  python3 -c "
import json, sys
j = json.load(sys.stdin)
s = j.get('state') or {}
$1
"
}

element_count() {
  python3 -c "
import json
j=json.load(open('$1'))
print(len([e for e in j.get('elements',[]) if not e.get('isDeleted')]))
"
}

wait_api() {
  local base="$1"
  for _ in $(seq 1 120); do
    if curl -sf "$base/api/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

api_shortcut() {
  curl -sf -X POST "$BASE/api/e2e/shortcut" \
    -H 'content-type: application/json' \
    -d "$1" >/dev/null
}

api_post() {
  local path="$1" body="$2"
  curl -sf -X POST "$BASE$path" -H 'content-type: application/json' -d "$body"
}

api_inspect() {
  curl -sf "$BASE/api/e2e/inspect"
}

stop_app() {
  if [[ -n "${BASE:-}" ]]; then
    curl -sf -X POST "$BASE/api/quit" >/dev/null 2>&1 || true
    sleep 1.2
  fi
  kill "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
  sleep 0.8
}

wait_zenity() {
  local tries="${1:-40}"
  for _ in $(seq 1 "$tries"); do
    local z
    z=$(xdotool search --class "Zenity" 2>/dev/null | head -1 || true)
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
    z=$(xdotool search --class "Zenity" 2>/dev/null | head -1 || true)
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

zenity_click_save() {
  local z="$1"
  xdotool windowactivate "$z" 2>/dev/null || true
  sleep 0.2
  local btn
  btn=$(xdotool search --onlyvisible --name "Save" 2>/dev/null | head -1 || true)
  if [[ -n "$btn" ]]; then
    xdotool windowactivate "$btn" 2>/dev/null || true
    xdotool click --clearmodifiers 1
    return 0
  fi
  xdotool key --window "$z" Return
}

zenity_save_path() {
  local z="$1" path="$2"
  local base
  base=$(basename "$path")
  xdotool windowactivate --sync "$z" 2>/dev/null || xdotool windowactivate "$z" 2>/dev/null || true
  sleep 0.45
  xdotool key --window "$z" --clearmodifiers ctrl+l 2>/dev/null || true
  sleep 0.15
  xdotool key --window "$z" --clearmodifiers ctrl+a 2>/dev/null || true
  sleep 0.1
  if [[ "$(dirname "$path")" == "$(dirname "$EDITED")" ]]; then
    xdotool type --delay 8 --clearmodifiers --window "$z" "$base"
  else
    xdotool type --delay 8 --clearmodifiers --window "$z" "$path"
  fi
  sleep 0.25
  xdotool key --window "$z" --clearmodifiers Return
  sleep 0.5
  local z2
  z2=$(wait_zenity 15 || true)
  if [[ -n "$z2" && "$z2" != "$z" ]]; then
    xdotool key --window "$z2" --clearmodifiers Return
    sleep 0.35
  fi
}

exec > >(tee -a "$LOG") 2>&1
echo "=== GUI v2 $TAG $(date -Iseconds) ==="

deno run -A "$ROOT/scripts/create-e2e-fixture.ts" >/dev/null
WORK="$ROOT/test-fixtures/e2e-export"
WORK_ABS="$(cd "$WORK" && pwd)"
EDITED="$WORK_ABS/gui-v2-${TAG}.excalidraw"
SAVE_AS="$WORK_ABS/gui-v2-save-as-${TAG}.excalidraw"
EXPORT_PNG="$WORK_ABS/gui-v2-export-${TAG}.png"
MARKER="E2E_EDIT_${TAG}"
EXT_MARKER="E2E_EXTERNAL_${TAG}"
STICKY_MARKER="E2E_STICKY_${TAG}"

rm -f "$EDITED" "$SAVE_AS" "$EXPORT_PNG"
cp -f "$DOC" "$EDITED"

if command -v openbox >/dev/null 2>&1; then
  openbox >/dev/null 2>&1 &
  sleep 0.4
fi

export EXCALIDRAW_E2E=1
export LIBGL_ALWAYS_SOFTWARE=1
export MESA_GL_VERSION_OVERRIDE=3.3

APP_LOG="$ARTIFACTS/logs/app.stdout"
rm -f "$APP_LOG"
bash "$LAUNCHER" "$EDITED" >"$APP_LOG" 2>&1 &
APP_PID=$!

cleanup() {
  kill "$APP_PID" 2>/dev/null || true
  pkill -f 'zenity --' 2>/dev/null || true
}
trap cleanup EXIT

PORT=""
for _ in $(seq 1 120); do
  PORT=$(grep -oE 'Listening on http://127.0.0.1:[0-9]+' "$APP_LOG" 2>/dev/null | head -1 | grep -oE '[0-9]+$' || true)
  [[ -n "$PORT" ]] && break
  sleep 0.25
done
[[ -n "$PORT" ]] || { record boot FAIL "no listen port"; exit 1; }
BASE="http://127.0.0.1:$PORT"
wait_api "$BASE" || { record boot FAIL "health timeout"; exit 1; }
record boot PASS "$BASE"

sleep 2
WID=$(xdotool search --name "Excalidraw Offline" 2>/dev/null | head -1 || true)
[[ -n "$WID" ]] || WID=$(xdotool search --name Excalidraw 2>/dev/null | head -1 || true)
[[ -n "$WID" ]] || { record open-render FAIL "no window"; exit 1; }
xdotool windowactivate --sync "$WID" 2>/dev/null || xdotool windowactivate "$WID" 2>/dev/null || true
api_post "/api/e2e/focus-canvas" '{}' >/dev/null || true
shot "01-open-document"
record open-render PASS "wid=$WID"

# --- Ctrl+S ---
HASH_BEFORE=$(sha256sum "$EDITED" | awk '{print $1}')
api_post "/api/e2e/edit-marker" "$(printf '{"marker":"%s"}' "$MARKER")" >/dev/null
sleep 0.5
api_shortcut '{"key":"s","ctrlKey":true}'
sleep 2.5
HASH_AFTER=$(sha256sum "$EDITED" | awk '{print $1}')
json_file_has "$EDITED" "$MARKER" && HAS_MARKER=1 || HAS_MARKER=0
if [[ "$HASH_BEFORE" != "$HASH_AFTER" && "$HAS_MARKER" -eq 1 ]]; then
  record ctrl-s-save PASS "hash changed + marker in file"
else
  record ctrl-s-save FAIL "before=$HASH_BEFORE after=$HASH_AFTER marker=$HAS_MARKER"
fi
shot "02-after-ctrl-s"

stop_app
APP_LOG="$ARTIFACTS/logs/app-reopen.stdout"
bash "$LAUNCHER" "$EDITED" >"$APP_LOG" 2>&1 &
APP_PID=$!
PORT=""
for _ in $(seq 1 80); do
  PORT=$(grep -oE 'Listening on http://127.0.0.1:[0-9]+' "$APP_LOG" 2>/dev/null | head -1 | grep -oE '[0-9]+$' || true)
  [[ -n "$PORT" ]] && break
  sleep 0.2
done
BASE="http://127.0.0.1:$PORT"
wait_api "$BASE"
sleep 2
WID=$(xdotool search --name "Excalidraw Offline" 2>/dev/null | head -1 || true)
json_file_has "$EDITED" "$MARKER" && record reopen-shows-edit PASS "$MARKER" || record reopen-shows-edit FAIL "marker missing"
shot "03-reopen-after-save"

OPEN_FILE="$EDITED"

# --- Reload clean (external edit) — before Save As changes the active path ---
deno run -A "$ROOT/scripts/e2e-patch-external-marker.ts" "$OPEN_FILE" "$EXT_MARKER" >/dev/null
sleep 0.3
api_post "/api/e2e/focus-canvas" '{}' >/dev/null || true
api_shortcut '{"key":"r","ctrlKey":true}'
sleep 2
INS=$(api_inspect)
if echo "$INS" | grep -q "$EXT_MARKER"; then
  record reload-clean PASS "visible after reload"
else
  record reload-clean FAIL "inspect=$INS"
fi
shot "05-after-reload-clean"

# --- Reload dirty + Discard ---
api_post "/api/e2e/edit-marker" "$(printf '{"marker":"%s"}' "E2E_DIRTY_${TAG}")" >/dev/null
for _ in $(seq 1 30); do
  D=$(api_inspect | inspect_py "print(1 if s.get('dirty') else 0)")
  [[ "$D" == "1" ]] && break
  sleep 0.15
done
api_shortcut '{"key":"r","ctrlKey":true}'
sleep 0.8
Z=$(wait_zenity 30 || true)
if [[ -n "$Z" ]]; then
  shot_zenity "06-reload-unsaved-prompt"
  ZTITLE=$(xdotool getwindowname "$Z" 2>/dev/null || true)
  record reload-unsaved-prompt PASS "zenity title=$ZTITLE"
  zenity_click_discard "$Z"
  wait_zenity_gone 40 || force_dismiss_zenity
  sleep 1.5
  record reload-discard PASS "clicked discard"
else
  shot_app "06-reload-no-prompt"
  record reload-unsaved-prompt FAIL "no zenity"
  record reload-discard FAIL "skipped"
fi

# --- Reload dirty + Save (separate marker) ---
sleep 1.5
api_post "/api/e2e/edit-marker" "$(printf '{"marker":"%s"}' "E2E_DIRTY_SAVE_${TAG}")" >/dev/null
for _ in $(seq 1 30); do
  D=$(api_inspect | inspect_py "print(1 if s.get('dirty') else 0)")
  [[ "$D" == "1" ]] && break
  sleep 0.15
done
api_shortcut '{"key":"r","ctrlKey":true}'
sleep 0.8
Z=$(wait_zenity 30 || true)
if [[ -n "$Z" ]]; then
  zenity_click_save "$Z"
  wait_zenity_gone 40 || force_dismiss_zenity
  for _ in $(seq 1 40); do
    json_file_has "$OPEN_FILE" "E2E_DIRTY_SAVE_${TAG}" && break
    sleep 0.25
  done
  sleep 2
  INS=$(api_inspect)
  if json_file_has "$OPEN_FILE" "E2E_DIRTY_SAVE_${TAG}" || echo "$INS" | grep -q "E2E_DIRTY_SAVE_${TAG}"; then
    record reload-save PASS "dirty saved (file or scene)"
  else
    record reload-save FAIL "marker not persisted"
  fi
else
  record reload-save FAIL "no prompt"
fi

# --- Save As (after reload tests; updates active document path) ---
api_post "/api/e2e/focus-canvas" '{}' >/dev/null || true
api_shortcut '{"key":"s","ctrlKey":true,"shiftKey":true}'
sleep 1.5
Z=$(wait_zenity 40 || true)
if [[ -n "$Z" ]]; then
  shot_zenity "04-save-as-zenity-dialog"
  for _ in $(seq 1 24); do
    PICK_RESP=$(api_post "/api/e2e/complete-pick" "$(printf '{"path":"%s"}' "$SAVE_AS")" || true)
    echo "$PICK_RESP" | grep -q '"completed":true' && break
    sleep 0.25
  done
  pkill -f 'zenity --file-selection' 2>/dev/null || true
  force_dismiss_zenity
  for _ in $(seq 1 40); do
    [[ -f "$SAVE_AS" ]] && break
    sleep 0.25
  done
  sleep 1
  TITLE=$(xdotool getwindowname "$WID" 2>/dev/null || true)
  if [[ -f "$SAVE_AS" ]]; then
    OPEN_FILE="$SAVE_AS"
    record save-as PASS "file=$SAVE_AS title=$TITLE"
  else
    record save-as FAIL "zenity ok but file missing"
  fi
else
  shot_app "04-save-as-no-zenity"
  record save-as FAIL "zenity not shown"
fi

# --- Export image + native PNG picker ---
force_dismiss_zenity
api_post "/api/e2e/focus-canvas" '{}' >/dev/null || true
api_shortcut '{"key":"e","ctrlKey":true,"shiftKey":true}'
sleep 1.2
INS=$(api_inspect)
echo "$INS" | grep -q imageExport && DIALOG_OK=1 || DIALOG_OK=0
shot "07-export-image-dialog"
if [[ "$DIALOG_OK" -eq 1 ]]; then
  record export-dialog-open PASS "openDialog=imageExport"
else
  record export-dialog-open FAIL "$INS"
fi
rm -f "$EXPORT_PNG"
EXPORT_BASE=$(basename "$EXPORT_PNG")
api_post "/api/e2e/export/save-png" "$(printf '{"filename":"%s"}' "$EXPORT_BASE")" >/dev/null &
sleep 2
Z=$(wait_zenity 60 || true)
if [[ -n "$Z" ]]; then
  shot_zenity "08-export-png-zenity"
  for _ in $(seq 1 24); do
    PICK_RESP=$(api_post "/api/e2e/complete-pick" "$(printf '{"path":"%s"}' "$EXPORT_PNG")" || true)
    echo "$PICK_RESP" | grep -q '"completed":true' && break
    sleep 0.25
  done
  pkill -f 'zenity --file-selection' 2>/dev/null || true
  force_dismiss_zenity
  for _ in $(seq 1 40); do
    [[ -f "$EXPORT_PNG" ]] && break
    sleep 0.25
  done
  sleep 1
  if [[ -f "$EXPORT_PNG" ]]; then
    record export-png-save PASS "$EXPORT_PNG"
  else
    record export-png-save FAIL "picker ok, file missing last=$PICK_RESP"
  fi
else
  record export-png-save FAIL "export zenity missing"
fi

api_shortcut '{"key":"Escape"}'
sleep 0.4
force_dismiss_zenity

# --- Dark mode ---
MEAN_LIGHT=$(img_mean "$ARTIFACTS/screenshots/01-open-document.png")
api_post "/api/e2e/toggle-dark" '{}' >/dev/null
sleep 0.8
shot "09-dark-mode"
MEAN_DARK=$(img_mean "$ARTIFACTS/screenshots/09-dark-mode.png")
INS=$(api_inspect)
THEME=$(echo "$INS" | inspect_py "print(s.get('theme',''), end='')")
if [[ "$THEME" == "dark" ]] && awk -v a="$MEAN_DARK" -v b="$MEAN_LIGHT" 'BEGIN{exit !(a+0 < b+0 - 500)}'; then
  record dark-mode PASS "theme=$THEME mean_dark=$MEAN_DARK mean_light=$MEAN_LIGHT"
else
  record dark-mode FAIL "theme=$THEME mean_dark=$MEAN_DARK mean_light=$MEAN_LIGHT"
fi

# --- Sticky note (version gated; toolbar shortcut N + canvas click) ---
force_dismiss_zenity
api_post "/api/e2e/focus-canvas" '{}' >/dev/null || true
api_shortcut '{"key":"n"}'
sleep 0.6
read -r STICKY_X STICKY_Y <<< "$(canvas_center_coords)"
xdotool mousemove --window "$WID" "$STICKY_X" "$STICKY_Y"
sleep 0.1
xdotool click --window "$WID" --clearmodifiers 1
sleep 0.8
xdotool type --delay 6 --clearmodifiers "$STICKY_MARKER"
sleep 0.3
api_shortcut '{"key":"Escape"}'
sleep 0.4
api_shortcut '{"key":"s","ctrlKey":true}'
sleep 2.5
HAS_STICKY=0
json_file_has "$OPEN_FILE" '"type": "stickynote"' && HAS_STICKY=1
json_file_has "$OPEN_FILE" 'stickynote' && HAS_STICKY=1
json_file_has "$OPEN_FILE" "$STICKY_MARKER" && HAS_STICKY=1
shot_app "10-sticky-note"
if [[ "$EXPECT_STICKY" == "1" ]]; then
  if [[ "$HAS_STICKY" -eq 1 ]]; then
    stop_app
    APP_LOG="$ARTIFACTS/logs/app-sticky-reopen.stdout"
    bash "$LAUNCHER" "$OPEN_FILE" >"$APP_LOG" 2>&1 &
    APP_PID=$!
    PORT=""
    for _ in $(seq 1 80); do
      PORT=$(grep -oE 'Listening on http://127.0.0.1:[0-9]+' "$APP_LOG" 2>/dev/null | head -1 | grep -oE '[0-9]+$' || true)
      [[ -n "$PORT" ]] && break
      sleep 0.2
    done
    BASE="http://127.0.0.1:$PORT"
    wait_api "$BASE"
    sleep 2
    STICKY_RENDER=$(api_inspect | inspect_py "types=s.get('elementTypes') or []; print(1 if 'stickynote' in types else 0)")
    shot "10b-sticky-after-reopen"
    if [[ "$STICKY_RENDER" == "1" ]]; then
      record sticky-note PASS "stickynote in file + renders after reopen"
    else
      record sticky-note FAIL "on disk but not in scene after reopen"
    fi
  else
    record sticky-note FAIL "expected stickynote element"
  fi
else
  if [[ "$HAS_STICKY" -eq 0 ]]; then
    record sticky-note PASS "absent on old pin (expected)"
  else
    record sticky-note FAIL "unexpected stickynote on old pin"
  fi
fi

# --- Right-click pan (real X11 input; upstream threshold 5px, Linux contextmenu on press) ---
force_dismiss_zenity
api_shortcut '{"key":"Escape"}' 2>/dev/null || true
sleep 0.3
SCROLL1=$(api_inspect | inspect_py "print(f\"{s.get('scrollX',0)},{s.get('scrollY',0)}\")")
if [[ "$EXPECT_RCLICK_PAN" == "1" ]]; then
  api_shortcut '{"key":"v"}'
  sleep 0.25
  right_click_pan_drag
else
  right_click_pan_drag
fi
sleep 0.8
SCROLL2=$(api_inspect | inspect_py "print(f\"{s.get('scrollX',0)},{s.get('scrollY',0)}\")")
shot_app "11-right-click-pan"
DELTA=$(python3 -c "a,b=map(float,'$SCROLL1'.split(',')); c,d=map(float,'$SCROLL2'.split(',')); print(abs(c-a)+abs(d-b))")
if [[ "$EXPECT_RCLICK_PAN" == "1" ]]; then
  awk -v d="$DELTA" 'BEGIN{exit !(d+0 > 0.5)}' && record right-click-pan PASS "scroll delta=$DELTA ($SCROLL1 -> $SCROLL2)" || record right-click-pan FAIL "delta=$DELTA (xdotool RMB drag; upstream AppPan secondary threshold=5px)"
else
  awk -v d="$DELTA" 'BEGIN{exit !(d+0 < 1.0)}' && record right-click-pan PASS "no pan on old pin delta=$DELTA" || record right-click-pan FAIL "unexpected pan delta=$DELTA on old"
fi

stop_app
trap - EXIT

{
  echo "# GUI v2 summary ($TAG)"
  echo ""
  echo "| Check | Status | Detail |"
  echo "|-------|--------|--------|"
  while IFS='|' read -r n s d; do
    echo "| $n | $s | $d |"
  done < "$RESULTS"
  echo ""
  echo "## Screenshot MD5"
  echo ""
  echo "| Step | MD5 |"
  echo "|------|-----|"
  while read -r step md5; do
    [[ -n "$step" ]] && echo "| $step | $md5 |"
  done < "$SHOT_MANIFEST"
} > "$SUMMARY"
echo "Wrote $SUMMARY"
