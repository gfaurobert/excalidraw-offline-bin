---
title: Install
nav_order: 2
---

# Install

**Status:** the **Tauri 2** app is end-to-end tested on Linux, Windows 11, and macOS (universal). It is not in a GitHub release yet — use CI artifacts or build from source below. After the Tauri release is tagged, the [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases) page will list AppImage + Arch package (Linux), portable zip + NSIS installer (Windows), and universal + arm64 zips (macOS).

## Requirements

| OS | Runtime |
|----|---------|
| **Linux** | WebKitGTK 4.1 + GTK 3 (no zenity/kdialog needed) |
| **Windows 11** | WebView2 (preinstalled) |
| **macOS 11+** | WKWebView (system); universal binary for Apple Silicon and Intel |

### Arch
```shell
sudo pacman -S --needed webkit2gtk-4.1 gtk3
```
### Debian / Ubuntu
```shell
sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0
```
### Fedora
```shell
sudo dnf install webkit2gtk4.1 gtk3
```

## CI artifacts (until release)

| Platform | Workflow | Artifact contents |
|----------|----------|-------------------|
| **Windows 11 x64** | [Release Windows](https://github.com/gfaurobert/excalidraw-offline-bin/actions/workflows/release-windows.yml) | `excalidraw-offline-<ver>-windows-x86_64-portable.zip` + `*-setup.exe` |
| **macOS** | [Release macOS](https://github.com/gfaurobert/excalidraw-offline-bin/actions/workflows/release-macos.yml) | `excalidraw-offline-<ver>-macos-universal.zip` + `excalidraw-offline-<ver>-macos-arm64.zip` |
| **Linux x86_64** | [Release Linux](https://github.com/gfaurobert/excalidraw-offline-bin/actions/workflows/release-linux.yml) (manual run) | `linux-appimage-<version>`: AppImage + `PKGBUILD`; `linux-arch-package`: `.pkg.tar.zst` |

**Linux:** `chmod +x excalidraw-offline-*-linux-x86_64.AppImage` and run it, or on Arch `sudo pacman -U excalidraw-offline-*-x86_64.pkg.tar.zst`.

Download artifacts from a green run (GitHub login required), or with the GitHub CLI: `gh run download <run-id> -R gfaurobert/excalidraw-offline-bin -n <artifact>`.

### Windows

Run the NSIS installer, or extract the portable zip and start `Excalidraw-Offline.exe`. The Agent Skill is embedded — no extra files. Unsigned builds may trigger SmartScreen (**More info → Run anyway**).

### macOS

Download `excalidraw-offline-<ver>-macos-universal.zip` or `-macos-arm64.zip`. Extract (Finder, or `ditto -x -k <zip> <dir>`), move **Excalidraw Offline.app** to `/Applications`. The build is **ad-hoc signed** (not notarized). Gatekeeper quarantine from the download often makes the first double-click show **damaged or incomplete** (*« … endommagée ou incomplète »* in French) and a prohibitory badge on the icon — that is not a corrupt zip. Clear quarantine once:

```bash
xattr -cr "/Applications/Excalidraw Offline.app"
```

Then launch from Applications, or right-click → **Open**, or use **System Settings → Privacy & Security → Open Anyway** after macOS blocks a launch.

### CLI examples

| OS | Open a drawing |
|----|----------------|
| Linux | `excalidraw-offline ~/drawings/demo.excalidraw` or `/usr/bin/excalidraw-offline …` |
| Windows | `& '.\Excalidraw-Offline.exe' $env:USERPROFILE\drawings\demo.excalidraw` |
| macOS | `"/Applications/Excalidraw Offline.app/Contents/MacOS/excalidraw-offline" ~/drawings/demo.excalidraw` |

Headless PNG export (all platforms): `excalidraw-offline export --help`

### Where settings live

| OS | Config (recent files) | Logs |
|----|-----------------------|------|
| Linux | `$XDG_CONFIG_HOME/excalidraw-offline/` (fallback `~/.config/excalidraw-offline/`) | `<config>/logs/` |
| Windows | `%USERPROFILE%\.config\excalidraw-offline\` | `%LOCALAPPDATA%\ExcalidrawOffline\logs\` |
| macOS | `~/Library/Application Support/excalidraw-offline/` | `<config>/logs/` |

## Build from source

Prereqs: Node.js + pnpm 10, Rust **≥ 1.90** (the repo pins 1.90.0 in `rust-toolchain.toml`), and platform deps — Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`; Windows: MSVC; macOS: Xcode CLT.

```bash
cd frontend && pnpm install --frozen-lockfile && pnpm run build && cd ..
cd src-tauri && cargo build --release
./target/release/excalidraw-offline
# optional bundles: cargo install tauri-cli --locked --version "^2.0.0" && cargo tauri build
```

The release binary is ~19 MB on Linux (stripped).

## Arch Linux (makepkg)

Build and install from a local git checkout with [`packaging/PKGBUILD.local`](https://github.com/gfaurobert/excalidraw-offline-bin/blob/main/packaging/PKGBUILD.local):

```bash
cd packaging
makepkg -si -f -p PKGBUILD.local
```

Installs `/usr/bin/excalidraw-offline`, `.desktop`, MIME XML, and icon. Uninstall: `sudo pacman -Rns excalidraw-offline`.

[`packaging/PKGBUILD`](https://github.com/gfaurobert/excalidraw-offline-bin/blob/main/packaging/PKGBUILD) builds the same package from the GitHub source archive of tag `v$pkgver` (AUR-ready release asset).
