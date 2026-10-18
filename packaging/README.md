# Packaging

## Linux (Tauri 2)

### Prebuilt binary (`PKGBUILD-bin`) — recommended on Arch

No compiler or Node toolchain required. From `packaging/`:

```bash
makepkg -si -f -p PKGBUILD-bin
```

Installs package `excalidraw-offline-bin`, which **provides** / **conflicts with** `excalidraw-offline`. Payload: GitHub Release `excalidraw-offline-<ver>-linux-x86_64.tar.gz`.

### Local source checkout (`PKGBUILD.local`)

For developers with **rustup** (or pacman `rust`) and **pnpm via mise/corepack/npm** — no pacman `pnpm` or `rust>=1.90` makedepends:

```bash
# makepkg -s installs nodejs + runtime GTK/WebKit deps only
cd packaging
makepkg -si -f -p PKGBUILD.local
```

Builds in a copy under `$srcdir` (excludes `frontend/node_modules` and `src-tauri/target`) so a root-owned `node_modules` from Docker does not cause EACCES.

### Release `PKGBUILD` (AUR-ready)

Same source build from the GitHub archive of tag `v$pkgver`. Published as a release asset.

Keep `pkgver` in `PKGBUILD` / `PKGBUILD.local` / `PKGBUILD-bin` equal to `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`; `scripts/package-tauri-linux-release.sh` refuses a mismatch.

Shared build helpers: [`pkgbuild-common.sh`](pkgbuild-common.sh) (`ensure_rust_toolchain`, `run_pnpm`, etc.).

### GitHub Release assets

`.github/workflows/release-linux.yml` (tag `v*`):

| Asset | Built by |
|-------|----------|
| `excalidraw-offline-<ver>-linux-x86_64.AppImage` | Tauri bundler on Ubuntu 22.04 |
| `excalidraw-offline-<ver>-linux-x86_64.tar.gz` | `scripts/package-tauri-linux-release.sh` (usr tree for PKGBUILD-bin) |
| `excalidraw-offline-<ver>-1-x86_64.pkg.tar.zst` | `makepkg` source package in Arch container (rustup) |
| `PKGBUILD`, `PKGBUILD-bin`, `SHA256SUMS` | |

Local release-shaped build:

```bash
./scripts/package-tauri-linux-release.sh
# → dist/release/
```

Verify Arch packaging in Docker:

```bash
./scripts/verify-arch-packaging.sh
```

## Windows 11

GitHub Releases publish a portable zip and an NSIS installer via `.github/workflows/release-windows.yml`.

## macOS (Apple Silicon + universal)

GitHub Releases publish universal and arm64 zips via `.github/workflows/release-macos.yml`.
