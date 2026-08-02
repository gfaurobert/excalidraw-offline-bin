---
title: Install
nav_order: 2
---

# Install

## Requirements

- Deno **≥ 2.9** (`deno desktop`) for development and packaging
- Runtime: `webkit2gtk-4.1`, `gtk3`, `zenity` (or `kdialog`)

## Linux (GitHub Releases)

Download from [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases):

- **AppImage** — `excalidraw-offline-<version>-linux-x86_64.AppImage` (`chmod +x`, then run)
- **Binary tarball** — `excalidraw-offline-<version>-linux-x86_64.tar.xz` (extract and run `./excalidraw-offline`; built with `--compress=xz`, so the archive contains the launcher plus `payload.tar.xz` — a Deno Desktop self-extracting layout — not an expanded `.so`/icons tree)

Runtime deps: `webkit2gtk-4.1`, `gtk3`, and `zenity` (or `kdialog`).

Maintainers: tagging `vX.Y.Z` (matching `deno.json` version) runs `.github/workflows/release-linux.yml`. Local dry-run: `deno task package:release`.

## Arch Linux (makepkg)

Install from a local git checkout with `packaging/PKGBUILD.local`:

```bash
# Prereqs: base-devel, deno ≥ 2.9
cd packaging
makepkg -si -f -p PKGBUILD.local
```

`-s` pulls runtime/build deps, `-i` installs the package. No GitHub release or AUR account needed.

Installs:

- `/usr/bin/excalidraw-offline`
- `/usr/lib/excalidraw-offline/` (bundled binary + payload)
- `/usr/share/applications/excalidraw-offline.desktop`
- `/usr/share/icons/hicolor/128x128/apps/excalidraw-offline.png`

Uninstall: `sudo pacman -Rns excalidraw-offline`.

`packaging/PKGBUILD` is an optional AUR/release-tarball template for later; skip it until you publish.
