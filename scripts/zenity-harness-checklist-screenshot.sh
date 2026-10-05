#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS="${ARTIFACTS:-/opt/cursor/artifacts/zenity-checklist-shot}"
mkdir -p "$ARTIFACTS"
export PATH="${HOME}/.deno/bin:${PATH:-}"

if command -v openbox >/dev/null 2>&1; then
  openbox >/dev/null 2>&1 &
  sleep 0.4
fi

exec xvfb-run -a deno run -A "$ROOT/scripts/zenity-harness-checklist-screenshot.ts" "$ARTIFACTS"
