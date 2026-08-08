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
