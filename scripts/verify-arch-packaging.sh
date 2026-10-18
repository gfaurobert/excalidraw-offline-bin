#!/usr/bin/env bash
# Verify Arch PKGBUILD.local (rustup, no pacman pnpm) and PKGBUILD-bin in a clean archlinux container.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${ARCH_IMAGE:-archlinux:latest}"

echo "==> Docker: $IMAGE"
docker run --rm -i \
  -v "$ROOT:/src:ro" \
  -e SOURCE_ROOT=/src \
  "$IMAGE" bash -s <<'EOF'
set -euo pipefail
pacman -Syu --noconfirm --needed base-devel git nodejs curl \
  webkit2gtk-4.1 gtk3 libsoup3 hicolor-icon-theme shared-mime-info desktop-file-utils

useradd -m builder
cp -a /src /home/builder/ws
chown -R builder /home/builder/ws

su builder -c 'curl -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.90.0'
su builder -c 'source ~/.cargo/env && corepack enable && corepack prepare pnpm@10 --activate'

echo "==> PKGBUILD.local (makepkg -s, no --nodeps)"
cd /home/builder/ws/packaging
su builder -c 'source ~/.cargo/env && makepkg -sf -p PKGBUILD.local --noconfirm' 2>&1 | tee /tmp/makepkg-local.log
if grep -qE '(^|\s)WARNING' /tmp/makepkg-local.log; then
  echo "makepkg reported warnings" >&2
  exit 1
fi

pkgver="$(sed -nE 's/^pkgver=(.+)$/\1/p' PKGBUILD-bin)"
TARBALL_NAME="excalidraw-offline-${pkgver}-linux-x86_64.tar.gz"
TARBALL="/src/dist/release/${TARBALL_NAME}"
if [[ ! -f "$TARBALL" ]]; then
  echo "==> Downloading release tarball v${pkgver}"
  curl -fsSL -o "$TARBALL_NAME" \
    "https://github.com/gfaurobert/excalidraw-offline-bin/releases/download/v${pkgver}/${TARBALL_NAME}"
else
  cp "$TARBALL" "$TARBALL_NAME"
fi
cp PKGBUILD-bin .
sha="$(sha256sum "$TARBALL_NAME" | awk '{print $1}')"
sed -i "s/^sha256sums=('.*')/sha256sums=('${sha}')/" PKGBUILD-bin

echo "==> PKGBUILD-bin"
su builder -c 'makepkg -f -p PKGBUILD-bin --noconfirm'
pacman -U --noconfirm excalidraw-offline-bin-*.pkg.tar.zst
excalidraw-offline --help | head -3
echo OK
EOF
