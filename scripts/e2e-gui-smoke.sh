#!/usr/bin/env bash
# GUI smoke E2E for Excalidraw Offline (xvfb-run + xdotool + import).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TAG="${1:-old}"
ARTIFACTS="${ARTIFACTS:-/opt/cursor/artifacts/excalidraw-upgrade/$TAG/gui}"
LAUNCHER="${LAUNCHER:-$ROOT/dist/linux/excalidraw-offline/excalidraw-offline}"
DOC="${DOC:-$ROOT/test-fixtures/e2e-export/matrix-demo.excalidraw}"
LOG="$ARTIFACTS/gui.log"
RESULTS="$ARTIFACTS/results.tsv"
SUMMARY="$ARTIFACTS/summary.md"

mkdir -p "$ARTIFACTS/screenshots"
: > "$LOG"
: > "$RESULTS"

export LIBGL_ALWAYS_SOFTWARE=1
export MESA_GL_VERSION_OVERRIDE=3.3

exec > >(tee -a "$LOG") 2>&1

record() {
  local name="$1" status="$2" detail="$3"
  printf '%s|%s|%s\n' "$name" "$status" "$detail" >> "$RESULTS"
}

echo "=== GUI smoke $TAG $(date -Iseconds) ==="
echo "launcher=$LAUNCHER doc=$DOC"

if [[ ! -x "$LAUNCHER" ]]; then
  echo "Building launcher…"
  deno task package:linux
fi

set +e
xvfb-run -a "$LAUNCHER" --help >"$ARTIFACTS/help-top.txt" 2>&1
HEC=$?
xvfb-run -a "$LAUNCHER" export --help >"$ARTIFACTS/help-export.txt" 2>&1
EEC=$?
set -e
[[ $HEC -eq 0 && -s "$ARTIFACTS/help-top.txt" ]] && record help-top PASS "$ARTIFACTS/help-top.txt" || record help-top FAIL "exit=$HEC"
[[ $EEC -eq 0 && -s "$ARTIFACTS/help-export.txt" ]] && record help-export PASS "$ARTIFACTS/help-export.txt" || record help-export FAIL "exit=$EEC"

deno run -A ./scripts/create-e2e-fixture.ts >/dev/null
WORK="$ROOT/test-fixtures/e2e-export"
EDITED="$WORK/gui-edited.excalidraw"
SAVE_AS="$WORK/gui-save-as.excalidraw"
rm -f "$EDITED" "$SAVE_AS"
cp -f "$DOC" "$EDITED"

export ROOT LAUNCHER EDITED SAVE_AS WORK ARTIFACTS TAG

xvfb-run -a bash "$ROOT/scripts/e2e-gui-smoke-xvfb.sh"

{
  echo "# GUI smoke summary ($TAG)"
  echo ""
  echo "| Check | Status | Detail |"
  echo "|-------|--------|--------|"
  while IFS='|' read -r name st det; do
    echo "| $name | $st | ${det} |"
  done < "$RESULTS"
  echo ""
  echo "## Screenshots"
  ls -1 "$ARTIFACTS/screenshots" 2>/dev/null | while read -r f; do
    echo "- \`$ARTIFACTS/screenshots/$f\`"
  done
} > "$SUMMARY"

echo "Wrote $SUMMARY"
echo "DONE GUI $TAG"
