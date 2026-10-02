#!/usr/bin/env bash
# Full CLI export E2E matrix (requires xvfb-run, webkit2gtk, imagemagick).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARTIFACTS="${ARTIFACTS:-/opt/cursor/artifacts/export-e2e}"
mkdir -p "$ARTIFACTS/pngs" "$ARTIFACTS/logs"
LOG="$ARTIFACTS/matrix.log"
SUMMARY="$ARTIFACTS/summary-table.md"
: > "$LOG"
: > "$ARTIFACTS/results.tsv"

exec > >(tee -a "$LOG") 2>&1

echo "=== E2E export matrix $(date -Iseconds) ==="

rm -rf dist "$ARTIFACTS/custom-out"
deno run -A ./scripts/create-e2e-fixture.ts
DOC="$ROOT/test-fixtures/e2e-export/matrix-demo.excalidraw"
LAUNCHER="$ROOT/dist/linux/excalidraw-offline/excalidraw-offline"
OUT_DIR="$ARTIFACTS/custom-out"
mkdir -p "$OUT_DIR"

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

run_bin() {
  local name="$1"
  shift
  local logbase="$ARTIFACTS/logs/$name"
  echo ""
  echo "--- $name ---"
  echo "bin export $*"
  set +e
  xvfb-run -a "$LAUNCHER" export "$DOC" "$@" >"${logbase}.stdout" 2>"${logbase}.stderr"
  local ec=$?
  set -e
  cat "${logbase}.stdout" "${logbase}.stderr" || true
  local outpath
  outpath=$(tail -1 "${logbase}.stdout" 2>/dev/null | tr -d '\r' || true)
  local dims="n/a"
  if [[ -f "$outpath" ]]; then
    dims=$(png_dims "$outpath")
    cp -f "$outpath" "$ARTIFACTS/pngs/${name}-$(basename "$outpath")"
  fi
  record "$name" "$ec" "excalidraw-offline export … $*" "$outpath" "$dims"
  [[ "$ec" -eq 0 ]] || return "$ec"
}

run_deno_export() {
  local name="$1"
  shift
  local logbase="$ARTIFACTS/logs/$name"
  echo ""
  echo "--- $name ---"
  echo "deno task export -- … $*"
  set +e
  xvfb-run -a bash -lc "cd \"$ROOT\" && deno task export -- \"$DOC\" $(printf '%q ' "$@")" \
    >"${logbase}.stdout" 2>"${logbase}.stderr"
  local ec=$?
  set -e
  cat "${logbase}.stdout" "${logbase}.stderr" || true
  local outpath
  outpath=$(grep -E '^/' "${logbase}.stdout" | tail -1 | tr -d '\r' || true)
  local dims="n/a"
  if [[ -f "$outpath" ]]; then
    dims=$(png_dims "$outpath")
    cp -f "$outpath" "$ARTIFACTS/pngs/${name}-$(basename "$outpath")"
  fi
  record "$name" "$ec" "deno task export -- … $*" "$outpath" "$dims"
  [[ "$ec" -eq 0 ]] || return "$ec"
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
  echo "ERROR CASE $name exit=$ec"
  cat "${logbase}.stderr" || true
  record "$name" "$ec" "deno task export (expect fail) $*" "" "n/a"
  [[ "$ec" -ne 0 ]] || { echo "expected failure"; return 1; }
}

run_deno_export "deno-task-whole-scene"
run_bin "binary-whole-scene-abs"
run_bin "frame-special-name" --frame 'UI "mock" / v2'
run_bin "frame-repeatable" --frame "Dashboard" --frame 'UI "mock" / v2'
run_bin "all-frames" --all-frames
run_bin "element-single" --element rect-outside-id
run_bin "element-multi" --element rect-outside-id --element text-outside-id
run_bin "bbox" --bbox 500,340,220,200
run_bin "out-dir" --out "$OUT_DIR" --scale 1
run_bin "out-file" --element rect-outside-id --out "$OUT_DIR/single-export.png"

SCALE1="$ARTIFACTS/pngs/scale-whole-1.png"
SCALE3="$ARTIFACTS/pngs/scale-whole-3.png"
rm -f "$SCALE1" "$SCALE3"
run_bin "scale-1" --out "$SCALE1" --scale 1
run_bin "scale-3" --out "$SCALE3" --scale 3
D1=$(png_dims "$SCALE1")
D3=$(png_dims "$SCALE3")
record "scale-compare" "0" "whole scene --scale 1 vs 3" "$SCALE1 / $SCALE3" "$D1 vs $D3"
[[ "$D1" != "$D3" ]]

run_bin "json" --element rect-outside-id --json
JSON_LINE=$(grep -E '^\{' "$ARTIFACTS/logs/json.stdout" | tail -1)
deno eval -A "JSON.parse(Deno.args[0])" "$JSON_LINE"

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
grep -E 'Running|HMR|error|LAUFEY|Listening' "$ARTIFACTS/logs/start.stderr" || true

{
  echo "# Export E2E summary"
  echo ""
  echo "| Case | Exit | Output file | Dimensions |"
  echo "|------|------|-------------|------------|"
  while IFS='|' read -r name ec cmd out dims; do
    echo "| $name | $ec | \`${out:-—}\` | ${dims} |"
  done < "$ARTIFACTS/results.tsv"
} > "$SUMMARY"

echo "Wrote $SUMMARY"
echo "DONE"
