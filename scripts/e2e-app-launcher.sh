#!/usr/bin/env bash
# Build under /tmp and run the self-extracting launcher (headless E2E).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.deno/bin:${PATH:-}:${ROOT}/frontend/node_modules/.bin"
cd "$ROOT"
OUT="${EXCALIDRAW_E2E_OUTPUT:-/tmp/excalidraw-offline-e2e/excalidraw-offline}"
rm -rf "$(dirname "$OUT")"
deno desktop -A --backend=webview \
  --include=./frontend/dist \
  --include=./icons \
  --include=./skills \
  --output="$OUT" \
  ./desktop/main.ts
exec "$OUT/excalidraw-offline" "$@"
