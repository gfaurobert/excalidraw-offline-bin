# Packaging

## Local checkout (`PKGBUILD.local`) — recommended

No AUR account required. From the `packaging/` directory:

```bash
# Prereqs: base-devel, deno ≥ 2.9
cd packaging
makepkg -si -f -p PKGBUILD.local
```

`-s` installs deps, `-i` installs the built package. `PKGBUILD.local` builds the parent checkout (`$startdir/..`).

Install layout:

- `/usr/bin/excalidraw-offline`
- `/usr/lib/excalidraw-offline/`
- `/usr/share/applications/excalidraw-offline.desktop`
- `/usr/share/mime/packages/application-x-excalidraw.xml`
- `/usr/share/icons/hicolor/128x128/apps/excalidraw-offline.png`

Uninstall: `sudo pacman -Rns excalidraw-offline`.

## AUR (`PKGBUILD`) — optional later

Template for publishing from a tagged GitHub release tarball (`v$pkgver`).

Update `url`, `source`, and `sha256sums` before submitting to the AUR.

## Manual Deno Desktop bundle

```bash
deno task package:linux
# → dist/linux/excalidraw-offline/  (~24MB with --compress=xz on x86_64)
```

Runtime depends: `webkit2gtk-4.1`, `gtk3`, `zenity` (or `kdialog`).

File dialogs use zenity/kdialog because Deno Desktop does not yet expose a native file-picker API.

## GitHub Release binaries

Tagged releases publish an AppImage and a binary `.tar.xz` (plus `SHA256SUMS`) via CI.
Those are for direct download / portable use.

The `.tar.xz` is built with `--compress=xz`: after extract you get the launcher script plus `payload.tar.xz` (Deno Desktop self-extracting layout), not an expanded `.so`/icons tree. Run `./excalidraw-offline`.

makepkg and the AUR `PKGBUILD` still **build from source** (git checkout or GitHub source archive for `v$pkgver`). They do not install the Release AppImage.

Local release-shaped artifacts (same names as CI):

```bash
deno task package:release
# → dist/release/
```

## Windows 11

GitHub Releases also publish an MSI and a zip (`excalidraw-offline-<ver>-windows-x86_64.*`) via `.github/workflows/release-windows.yml`. Those artifacts are cross-compiled from Linux (`--target x86_64-pc-windows-msvc`).

```bash
deno task package:windows
# → dist/windows/excalidraw-offline/

deno task package:windows:release
# → dist/release-windows/  (MSI + zip + SHA256SUMS-windows-x86_64)
```

Runtime on the target PC: WebView2 + PowerShell. File dialogs use WinForms because Deno Desktop does not yet expose a native file-picker API.

## macOS (Apple Silicon)

GitHub Releases also publish a DMG and a zip of the `.app` (`excalidraw-offline-<ver>-macos-arm64.*`) via `.github/workflows/release-macos.yml`. Those artifacts are built on `macos-latest` (`--target aarch64-apple-darwin`) because `.dmg` needs `hdiutil` and the Info.plist patch is re-signed with ad-hoc `codesign`.

```bash
deno task package:macos
# → dist/macos/excalidraw-offline.app

deno task package:macos:release
# → dist/release-macos/  (DMG + zip + SHA256SUMS-macos-arm64; DMG only on Darwin)
```

Runtime on the Mac: WKWebView + `osascript`. File dialogs use AppleScript because Deno Desktop does not yet expose a native file-picker API. Unsigned/ad-hoc builds show a Gatekeeper warning.

