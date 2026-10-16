#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARTIFACTS="${ARTIFACTS:-/opt/cursor/artifacts/skill-install-e2e}"
LAUNCHER="${LAUNCHER:-$ROOT/src-tauri/target/release/excalidraw-offline}"

if [[ ! -x "$LAUNCHER" ]]; then
  echo "Building release binary…"
  (cd frontend && CI=true pnpm install --frozen-lockfile && pnpm run build)
  RUSTFLAGS=-D warnings cargo build --release --manifest-path src-tauri/Cargo.toml
fi

E2E_HOME=$(mktemp -d /tmp/excal-skill-home-XXXXXX)
PROJECT_ROOT=$(mktemp -d /tmp/excal-skill-project-XXXXXX)
mkdir -p "$ARTIFACTS"

export ROOT LAUNCHER ARTIFACTS E2E_HOME PROJECT_ROOT
chmod +x "$ROOT/scripts/e2e-skill-install-driver.sh"

echo "Artifacts: $ARTIFACTS"
echo "Temp HOME: $E2E_HOME"

xvfb-run -a bash "$ROOT/scripts/e2e-skill-install-driver.sh"

echo "--- global before ---"
cat "$ARTIFACTS/trees/global-before.txt" || true
echo "--- global after ---"
cat "$ARTIFACTS/trees/global-after.txt" || true
echo "--- project tree ---"
cat "$ARTIFACTS/trees/project-agents-claude.txt" || true
