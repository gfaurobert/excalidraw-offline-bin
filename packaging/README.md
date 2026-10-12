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

## Deno Desktop release workflows (Windows / macOS, not yet converted)

### Windows 11

GitHub Releases also publish an MSI and a zip (`excalidraw-offline-<ver>-windows-x86_64.*`) via `.github/workflows/release-windows.yml`. Those artifacts are cross-compiled from Linux (`--target x86_64-pc-windows-msvc`).

```bash
deno task package:windows
# → dist/windows/excalidraw-offline/

deno task package:windows:release
# → dist/release-windows/  (MSI + zip + SHA256SUMS-windows-x86_64)
```

Runtime on the target PC: WebView2 + PowerShell. File dialogs use WinForms because Deno Desktop does not yet expose a native file-picker API.

### macOS (Apple Silicon)

GitHub Releases also publish a DMG and a zip of the `.app` (`excalidraw-offline-<ver>-macos-arm64.*`) via `.github/workflows/release-macos.yml`. Those artifacts are built on `macos-latest` (`--target aarch64-apple-darwin`) because `.dmg` needs `hdiutil` and the Info.plist patch is re-signed with ad-hoc `codesign`.

```bash
deno task package:macos
# → dist/macos/excalidraw-offline.app

deno task package:macos:release
# → dist/release-macos/  (DMG + zip + SHA256SUMS-macos-arm64; DMG only on Darwin)
```

Runtime on the Mac: WKWebView + `osascript`. File dialogs use AppleScript because Deno Desktop does not yet expose a native file-picker API. Unsigned/ad-hoc builds show a Gatekeeper warning.

