# Shared helpers for packaging/PKGBUILD and PKGBUILD.local (source=sourced, not executed).

_min_rust_version='1.90.0'

_pkgbuild_error() {
  printf '==> ERROR: %s\n' "$*" >&2
  return 1
}

ensure_rust_toolchain() {
  if ! command -v cargo >/dev/null 2>&1 || ! command -v rustc >/dev/null 2>&1; then
    _pkgbuild_error \
      "Rust/cargo not found on PATH (install pacman rust, or rustup: https://rustup.rs)"
  fi
  local ver
  ver="$(rustc --version | awk '{print $2}')"
  if [[ "$(printf '%s\n' "$_min_rust_version" "$ver" | sort -V | head -1)" != "$_min_rust_version" ]]; then
    _pkgbuild_error "rustc $ver is too old; need >= $_min_rust_version"
  fi
}

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  elif command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
  else
    _pkgbuild_error \
      "pnpm not found on PATH (install via mise, npm, pacman, or: corepack enable && corepack prepare pnpm@10 --activate)"
  fi
}

# PKGBUILD.local: avoid EACCES on Docker-owned frontend/node_modules in the checkout.
prepare_local_build_tree() {
  local srcroot="$1"
  local destdir="$2"
  if [[ -e "$srcroot/frontend/node_modules" ]] && [[ ! -w "$srcroot/frontend/node_modules" ]]; then
    _pkgbuild_error \
      "$srcroot/frontend/node_modules is not writable (often root-owned from Docker). Remove it or: sudo chown -R \"\$USER\" \"$srcroot/frontend/node_modules\""
  fi
  rm -rf "$destdir"
  mkdir -p "$destdir"
  if git -C "$srcroot" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    # Tracked + new (non-ignored) files only: skips build outputs, node_modules,
    # target dirs and makepkg's own packaging/src (which would copy into itself).
    git -C "$srcroot" ls-files -z --cached --others --exclude-standard \
      | (cd "$srcroot" && tar --null --no-recursion --ignore-failed-read -T - -cf -) \
      | tar -C "$destdir" -xf -
  else
    tar -C "$srcroot" \
      --exclude='./frontend/node_modules' \
      --exclude='./src-tauri/target*' \
      --exclude='./packaging/src' \
      --exclude='./packaging/pkg' \
      --exclude='./packaging/*.pkg.tar.*' \
      --exclude='./dist' \
      --exclude='./.git' \
      -cf - . | tar -C "$destdir" -xf -
  fi
}

excalidraw_offline_build() {
  ensure_rust_toolchain || return 1
  export RUSTFLAGS="${RUSTFLAGS:-} --remap-path-prefix=${PWD}=/build -C link-arg=-Wl,--as-needed"
  (cd frontend && CI=true run_pnpm install --frozen-lockfile && run_pnpm run build) || return 1
  (cd src-tauri && cargo build --release --locked --features tauri/custom-protocol) || return 1
}

excalidraw_offline_package() {
  install -Dm755 src-tauri/target/release/excalidraw-offline \
    "$pkgdir/usr/bin/excalidraw-offline"
  install -Dm644 packaging/excalidraw-offline.desktop \
    "$pkgdir/usr/share/applications/excalidraw-offline.desktop"
  install -Dm644 packaging/application-x-excalidraw.xml \
    "$pkgdir/usr/share/mime/packages/application-x-excalidraw.xml"
  install -Dm644 icons/icon.png \
    "$pkgdir/usr/share/icons/hicolor/128x128/apps/excalidraw-offline.png"
  install -Dm644 LICENSE "$pkgdir/usr/share/licenses/excalidraw-offline/LICENSE"
}
