#!/usr/bin/env bash
# Lean Linux tarball (Deno-release style): binary + bundled frontend/dist, no WebKit in payload.
# Requires system webkit2gtk-4.1 + GTK3 (Arch/Ubuntu packages).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/tauri-linux"
STAGING="$OUT/staging"
PAYLOAD="$STAGING/payload"
rm -rf "$OUT"
mkdir -p "$PAYLOAD/resources"

export PATH="${HOME}/.deno/bin:${PATH}"
cd "$ROOT/frontend"
deno install --quiet 2>/dev/null || true
deno task build

cd "$ROOT/src-tauri"
cargo build --release --quiet

cp "$ROOT/src-tauri/target/release/excalidraw-offline" "$PAYLOAD/"
cp -a "$ROOT/frontend/dist/." "$PAYLOAD/resources/"

# Wrapper like Deno self-extract layout: small dir + payload.tar.xz
mkdir -p "$OUT/excalidraw-offline-tauri"
tar -cJf "$OUT/excalidraw-offline-tauri/payload.tar.xz" -C "$PAYLOAD" .
cat > "$OUT/excalidraw-offline-tauri/excalidraw-offline" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/excalidraw-offline-tauri"
mkdir -p "$CACHE"
if [[ ! -x "$CACHE/excalidraw-offline" ]]; then
  rm -rf "$CACHE"/*
  tar -xJf "$DIR/payload.tar.xz" -C "$CACHE"
fi
exec "$CACHE/excalidraw-offline" "$@"
WRAP
chmod +x "$OUT/excalidraw-offline-tauri/excalidraw-offline"

XZ="$OUT/excalidraw-offline-tauri-0.7.2-linux-x86_64.tar.xz"
tar -cJf "$XZ" -C "$OUT" excalidraw-offline-tauri

echo "Created $XZ ($(stat -c%s "$XZ") bytes)"
ls -lh "$XZ" "$OUT/excalidraw-offline-tauri/payload.tar.xz"
