---
title: Install
nav_order: 2
---

# Install

## Requirements
### Arch
```shell
sudo pacman -S --needed webkit2gtk-4.1 gtk3 zenity
```
### Debian / Ubuntu
```shell
sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0 zenity
```

### Fedora
```shell
sudo dnf install webkit2gtk4.1 gtk3 zenity
```

### Qt based Desktop Environment
Replace 'zenity' with 'kdialog'

## Linux (GitHub Releases)

Download from [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases):

- **AppImage** — `excalidraw-offline-<version>-linux-x86_64.AppImage` (`chmod +x`, then run). Release builds embed MIME/`%F` in the AppImage desktop entry when `appimagetool` is available during packaging (first-run AppImage integration registers the association).
- **Binary tarball** — `excalidraw-offline-<version>-linux-x86_64.tar.xz` (extract and run `./excalidraw-offline`; built with `--compress=xz`, so the archive contains the launcher plus `payload.tar.xz` — a Deno Desktop self-extracting layout — not an expanded `.so`/icons tree). The portable tarball does **not** register MIME types.

Runtime deps: `webkit2gtk-4.1`, `gtk3`, and `zenity` (or `kdialog`).

Maintainers: tagging `vX.Y.Z` (matching `deno.json` version) runs `.github/workflows/release-linux.yml`. Local dry-run: `deno task package:release`.

## Windows 11 (GitHub Releases)

Download from [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases):

- **MSI** — `excalidraw-offline-<version>-windows-x86_64.msi`
- **Zip** — `excalidraw-offline-<version>-windows-x86_64.zip` (portable)

Runtime: WebView2 (preinstalled on Windows 11) and Windows PowerShell for open/save/unsaved dialogs. Unsigned builds may trigger SmartScreen (**More info → Run anyway**).

The packaged app registers a per-user `.excalidraw` file association on first launch. CLI:

```powershell
excalidraw-offline C:\path\to\drawing.excalidraw
```

Maintainers: tagging `vX.Y.Z` also runs `.github/workflows/release-windows.yml`. Local dry-run: `deno task package:windows:release`.

## macOS Apple Silicon (GitHub Releases)

Download from [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases):

- **DMG** — `excalidraw-offline-<version>-macos-arm64.dmg` (drag **Excalidraw Offline** to Applications)
- **Zip** — `excalidraw-offline-<version>-macos-arm64.zip` (extract the `.app`)

Runtime: WKWebView and `osascript` for open/save/unsaved dialogs. Builds are **ad-hoc signed** (not notarized). Gatekeeper often blocks the first launch: macOS may claim the app is **damaged or incomplete** (“endommagée ou incomplète”), and Finder may show a prohibitory badge on the icon. That is the quarantine flag from the download, not a corrupt DMG. After dragging to Applications, clear it once:

```bash
xattr -cr "/Applications/Excalidraw Offline.app"
```

Then open the app normally (or right-click → **Open**). Requires **Apple Silicon** (arm64); Intel Macs are not packaged yet.

CLI (pass the drawing as argv; Finder double-click currently only launches the app):

```bash
open -a "Excalidraw Offline" --args ~/drawings/demo.excalidraw
```

Maintainers: tagging `vX.Y.Z` also runs `.github/workflows/release-macos.yml`. Local dry-run on a Mac: `deno task package:macos:release`.

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
- `/usr/share/mime/packages/application-x-excalidraw.xml`
- `/usr/share/icons/hicolor/128x128/apps/excalidraw-offline.png`

Uninstall: `sudo pacman -Rns excalidraw-offline`.

`packaging/PKGBUILD` is an optional AUR/release-tarball template for later; skip it until you publish.
