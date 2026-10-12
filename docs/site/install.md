---
title: Install
nav_order: 2
---

# Install

**Status:** the **Tauri 2** port is end-to-end tested on Linux, Windows 11, and macOS (universal). It is not in a GitHub release yet — releases still ship the previous Deno Desktop builds ([v0.7.2](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.7.2) Linux; [v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0) Windows/macOS). Get Tauri builds from CI artifacts or build from source.

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

## Tauri builds (CI artifacts)

| Platform | Workflow | Artifact contents |
|----------|----------|-------------------|
| **Windows 11 x64** | [Tauri Windows x64 build](https://github.com/gfaurobert/excalidraw-offline-bin/actions/workflows/tauri-windows-build.yml) | `excalidraw-offline-tauri-windows-x64`: NSIS installer (`*-setup.exe`) + `excalidraw-offline-windows-x64-portable.zip` |
| **macOS** | [Tauri macOS build](https://github.com/gfaurobert/excalidraw-offline-bin/actions/workflows/tauri-macos-build.yml) | `excalidraw-offline-tauri-macos`: `excalidraw-offline-macos-universal.zip` + `excalidraw-offline-macos-arm64.zip` |
| **Linux** | — | [Build from source](#build-from-source) (`cargo tauri build` also makes an AppImage and `.deb`) |

Download artifacts from a green run (GitHub login required), or with the GitHub CLI: `gh run download <run-id> -R gfaurobert/excalidraw-offline-bin -n <artifact>`.

### Windows

Run the installer, or extract the portable zip and start `Excalidraw-Offline.exe` — the Agent Skill is embedded, so the portable build needs no extra files. Unsigned builds may trigger SmartScreen (**More info → Run anyway**).

### macOS

The `.app` is **ad-hoc signed** (not notarized). Extract the zip (Finder, or `ditto -x -k <zip> <dir>`), move **Excalidraw Offline.app** to Applications, then right-click → **Open** on first launch, or clear the quarantine flag:

```bash
xattr -cr "/Applications/Excalidraw Offline.app"
```

CLI:

```bash
"/Applications/Excalidraw Offline.app/Contents/MacOS/excalidraw-offline" ~/drawings/demo.excalidraw
```

### Where settings live

| OS | Config (recent files) | Logs |
|----|-----------------------|------|
| Linux | `$XDG_CONFIG_HOME/excalidraw-offline/` (fallback `~/.config/excalidraw-offline/`) | `<config>/logs/` |
| Windows | `%USERPROFILE%\.config\excalidraw-offline\` | `%LOCALAPPDATA%\ExcalidrawOffline\logs\` |
| macOS | `~/Library/Application Support/excalidraw-offline/` | `<config>/logs/` |

## Build from source

Prereqs: Node.js + pnpm 10, Rust **≥ 1.90** (the repo pins 1.90.0 in `rust-toolchain.toml`; a system Rust ≥ 1.90 works), and platform deps — Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev` (Debian/Ubuntu names); Windows: MSVC build tools; macOS: Xcode Command Line Tools.

```bash
cd frontend && pnpm install --frozen-lockfile && pnpm run build && cd ..
cd src-tauri && cargo build --release
./target/release/excalidraw-offline
# optional bundles: cargo install tauri-cli --locked --version "^2.0.0" && cargo tauri build
```

The release binary is ~19 MB on Linux (stripped), versus ~155 MB for the previous Deno Desktop build.

## Previous Deno Desktop releases

Still on the [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases) page:

- **Linux** [v0.7.2](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.7.2) — `excalidraw-offline-<version>-linux-x86_64.AppImage` and `.tar.xz` (needs `zenity` or `kdialog` for dialogs)
- **Windows 11** and **Apple Silicon macOS** [v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0) — MSI/zip and DMG/zip

## Arch Linux (makepkg, Deno build)

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
