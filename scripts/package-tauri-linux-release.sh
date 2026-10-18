#!/usr/bin/env bash
# Build the Linux release artifacts for the Tauri 2 app:
#   dist/release/excalidraw-offline-<ver>-linux-x86_64.AppImage  (Tauri bundler)
#   dist/release/PKGBUILD                                         (Arch, builds tag v<ver> from source)
# Prereqs: pnpm, Rust >= 1.90, tauri-cli 2 (`cargo tauri`), WebKitGTK 4.1 / GTK 3 dev packages.
# RELEASE_VERSION (e.g. v0.8.0 from a tag) must match src-tauri/tauri.conf.json + Cargo.toml.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

conf_version() { sed -nE 's/^\s*"version":\s*"([^"]+)".*/\1/p' src-tauri/tauri.conf.json | head -1; }
cargo_version() { sed -nE 's/^version\s*=\s*"([^"]+)".*/\1/p' src-tauri/Cargo.toml | head -1; }
pkgbuild_version() { sed -nE 's/^pkgver=(.+)$/\1/p' "$1"; }

VERSION="$(conf_version)"
for other in "$(cargo_version)" "$(pkgbuild_version packaging/PKGBUILD)" "$(pkgbuild_version packaging/PKGBUILD.local)"; do
  if [[ "$other" != "$VERSION" ]]; then
    echo "error: version mismatch: tauri.conf.json=$VERSION vs $other (Cargo.toml / PKGBUILD / PKGBUILD.local)" >&2
    exit 1
  fi
done
if [[ -n "${RELEASE_VERSION:-}" && "${RELEASE_VERSION#v}" != "$VERSION" ]]; then
  echo "error: tag ${RELEASE_VERSION} does not match app version $VERSION" >&2
  exit 1
fi
echo "version=$VERSION"

OUT="$ROOT/dist/release"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> frontend"
(cd frontend && CI=true pnpm install --frozen-lockfile && pnpm run build)

echo "==> AppImage (tauri bundler)"
(cd src-tauri && cargo tauri build --bundles appimage --config '{"build":{"beforeBuildCommand":""}}')
APPIMAGE_SRC="$(ls src-tauri/target/release/bundle/appimage/*.AppImage | head -1)"
APPIMAGE_NAME="excalidraw-offline-${VERSION}-linux-x86_64.AppImage"
cp "$APPIMAGE_SRC" "$OUT/$APPIMAGE_NAME"
chmod +x "$OUT/$APPIMAGE_NAME"

echo "==> PKGBUILD"
cp packaging/PKGBUILD "$OUT/PKGBUILD"

(cd "$OUT" && sha256sum "$APPIMAGE_NAME" PKGBUILD > SHA256SUMS)
ls -la "$OUT"
