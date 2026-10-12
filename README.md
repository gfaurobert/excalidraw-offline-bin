# Excalidraw Offline

Thin [Tauri 2](https://tauri.app/) desktop wrapper around [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) for offline desktop use on Linux, Windows 11, and macOS (universal: Apple Silicon + Intel). It does **not** rebuild Excalidraw — it packages the upstream React component and adds local file open/save/autosave plus durable `assets/` attachments.

**Docs:** [https://gfaurobert.github.io/excalidraw-offline-bin/](https://gfaurobert.github.io/excalidraw-offline-bin/)

**Status:** the Tauri 2 port (branch `cursor/tauri2-poc-fd6a`, PR #18) is end-to-end tested on **Linux, Windows 11, and macOS**. It is not in a GitHub release yet — the release workflows still publish the previous Deno Desktop builds ([v0.7.2](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.7.2) Linux; [v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0) Windows/macOS). Until a Tauri release is tagged, get builds from CI artifacts or [build from source](#build-from-source).

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

**Not ported from the Deno build yet:** single-instance handoff (a second launch opens a second window) and OS file associations (double-click `.excalidraw`). Pass the path as an argument instead.

### Size

| Build | Size |
|-------|------|
| Tauri 2 Linux binary (stripped, release) | ~19 MB |
| Previous Deno Desktop build | ~155 MB |

Tauri uses the system webview instead of bundling a runtime.

## Requirements

- **Linux:** WebKitGTK 4.1 and GTK 3 (`webkit2gtk-4.1`, `gtk3`). No zenity/kdialog needed
- **Windows 11:** WebView2 (preinstalled on Windows 11)
- **macOS:** 11 or newer; WKWebView (system). Universal binary runs on Apple Silicon and Intel

## Install

### From CI artifacts (until the Tauri release)

| Platform | Workflow | Artifact |
|----------|----------|----------|
| Windows 11 x64 | [Tauri Windows x64 build](https://github.com/gfaurobert/excalidraw-offline-bin/actions/workflows/tauri-windows-build.yml) | `excalidraw-offline-tauri-windows-x64`: NSIS installer (`*-setup.exe`) + `excalidraw-offline-windows-x64-portable.zip` |
| macOS | [Tauri macOS build](https://github.com/gfaurobert/excalidraw-offline-bin/actions/workflows/tauri-macos-build.yml) | `excalidraw-offline-tauri-macos`: `excalidraw-offline-macos-universal.zip` + `excalidraw-offline-macos-arm64.zip` |
| Linux | — | [Build from source](#build-from-source) (`cargo tauri build` also produces an AppImage and `.deb`) |

**Windows:** run the installer, or extract the portable zip and run `Excalidraw-Offline.exe`. Unsigned builds may trigger SmartScreen (**More info → Run anyway**).

**macOS:** the `.app` is **ad-hoc signed** (not notarized), so Gatekeeper blocks the first launch. Extract the zip (Finder or `ditto -x -k <zip> <dir>`), then right-click the app → **Open**, or clear the quarantine flag:

```bash
xattr -cr "/Applications/Excalidraw Offline.app"
```

### Where settings live

| OS | Config (recent files) | Logs |
|----|-----------------------|------|
| Linux | `$XDG_CONFIG_HOME/excalidraw-offline/` (fallback `~/.config/excalidraw-offline/`) | `<config>/logs/` |
| Windows | `%USERPROFILE%\.config\excalidraw-offline\` | `%LOCALAPPDATA%\ExcalidrawOffline\logs\` |
| macOS | `~/Library/Application Support/excalidraw-offline/` | `<config>/logs/` |

### Previous Deno Desktop releases

Still on the [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases) page: Linux [v0.7.2](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.7.2) (AppImage, tar.xz), Windows and Apple Silicon macOS [v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0). The Arch `PKGBUILD` below packages that Deno build.

### Arch Linux (makepkg, Deno build)

Install from a local git checkout with [`packaging/PKGBUILD.local`](packaging/PKGBUILD.local):

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

[`packaging/PKGBUILD`](packaging/PKGBUILD) is an optional AUR/release-tarball template for later; skip it until you publish.

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

# Optional: bundles (AppImage + deb on Linux, NSIS on Windows, .app on macOS)
cargo install tauri-cli --locked --version "^2.0.0"
cargo tauri build
```

CI (`.github/workflows/tauri-windows-build.yml`, `.github/workflows/tauri-macos-build.yml`) runs `cargo clippy -- -D warnings` for Linux, Windows (cargo-xwin), and macOS arm64/x86_64, builds the bundles, and smoke-tests `/api/health`.

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
| `desktop/` | Previous Deno Desktop shell (used by the current release workflows) |
| `skills/` | Bundled Agent Skills (e.g. `excalidraw-sketching`) |
| `scripts/` | Release packaging, CI verify scripts |
| `packaging/` | Local/AUR PKGBUILD + `.desktop` |
| `docs/site/` | Public GitHub Pages docs (Jekyll + Just the Docs) |
| `.github/workflows/` | CI: `tauri-windows-build.yml`, `tauri-macos-build.yml`, `release-*.yml` (Deno releases), `jekyll-gh-pages.yml` |
| `use-cases.md` | Product scope and clarifications |
| `docs/research/2026-07-31-agent-skills-locations.md` | Where AI tools store user/project skills |
