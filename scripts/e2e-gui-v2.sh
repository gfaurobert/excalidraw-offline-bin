#!/usr/bin/env bash
# Build (optional) and run GUI v2 E2E for old and/or new Excalidraw pins.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.deno/bin:${PATH:-}"

RUN_OLD="${1:-both}"
ART_ROOT="/opt/cursor/artifacts/excalidraw-upgrade/gui-v2"

build_at_pin() {
  local pin="$1" out="$2"
  echo "==> build excalidraw pin $pin -> $out"
  sed -i "s/\"@excalidraw\\/excalidraw\": \"[^\"]*\"/\"@excalidraw\\/excalidraw\": \"$pin\"/" frontend/package.json
  sed -i "s/export const EXCALIDRAW_VERSION = \"[^\"]*\"/export const EXCALIDRAW_VERSION = \"$pin\"/" desktop/versions.ts
  sed -i "s/assertEquals(EXCALIDRAW_VERSION, \"[^\"]*\"/assertEquals(EXCALIDRAW_VERSION, \"$pin\"/" desktop/versions_test.ts
  (cd frontend && deno install --allow-scripts >/dev/null)
  deno task build:frontend >/dev/null
  deno task package:linux 2>&1 | tail -3
  rm -rf "$out"
  cp -r dist/linux/excalidraw-offline "$out"
  chmod +x "$out/excalidraw-offline" 2>/dev/null || true
}

run_driver() {
  local tag="$1" launcher="$2" expect_sticky="$3" expect_pan="$4"
  export TAG="$tag" ROOT="$ROOT" LAUNCHER="$launcher"
  export ARTIFACTS="$ART_ROOT/$tag"
  export EXPECT_STICKY="$expect_sticky" EXPECT_RCLICK_PAN="$expect_pan"
  mkdir -p "$ARTIFACTS"
  xvfb-run -a bash "$ROOT/scripts/e2e-gui-v2-driver.sh"
}

restore_new_pin() {
  local pin="0.18.0-4ce38fb"
  sed -i "s/\"@excalidraw\\/excalidraw\": \"[^\"]*\"/\"@excalidraw\\/excalidraw\": \"$pin\"/" frontend/package.json
  sed -i "s/export const EXCALIDRAW_VERSION = \"[^\"]*\"/export const EXCALIDRAW_VERSION = \"$pin\"/" desktop/versions.ts
  sed -i "s/assertEquals(EXCALIDRAW_VERSION, \"[^\"]*\"/assertEquals(EXCALIDRAW_VERSION, \"$pin\"/" desktop/versions_test.ts
}

OLD_PIN="0.18.0-4872083"
NEW_PIN="0.18.0-4ce38fb"
OLD_LAUNCHER="$ART_ROOT/build-old/excalidraw-offline"
NEW_LAUNCHER="$ART_ROOT/build-new/excalidraw-offline"

if [[ "$RUN_OLD" == "old" || "$RUN_OLD" == "both" ]]; then
  build_at_pin "$OLD_PIN" "$ART_ROOT/build-old"
  run_driver "old" "$OLD_LAUNCHER" "0" "0"
fi

if [[ "$RUN_OLD" == "new" || "$RUN_OLD" == "both" ]]; then
  build_at_pin "$NEW_PIN" "$ART_ROOT/build-new"
  restore_new_pin
  (cd frontend && deno install --allow-scripts >/dev/null)
  run_driver "new" "$NEW_LAUNCHER" "1" "1"
fi

{
  echo "# GUI v2 old vs new"
  echo ""
  for tag in old new; do
    if [[ -f "$ART_ROOT/$tag/summary.md" ]]; then
      echo "## $tag"
      cat "$ART_ROOT/$tag/summary.md"
      echo ""
    fi
  done
} > "$ART_ROOT/combined-summary.md"

echo "Done. Combined: $ART_ROOT/combined-summary.md"
