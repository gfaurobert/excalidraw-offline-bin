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
for other in "$(cargo_version)" "$(pkgbuild_version packaging/PKGBUILD)" "$(pkgbuild_version packaging/PKGBUILD.local)" "$(pkgbuild_version packaging/PKGBUILD-bin)"; do
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

echo "==> Linux binary tarball (Arch PKGBUILD-bin + portable usr tree)"
STAGE="$OUT/stage"
rm -rf "$STAGE"
mkdir -p "$STAGE/usr/bin" "$STAGE/usr/share/applications" "$STAGE/usr/share/mime/packages" \
  "$STAGE/usr/share/icons/hicolor/128x128/apps" "$STAGE/usr/share/licenses/excalidraw-offline"
install -Dm755 src-tauri/target/release/excalidraw-offline "$STAGE/usr/bin/excalidraw-offline"
install -Dm644 packaging/excalidraw-offline.desktop "$STAGE/usr/share/applications/excalidraw-offline.desktop"
install -Dm644 packaging/application-x-excalidraw.xml "$STAGE/usr/share/mime/packages/application-x-excalidraw.xml"
install -Dm644 icons/icon.png "$STAGE/usr/share/icons/hicolor/128x128/apps/excalidraw-offline.png"
install -Dm644 LICENSE "$STAGE/usr/share/licenses/excalidraw-offline/LICENSE"
TARBALL_NAME="excalidraw-offline-${VERSION}-linux-x86_64.tar.gz"
tar -C "$STAGE" -czf "$OUT/$TARBALL_NAME" usr
rm -rf "$STAGE"

echo "==> PKGBUILD assets"
cp packaging/PKGBUILD "$OUT/PKGBUILD"
cp packaging/PKGBUILD-bin "$OUT/PKGBUILD-bin"
TARBALL_SHA=$(sha256sum "$OUT/$TARBALL_NAME" | awk '{print $1}')
sed -i "s/^sha256sums=('.*')/sha256sums=('${TARBALL_SHA}')/" "$OUT/PKGBUILD-bin"

(cd "$OUT" && sha256sum "$APPIMAGE_NAME" "$TARBALL_NAME" PKGBUILD PKGBUILD-bin > SHA256SUMS)
ls -la "$OUT"
