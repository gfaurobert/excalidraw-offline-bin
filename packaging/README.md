# Packaging

## Linux (Tauri 2)

### Local checkout (`PKGBUILD.local`) — recommended on Arch

No AUR account required. From the `packaging/` directory:

```bash
# Prereqs: base-devel (makepkg -s pulls rust >= 1.90, nodejs, pnpm, webkit2gtk-4.1, gtk3)
cd packaging
makepkg -si -f -p PKGBUILD.local
```

`-s` installs deps, `-i` installs the built package. `PKGBUILD.local` builds the parent checkout (frontend with pnpm, then `cargo build --release --features tauri/custom-protocol`).

Install layout:

- `/usr/bin/excalidraw-offline` (single binary, frontend embedded)
- `/usr/share/applications/excalidraw-offline.desktop`
- `/usr/share/mime/packages/application-x-excalidraw.xml`
- `/usr/share/icons/hicolor/128x128/apps/excalidraw-offline.png`

Uninstall: `sudo pacman -Rns excalidraw-offline`.

### Release `PKGBUILD` (AUR-ready)

Same build from the GitHub source archive of tag `v$pkgver`. Published as a release asset next to the AppImage and the prebuilt `.pkg.tar.zst`.
Keep `pkgver` in `PKGBUILD` / `PKGBUILD.local` equal to the version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`; the release script refuses a mismatch.

### GitHub Release assets

`.github/workflows/release-linux.yml` (tag `v*`, or manual run = dry run without publishing):

| Asset | Built by |
|-------|----------|
| `excalidraw-offline-<ver>-linux-x86_64.AppImage` | Tauri bundler on Ubuntu 22.04 (`scripts/package-tauri-linux-release.sh`), smoke-tested on `/api/health` |
| `excalidraw-offline-<ver>-1-x86_64.pkg.tar.zst` | `makepkg` in an `archlinux` container, checked with `namcap` |
| `PKGBUILD`, `SHA256SUMS` | |

Local release-shaped AppImage (needs `cargo install tauri-cli`):

```bash
./scripts/package-tauri-linux-release.sh
# → dist/release/
```

## Windows 11

GitHub Releases publish a portable zip and an NSIS installer (`excalidraw-offline-<ver>-windows-x86_64-*`) via `.github/workflows/release-windows.yml`.

Local build (on Windows, MSVC + WebView2):

```bash
cd frontend && pnpm install --frozen-lockfile && pnpm run build && cd ..
cd src-tauri && cargo tauri build --target x86_64-pc-windows-msvc --config tauri.windows.ci.json
# → target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe
# → target/x86_64-pc-windows-msvc/release/excalidraw-offline.exe (portable)
```

Runtime on the target PC: WebView2. Native file dialogs use Win32 via `rfd`.

## macOS (Apple Silicon + universal)

GitHub Releases publish universal and arm64 zips of the `.app` via `.github/workflows/release-macos.yml` (built on `macos-14`, ad-hoc signed).

Local build:

```bash
cd frontend && pnpm install --frozen-lockfile && pnpm run build && cd ..
cd src-tauri
cargo tauri build --target aarch64-apple-darwin --config tauri.macos.ci.json
cargo tauri build --target universal-apple-darwin --config tauri.macos.ci.json
```

Runtime: WKWebView (system). Unsigned/ad-hoc builds show a Gatekeeper warning on first launch.
