#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.deno/bin:${PATH:-}"

ARTIFACTS="${ARTIFACTS:-/opt/cursor/artifacts/skill-install-e2e}"
LAUNCHER="${LAUNCHER:-$ROOT/dist/linux/excalidraw-offline/excalidraw-offline}"

if [[ ! -x "$LAUNCHER" ]]; then
  echo "Building packaged app…"
  deno task package:linux
fi

E2E_HOME=$(mktemp -d /tmp/excal-skill-home-XXXXXX)
PROJECT_ROOT=$(mktemp -d /tmp/excal-skill-project-XXXXXX)
mkdir -p "$ARTIFACTS"

export ROOT LAUNCHER ARTIFACTS E2E_HOME PROJECT_ROOT
chmod +x "$ROOT/scripts/e2e-skill-install-driver.sh"

echo "Artifacts: $ARTIFACTS"
echo "Temp HOME: $E2E_HOME"

xvfb-run -a bash "$ROOT/scripts/e2e-skill-install-driver.sh"

echo "--- global-all tree ---"
cat "$ARTIFACTS/trees/global-all.txt" || true
echo "--- project tree ---"
cat "$ARTIFACTS/trees/project-agents-claude.txt" || true
