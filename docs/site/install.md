---
title: Install
nav_order: 2
---

# Install

**Current version:** [v0.7.2](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.7.2) (Linux x86_64 only).

| Platform | Download |
|----------|----------|
| **Linux** | [Latest release](https://github.com/gfaurobert/excalidraw-offline-bin/releases/latest) (v0.7.2: AppImage + tar.xz) |
| **Windows 11** | [v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0) (MSI + zip) — newer Win builds not published yet |
| **macOS arm64** | [v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0) (DMG + zip) — newer mac builds not published yet |

Releases **v0.6.0**, **v0.7.0**, **v0.7.1**, and **v0.7.2** are **Linux-only** (export CLI, `--help`, and Export image dialog are in those Linux builds only until Windows/macOS catch up).

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

Download from [Latest release](https://github.com/gfaurobert/excalidraw-offline-bin/releases/latest) (currently **v0.7.2**):

- **AppImage** — `excalidraw-offline-<version>-linux-x86_64.AppImage` (`chmod +x`, then run). Release builds embed MIME/`%F` in the AppImage desktop entry when `appimagetool` is available during packaging (first-run AppImage integration registers the association).
- **Binary tarball** — `excalidraw-offline-<version>-linux-x86_64.tar.xz` (extract and run `./excalidraw-offline`; built with `--compress=xz`, so the archive contains the launcher plus `payload.tar.xz` — a Deno Desktop self-extracting layout — not an expanded `.so`/icons tree). The portable tarball does **not** register MIME types.

Runtime deps: `webkit2gtk-4.1`, `gtk3`, and `zenity` (or `kdialog`).

Maintainers: tagging `vX.Y.Z` (matching `deno.json` version) runs `.github/workflows/release-linux.yml`. Local dry-run: `deno task package:release`.

## Windows 11 (GitHub Releases)

Download **[v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0)** (not the latest tag — v0.6+ Windows assets were skipped):

- **MSI** — `excalidraw-offline-0.5.0-windows-x86_64.msi`
- **Zip** — `excalidraw-offline-0.5.0-windows-x86_64.zip` (portable)

Runtime: WebView2 (preinstalled on Windows 11) and Windows PowerShell for open/save/unsaved dialogs. Unsigned builds may trigger SmartScreen (**More info → Run anyway**).

The packaged app registers a per-user `.excalidraw` file association on first launch. **File → Reload** (Ctrl+R) is available; **Export image…** and `excalidraw-offline export` arrive in a future Windows release (already on Linux v0.6+).

CLI:

```powershell
excalidraw-offline C:\path\to\drawing.excalidraw
```

Maintainers: tagging `vX.Y.Z` also runs `.github/workflows/release-windows.yml`. Local dry-run: `deno task package:windows:release`.

## macOS Apple Silicon (GitHub Releases)

Download **[v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0)** (not the latest tag — v0.6+ macOS assets were skipped):

- **DMG** — `excalidraw-offline-0.5.0-macos-arm64.dmg` (drag **Excalidraw Offline** to Applications)
- **Zip** — `excalidraw-offline-0.5.0-macos-arm64.zip` (extract the `.app`)

Runtime: WKWebView and `osascript` for open/save/unsaved dialogs. Ad-hoc signed builds hit Gatekeeper (right-click → **Open**, or `xattr -d com.apple.quarantine` on the `.app`).

**File → Reload** (⌘R) is available; **Export image…** and `excalidraw-offline export` arrive in a future macOS release (already on Linux v0.6+).

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
