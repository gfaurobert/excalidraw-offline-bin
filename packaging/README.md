# Packaging

## AUR (`PKGBUILD`)

Template for publishing from a tagged GitHub release tarball (`v$pkgver`).

Update `url`, `source`, and `sha256sums` before submitting to the AUR.

## Local checkout (`PKGBUILD.local`)

From the repository root:

```bash
makepkg -f -p packaging/PKGBUILD.local
```

## Manual Deno Desktop bundle

```bash
deno task package:linux
# → dist/linux/excalidraw-offline/  (~24MB with --compress=xz on x86_64)
```

Runtime depends: `webkit2gtk-4.1`, `gtk3`, `zenity` (or `kdialog`).

File dialogs use zenity/kdialog because Deno Desktop does not yet expose a native file-picker API.
