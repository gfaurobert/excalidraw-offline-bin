# Excalidraw Offline

Thin [Tauri 2](https://tauri.app/) desktop wrapper around [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) for offline desktop use on Linux, Windows 11, and macOS (universal: Apple Silicon + Intel). It does **not** rebuild Excalidraw — it packages the upstream React component and adds local file open/save/autosave plus durable `assets/` attachments.

**Docs:** [https://gfaurobert.github.io/excalidraw-offline-bin/](https://gfaurobert.github.io/excalidraw-offline-bin/)

**Status:** [v0.8.1](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.8.1) is the current **Tauri 2** release for **Linux, Windows 11, and macOS** (AppImage, Arch packages, portable/installer, macOS zips).

https://github.com/user-attachments/assets/6052418e-d231-42c4-9b4d-063d0d64e6eb

## Features

- Start screen on launch (New / Open / Recent); canvas opens after a choice
- **File** menu: New (Ctrl+N), Open… (Ctrl+O), Open Recent (up to 10 paths), Close (Ctrl+W, back to the start screen), Reload (Ctrl+R — re-read the file after an agent edits it), Save (Ctrl+S), Save As… (Ctrl+Shift+S), Quit (Ctrl+Q). ⌘ instead of Ctrl on macOS
- Native OS dialogs for open/save and the unsaved **Save / Don't save / Cancel** prompt on close and quit (GTK on Linux, Win32 on Windows, AppKit on macOS)
- Autosave once a file path exists; untitled drawings prompt before close/quit
- Image attachments copied into a sibling `assets/` folder with relative paths so reopen never loses them
- Excalidraw **Export image** dialog (Ctrl+Shift+E) with native save for PNG/SVG
- **Skills** menu: install the bundled `excalidraw-sketching` Agent Skill — choose **Global** (home directory), **Project** (pick a project root), or **Custom** (any folder), then tick agent targets in a checklist: `.agents/skills` (Codex, Cursor, GitHub Copilot, Gemini CLI, OpenCode, Amp, Goose, Roo Code, Windsurf), Claude Code, Kiro, Cline, or All. The skill is embedded in the binary, so portable builds need no extra files. Reinstall after upgrading
- **Info** menu: Runtime, Assets, About Excalidraw Offline, About Excalidraw (OK closes; **Open in browser** opens the link)
- CLI: `excalidraw-offline /path/to/file.excalidraw` opens a drawing; `excalidraw-offline export path/to/drawing.excalidraw [--frame NAME …] [--all-frames] [--element ID …] [--bbox x,y,w,h] [--out dir-or-file.png | -d dir] [--scale N] [--json]` renders PNGs headlessly (same renderer as the GUI); `--help` and `export --help` print usage
- Upstream editor from `@excalidraw/excalidraw` **0.18.0-4ce38fb** (sticky notes `N`, right-click drag pan, lasso, bucket fill, draw-to-shape)

**Not ported yet:** single-instance handoff (a second launch opens a second window) and OS file associations (double-click `.excalidraw`). Pass the path as an argument instead.

### Size

| Build | Size |
|-------|------|
| Tauri 2 Linux binary (stripped, release) | ~19 MB |
| Legacy v0.7.2 Linux bundle | ~155 MB |

Tauri uses the system webview instead of bundling a runtime.

## Requirements

- **Linux:** WebKitGTK 4.1 and GTK 3 (`webkit2gtk-4.1`, `gtk3`). No zenity/kdialog needed
- **Windows 11:** WebView2 (preinstalled on Windows 11)
- **macOS:** 11 or newer; WKWebView (system). Universal binary runs on Apple Silicon and Intel

## Install

### GitHub Release ([latest](https://github.com/gfaurobert/excalidraw-offline-bin/releases/latest))

| Platform | Assets |
|----------|--------|
| Windows 11 x64 | `excalidraw-offline-<ver>-windows-x86_64-portable.zip`, `*-setup.exe` |
| macOS | `excalidraw-offline-<ver>-macos-universal.zip`, `-macos-arm64.zip` |
| Linux x86_64 | AppImage, `excalidraw-offline-<ver>-linux-x86_64.tar.gz`, prebuilt `.pkg.tar.zst`, `PKGBUILD` / `PKGBUILD-bin` |

**Linux:** `chmod +x excalidraw-offline-*-linux-x86_64.AppImage` and run it. On Arch, use the prebuilt binary package ([below](#arch-linux-makepkg)) or install the CI-built package: `sudo pacman -U excalidraw-offline-<ver>-1-x86_64.pkg.tar.zst`.

**Windows:** run the installer, or extract the portable zip and run `Excalidraw-Offline.exe`. Unsigned builds may trigger SmartScreen (**More info → Run anyway**).

**macOS:** extract `excalidraw-offline-<ver>-macos-universal.zip` or `-macos-arm64.zip` (Finder or `ditto -x -k <zip> <dir>`), move **Excalidraw Offline.app** to `/Applications`. The build is **ad-hoc signed** (not notarized), so Gatekeeper quarantine often blocks the first launch: double-click may say the app is **damaged or incomplete** (French: *« Impossible d’ouvrir l’application… car elle est peut-être endommagée ou incomplète »*), and Finder may show a prohibitory (circle-with-slash) badge on the icon. That is quarantine, not a bad zip. Clear it once:

```bash
xattr -cr "/Applications/Excalidraw Offline.app"
```

Then open normally, or right-click the app → **Open**, or **System Settings → Privacy & Security → Open Anyway** after a blocked launch.

### CLI by platform

| OS | Example |
|----|---------|
| Linux | `/usr/bin/excalidraw-offline ~/drawings/demo.excalidraw` |
| Windows (PowerShell) | `& 'C:\Program Files\Excalidraw Offline\Excalidraw-Offline.exe' $env:USERPROFILE\drawings\demo.excalidraw` |
| macOS | `"/Applications/Excalidraw Offline.app/Contents/MacOS/excalidraw-offline" ~/drawings/demo.excalidraw` |

Headless export (all platforms): `excalidraw-offline export --help`

### Where settings live

| OS | Config (recent files) | Logs |
|----|-----------------------|------|
| Linux | `$XDG_CONFIG_HOME/excalidraw-offline/` (fallback `~/.config/excalidraw-offline/`) | `<config>/logs/` |
| Windows | `%USERPROFILE%\.config\excalidraw-offline\` | `%LOCALAPPDATA%\ExcalidrawOffline\logs\` |
| macOS | `~/Library/Application Support/excalidraw-offline/` | `<config>/logs/` |

### Arch Linux (makepkg)

**Recommended — prebuilt, no Rust/Node/pnpm:** [`packaging/PKGBUILD-bin`](packaging/PKGBUILD-bin) (`excalidraw-offline-bin` package, provides `excalidraw-offline`):

```bash
cd packaging
makepkg -si -f -p PKGBUILD-bin
```

Downloads `excalidraw-offline-<ver>-linux-x86_64.tar.gz` from the GitHub Release (same files as the source package).

**Alternative — build from source** ([`packaging/PKGBUILD.local`](packaging/PKGBUILD.local) or release [`packaging/PKGBUILD`](packaging/PKGBUILD)):

```bash
# Prereqs: base-devel, Rust >= 1.90 and cargo on PATH (pacman rust or rustup),
# pnpm on PATH (mise/corepack/npm) or corepack; makepkg -s installs nodejs + runtime libs only.
cd packaging
makepkg -si -f -p PKGBUILD.local
```

`PKGBUILD.local` copies the checkout into `$srcdir` (skips `frontend/node_modules`) so root-owned Docker `node_modules` does not break the build.

Install layout (both packages):

- `/usr/bin/excalidraw-offline`
- `/usr/share/applications/excalidraw-offline.desktop`
- `/usr/share/mime/packages/application-x-excalidraw.xml`
- `/usr/share/icons/hicolor/128x128/apps/excalidraw-offline.png`

Uninstall: `sudo pacman -Rns excalidraw-offline-bin` or `excalidraw-offline`.

## Build from source

Prereqs: Node.js + pnpm 10 (frontend), Rust **≥ 1.90** (`rust-toolchain.toml` pins 1.90.0; a system Rust ≥ 1.90 works too), plus:

- **Linux:** `webkit2gtk-4.1` and `gtk3` dev packages (Debian/Ubuntu: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`)
- **Windows:** MSVC build tools + WebView2
- **macOS:** Xcode Command Line Tools

```bash
# Frontend
cd frontend && pnpm install --frozen-lockfile && pnpm run build && cd ..

# Desktop binary
cd src-tauri && cargo build --release
./target/release/excalidraw-offline            # Windows: target\release\excalidraw-offline.exe

# Optional: bundles (AppImage + deb on Linux; release AppImage: scripts/package-tauri-linux-release.sh; NSIS on Windows, .app on macOS)
cargo install tauri-cli --locked --version "^2.0.0"
cargo tauri build
```

CI (`.github/workflows/ci.yml`, `tauri-windows-build.yml`, `tauri-macos-build.yml`, `release-*.yml`) runs `cargo test` / `cargo clippy -- -D warnings`, builds the bundles, and smoke-tests `/api/health`.

## File layout on disk

```
drawing.excalidraw
assets/
  <fileId>.png
```

The `.excalidraw` JSON stores relative `assets/...` references. On open, the wrapper rehydrates Excalidraw `BinaryFiles` from that folder.

## Project layout

| Path | Role |
|------|------|
| `frontend/` | Vite + React UI embedding Excalidraw |
| `src-tauri/` | Tauri 2 shell: local HTTP API, native dialogs (GTK / Win32 / AppKit), menus, Skills installer, CLI export |
| `skills/` | Bundled Agent Skills (e.g. `excalidraw-sketching`) |
| `scripts/` | Release packaging, CI verify scripts |
| `packaging/` | Local/AUR PKGBUILD + `.desktop` |
| `docs/site/` | Public GitHub Pages docs (Jekyll + Just the Docs) |
| `.github/workflows/` | CI, release workflows, `jekyll-gh-pages.yml` |
| `use-cases.md` | Product scope and clarifications |
| `docs/research/2026-07-31-agent-skills-locations.md` | Where AI tools store user/project skills |
