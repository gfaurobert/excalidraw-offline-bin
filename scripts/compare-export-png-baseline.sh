#!/usr/bin/env bash
set -euo pipefail
OLD_DIR="${1:-/opt/cursor/artifacts/excalidraw-upgrade/old/export-matrix/pngs}"
NEW_DIR="${2:-/opt/cursor/artifacts/excalidraw-upgrade/new/export-matrix/pngs}"
OUT="${3:-/opt/cursor/artifacts/excalidraw-upgrade/png-compare.md}"

{
  echo "# Export PNG baseline comparison"
  echo ""
  echo "| PNG | Old dims | New dims | Pixel diff (RMSE) | Status |"
  echo "|-----|----------|----------|-------------------|--------|"
  for old in "$OLD_DIR"/*.png; do
    base=$(basename "$old")
    new="$NEW_DIR/$base"
    if [[ ! -f "$new" ]]; then
      echo "| $base | $(identify -format '%wx%h' "$old") | missing | — | FAIL |"
      continue
    fi
    od=$(identify -format '%wx%h' "$old")
    nd=$(identify -format '%wx%h' "$new")
    if [[ "$od" != "$nd" ]]; then
      echo "| $base | $od | $nd | dims differ | FAIL |"
      continue
    fi
    rmse=$(compare -metric RMSE "$old" "$new" null: 2>&1 || true)
    st=PASS
    if [[ "$rmse" != "0 (0)" && "$rmse" != "0" ]]; then
      st="DIFF"
    fi
    echo "| $base | $od | $nd | $rmse | $st |"
  done
} > "$OUT"
echo "Wrote $OUT"
