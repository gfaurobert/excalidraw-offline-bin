#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DENO_JSON_VERSION="$(deno eval --quiet '
import { readDenoJsonVersion } from "./scripts/release-names.ts";
console.log(readDenoJsonVersion(await Deno.readTextFile("deno.json")));
')"

if [[ -n "${RELEASE_VERSION:-}" ]]; then
  VERSION="$(deno eval --quiet '
import { stripVPrefix } from "./scripts/release-names.ts";
console.log(stripVPrefix(Deno.args[0]));
' "$RELEASE_VERSION")"
else
  VERSION="$DENO_JSON_VERSION"
fi

deno eval --quiet '
import { assertVersionMatchesTag } from "./scripts/release-names.ts";
assertVersionMatchesTag(Deno.args[0], Deno.args[1] ?? "");
' "$VERSION" "${GITHUB_REF:-}"

if [[ "$VERSION" != "$DENO_JSON_VERSION" ]]; then
  echo "error: RELEASE_VERSION=$VERSION does not match deno.json version=$DENO_JSON_VERSION" >&2
  exit 1
fi

NAMES_JSON="$(deno eval --quiet '
import { artifactBasenames } from "./scripts/release-names.ts";
console.log(JSON.stringify(artifactBasenames(Deno.args[0])));
' "$VERSION")"

APPIMAGE_NAME="$(deno eval --quiet 'console.log(JSON.parse(Deno.args[0]).appImage)' "$NAMES_JSON")"
TARBALL_NAME="$(deno eval --quiet 'console.log(JSON.parse(Deno.args[0]).tarball)' "$NAMES_JSON")"
STAGING_NAME="$(deno eval --quiet 'console.log(JSON.parse(Deno.args[0]).stagingDir)' "$NAMES_JSON")"
SUMS_NAME="$(deno eval --quiet 'console.log(JSON.parse(Deno.args[0]).sums)' "$NAMES_JSON")"

OUT="$ROOT/dist/release"
STAGING="$OUT/staging/$STAGING_NAME"
rm -rf "$OUT"
mkdir -p "$OUT" "$STAGING"

echo "==> installing frontend deps"
(cd frontend && deno install --node-modules-dir=auto)

echo "==> building frontend"
deno task build:frontend

COMMON=(deno desktop -A --backend=webview --compress=xz
  --include=./frontend/dist --include=./icons --include=./skills)

echo "==> AppImage → $APPIMAGE_NAME"
"${COMMON[@]}" --output="$OUT/$APPIMAGE_NAME" ./desktop/main.ts

echo "==> directory bundle → staging"
"${COMMON[@]}" --output="$STAGING/excalidraw-offline" ./desktop/main.ts

# deno desktop may create STAGING/excalidraw-offline/ as a directory; flatten into STAGING.
# Rename first: the launcher inside is also named excalidraw-offline and cannot mv over the dir.
if [[ -d "$STAGING/excalidraw-offline" ]]; then
  BUNDLE_TMP="$STAGING/.deno-desktop-bundle"
  mv "$STAGING/excalidraw-offline" "$BUNDLE_TMP"
  shopt -s dotglob
  mv "$BUNDLE_TMP"/* "$STAGING/"
  rmdir "$BUNDLE_TMP"
  shopt -u dotglob
fi

echo "==> tarball → $TARBALL_NAME"
tar -C "$OUT/staging" -cJf "$OUT/$TARBALL_NAME" "$STAGING_NAME"

rm -rf "$OUT/staging"

# Deno Desktop leaves AppImage intermediate dirs (e.g. excalidraw-offline-0.1/).
find "$OUT" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +

echo "==> checksums"
(
  cd "$OUT"
  sha256sum "$APPIMAGE_NAME" "$TARBALL_NAME" > "$SUMS_NAME"
)

echo "Artifacts in $OUT:"
ls -la "$OUT"
