#!/usr/bin/env bash
# Lean Linux tarball: release binary + bundled frontend/dist in payload.tar.xz (system WebKit required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(scripts/release-version.sh)"
PAYLOAD="$ROOT/dist/tauri-linux-payload"
OUT="$ROOT/dist/tauri-linux-lean"
rm -rf "$PAYLOAD" "$OUT"
mkdir -p "$PAYLOAD" "$OUT"

echo "==> frontend"
(cd frontend && CI=true pnpm install --frozen-lockfile && pnpm run build)

echo "==> release binary"
RUSTFLAGS=-D warnings cargo build --release --manifest-path src-tauri/Cargo.toml
cp "$ROOT/src-tauri/target/release/excalidraw-offline" "$PAYLOAD/"

mkdir -p "$PAYLOAD/resources"
cp -a frontend/dist "$PAYLOAD/resources/"

TAR="$OUT/excalidraw-offline-${VERSION}-linux-x86_64-payload.tar.xz"
tar -C "$PAYLOAD" -cJf "$TAR" .
ls -lh "$TAR"
