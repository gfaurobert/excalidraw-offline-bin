#!/usr/bin/env bash
# Full CLI export E2E matrix (requires xvfb-run, webkit2gtk, imagemagick).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARTIFACTS="${ARTIFACTS:-/opt/cursor/artifacts/export-e2e}"
PNG_DIR="$ARTIFACTS/pngs"
mkdir -p "$PNG_DIR" "$ARTIFACTS/logs"
LOG="$ARTIFACTS/matrix.log"
SUMMARY="$ARTIFACTS/summary-table.md"
ERROR_LOG="$ARTIFACTS/error-messages.log"
: > "$LOG"
: > "$ARTIFACTS/results.tsv"
: > "$ERROR_LOG"

exec > >(tee -a "$LOG") 2>&1

echo "=== E2E export matrix $(date -Iseconds) ==="

rm -rf dist "$ARTIFACTS/custom-out"
deno run -A ./scripts/create-e2e-fixture.ts
DOC="$ROOT/test-fixtures/e2e-export/matrix-demo.excalidraw"
LAUNCHER="$ROOT/dist/linux/excalidraw-offline/excalidraw-offline"
OUT_DIR="$ARTIFACTS/custom-out"
mkdir -p "$OUT_DIR"
rm -f "$PNG_DIR"/*

echo "==> Pre-build (clean dist)"
deno task build:frontend
deno desktop -A --backend=webview \
  --include=./frontend/dist --include=./icons --include=./skills \
  --output=./dist/linux/excalidraw-offline ./desktop/main.ts

xvfb-run -a "$LAUNCHER" export "$DOC" >/dev/null

record() {
  local name="$1" ec="$2" cmd="$3" outfile="$4" dims="$5"
  printf '%s|%s|%s|%s|%s\n' "$name" "$ec" "$cmd" "$outfile" "$dims" >> "$ARTIFACTS/results.tsv"
}

png_dims() { identify -format '%wx%h' "$1" 2>/dev/null || echo "n/a"; }

copy_artifact() {
  local dest="$1"
  local src="$2"
  if [[ ! -f "$src" ]]; then
    echo "FAIL: missing PNG for $dest: $src"
    return 1
  fi
  cp -f "$src" "$PNG_DIR/$dest"
  echo "artifact: $PNG_DIR/$dest ($(png_dims "$src"), $(stat -c%s "$src") bytes)"
}

# Outside-only red (#ffc9c9) must not appear in a frame clip export.
verify_frame_clip_no_outside_red() {
  local png="$1"
  local label="$2"
  local red_frac
  red_frac=$(convert "$png" -alpha off -fuzz 12% -fill black -opaque '#ffc9c9' \
    -fill white +opaque black -format '%[fx:1-mean]' info: 2>/dev/null || echo "1")
  echo "frame-clip-check $label: outside-red pixel fraction=$red_frac (expect < 0.02)"
  awk -v r="$red_frac" 'BEGIN { exit (r + 0 < 0.02) ? 0 : 1 }' || {
    echo "FAIL: outside-only red (#ffc9c9) visible in frame clip $png"
    return 1
  }
}

verify_dashboard_has_inner_yellow() {
  local png="$1"
  local yellow_frac
  yellow_frac=$(convert "$png" -alpha off -fuzz 12% -fill black -opaque '#ffec99' \
    -fill white +opaque black -format '%[fx:1-mean]' info: 2>/dev/null || echo "0")
  echo "dashboard-content-check: inner yellow pixel fraction=$yellow_frac (expect > 0.02)"
  awk -v y="$yellow_frac" 'BEGIN { exit (y + 0 > 0.02) ? 0 : 1 }' || {
    echo "FAIL: expected yellow (#ffec99) shape inside Dashboard frame in $png"
    return 1
  }
}

run_bin() {
  local name="$1"
  shift
  local logbase="$ARTIFACTS/logs/$name"
  echo "" >&2
  echo "--- $name ---" >&2
  echo "bin export $*" >&2
  set +e
  xvfb-run -a "$LAUNCHER" export "$DOC" "$@" >"${logbase}.stdout" 2>"${logbase}.stderr"
  local ec=$?
  set -e
  cat "${logbase}.stdout" "${logbase}.stderr" >&2 || true
  mapfile -t paths < <(grep -E '^/' "${logbase}.stdout" 2>/dev/null | tr -d '\r' || true)
  local outpath=""
  if ((${#paths[@]} > 0)); then
    outpath="${paths[${#paths[@]}-1]}"
  fi
  local dims="n/a"
  if [[ -n "$outpath" && -f "$outpath" ]]; then
    dims=$(png_dims "$outpath")
  fi
  record "$name" "$ec" "excalidraw-offline export … $*" "$outpath" "$dims"
  [[ "$ec" -eq 0 ]] || return "$ec"
  printf '%s\n' "${paths[@]}"
}

run_deno_export() {
  local name="$1"
  shift
  local logbase="$ARTIFACTS/logs/$name"
  echo "" >&2
  echo "--- $name ---" >&2
  echo "deno task export -- … $*" >&2
  set +e
  xvfb-run -a bash -lc "cd \"$ROOT\" && deno task export -- \"$DOC\" $(printf '%q ' "$@")" \
    >"${logbase}.stdout" 2>"${logbase}.stderr"
  local ec=$?
  set -e
  cat "${logbase}.stdout" "${logbase}.stderr" >&2 || true
  mapfile -t paths < <(grep -E '^/' "${logbase}.stdout" 2>/dev/null | tr -d '\r' || true)
  local outpath=""
  if ((${#paths[@]} > 0)); then
    outpath="${paths[${#paths[@]}-1]}"
  fi
  local dims="n/a"
  if [[ -n "$outpath" && -f "$outpath" ]]; then
    dims=$(png_dims "$outpath")
  fi
  record "$name" "$ec" "deno task export -- … $*" "$outpath" "$dims"
  [[ "$ec" -eq 0 ]] || return "$ec"
  printf '%s\n' "${paths[@]}"
}

extract_error_message() {
  local logbase="$1"
  {
    grep -E 'Export failed:|^Usage:|^Frame not found|^Element not found|cannot read|No elements intersect|Frame not found|Element not found|not an .excalidraw|missing file' \
      "${logbase}.stderr" 2>/dev/null || true
    grep -E 'Export failed:|^Usage:|Frame not found|Element not found|cannot read' \
      "${logbase}.stdout" 2>/dev/null || true
  } | head -5 | tr '\n' ' '
}

expect_fail() {
  local name="$1"
  shift
  local logbase="$ARTIFACTS/logs/$name"
  set +e
  xvfb-run -a bash -lc "cd \"$ROOT\" && deno task export -- $(printf '%q ' "$@")" \
    >"${logbase}.stdout" 2>"${logbase}.stderr"
  local ec=$?
  set -e
  local err_msg
  err_msg=$(extract_error_message "$logbase")
  if [[ -z "$err_msg" ]]; then
    err_msg=$(tail -3 "${logbase}.stderr" 2>/dev/null | tr '\n' ' ')
  fi
  echo "ERROR CASE $name exit=$ec message: ${err_msg}"
  {
    echo "=== $name (exit $ec) ==="
    echo "stderr:"
    cat "${logbase}.stderr" 2>/dev/null || true
    echo "stdout:"
    cat "${logbase}.stdout" 2>/dev/null || true
    echo ""
  } >> "$ERROR_LOG"
  record "$name" "$ec" "deno task export (expect fail) $*" "$err_msg" "n/a"
  [[ "$ec" -ne 0 ]] || { echo "expected failure"; return 1; }
}

# --- Success cases ---

p=$(run_deno_export "deno-task-whole-scene" | tail -1)
copy_artifact "deno-task-whole-scene.png" "$p"

p=$(run_bin "binary-whole-scene-abs" | tail -1)
copy_artifact "binary-whole-scene-abs.png" "$p"

p=$(run_bin "frame-special-name" --frame 'UI "mock" / v2' | tail -1)
copy_artifact "frame-special-name-ui-mock.png" "$p"
verify_frame_clip_no_outside_red "$PNG_DIR/frame-special-name-ui-mock.png" "ui-mock"

mapfile -t fr_paths < <(run_bin "frame-repeatable" --frame "Dashboard" --frame 'UI "mock" / v2')
[[ ${#fr_paths[@]} -ge 2 ]] || { echo "FAIL: frame-repeatable expected 2 paths, got ${#fr_paths[@]}"; exit 1; }
copy_artifact "frame-repeatable-dashboard.png" "${fr_paths[0]}"
verify_frame_clip_no_outside_red "$PNG_DIR/frame-repeatable-dashboard.png" "dashboard-repeatable"
verify_dashboard_has_inner_yellow "$PNG_DIR/frame-repeatable-dashboard.png"
copy_artifact "frame-repeatable-ui-mock.png" "${fr_paths[1]}"
verify_frame_clip_no_outside_red "$PNG_DIR/frame-repeatable-ui-mock.png" "ui-mock-repeatable"

mapfile -t af_paths < <(run_bin "all-frames" --all-frames)
[[ ${#af_paths[@]} -ge 2 ]] || { echo "FAIL: all-frames expected 2 paths, got ${#af_paths[@]}"; exit 1; }
af_dash="" af_mock=""
for path in "${af_paths[@]}"; do
  base=$(basename "$path")
  if [[ "$base" == *Dashboard* ]]; then af_dash="$path"
  elif [[ "$base" == *mock* ]]; then af_mock="$path"
  fi
done
copy_artifact "all-frames-dashboard.png" "$af_dash"
verify_frame_clip_no_outside_red "$PNG_DIR/all-frames-dashboard.png" "dashboard-all-frames"
verify_dashboard_has_inner_yellow "$PNG_DIR/all-frames-dashboard.png"
copy_artifact "all-frames-ui-mock.png" "$af_mock"
verify_frame_clip_no_outside_red "$PNG_DIR/all-frames-ui-mock.png" "ui-mock-all-frames"

p=$(run_bin "element-single" --element rect-outside-id | tail -1)
copy_artifact "element-single.png" "$p"

p=$(run_bin "element-multi" --element rect-outside-id --element text-outside-id | tail -1)
copy_artifact "element-multi.png" "$p"

p=$(run_bin "bbox" --bbox 500,340,220,200 | tail -1)
copy_artifact "bbox.png" "$p"

p=$(run_bin "out-dir" --out "$OUT_DIR" --scale 1 | tail -1)
copy_artifact "out-dir.png" "$p"

run_bin "out-file" --element rect-outside-id --out "$OUT_DIR/single-export.png" >/dev/null
copy_artifact "out-file-single-export.png" "$OUT_DIR/single-export.png"

run_bin "scale-1" --out "$PNG_DIR/scale-whole-1.png" --scale 1 >/dev/null
run_bin "scale-3" --out "$PNG_DIR/scale-whole-3.png" --scale 3 >/dev/null
D1=$(png_dims "$PNG_DIR/scale-whole-1.png")
D3=$(png_dims "$PNG_DIR/scale-whole-3.png")
record "scale-compare" "0" "whole scene --scale 1 vs 3" "scale-whole-1.png / scale-whole-3.png" "$D1 vs $D3"
[[ "$D1" != "$D3" ]]

run_bin "json" --element rect-outside-id --json >/dev/null
json_line=$(grep -E '^\{' "$ARTIFACTS/logs/json.stdout" | tail -1 || true)
p=""
if [[ -n "$json_line" ]]; then
  p=$(printf '%s' "$json_line" | deno eval -A \
    "const j=JSON.parse(await new Response(Deno.stdin.readable).text()); console.log(j.paths[0]);" 2>/dev/null || true)
fi
[[ -n "$p" && -f "$p" ]] && copy_artifact "json-element-export.png" "$p"

expect_fail "err-missing-file" "/tmp/no-such-drawing.excalidraw"
expect_fail "err-unknown-frame" "$DOC" --frame "NoSuchFrame"
expect_fail "err-unknown-element" "$DOC" --element "no-such-element-id"
expect_fail "err-empty-bbox" "$DOC" --bbox 9000,9000,10,10

echo "--- deno-task-start-smoke ---"
set +e
timeout 8 xvfb-run -a bash -lc "cd \"$ROOT\" && deno task start" \
  >"$ARTIFACTS/logs/start.stdout" 2>"$ARTIFACTS/logs/start.stderr"
START_EC=$?
set -e
record "deno-task-start" "$START_EC" "deno task start (8s timeout)" "" "n/a"
grep -E 'Running|HMR|error|LAUFEY|Listening' "$ARTIFACTS/logs/start.stdout" || true

{
  echo "# Export E2E summary"
  echo ""
  echo "| Case | Exit | Output / message | Dimensions |"
  echo "|------|------|------------------|------------|"
  while IFS='|' read -r name ec cmd out dims; do
    echo "| $name | $ec | \`${out:-—}\` | ${dims} |"
  done < "$ARTIFACTS/results.tsv"
  echo ""
  echo "## Artifact PNGs"
  echo ""
  ls -1 "$PNG_DIR" | while read -r f; do echo "- \`$PNG_DIR/$f\`"; done
  echo ""
  echo "## Expected error cases (stderr)"
  echo ""
  if [[ -f "$ERROR_LOG" ]]; then
    echo '```'
    cat "$ERROR_LOG"
    echo '```'
  fi
} > "$SUMMARY"

echo "Wrote $SUMMARY and $ERROR_LOG"
echo "PNG count: $(ls -1 "$PNG_DIR" | wc -l)"
echo "DONE"
