---
title: What's new
nav_order: 5
---

# What's new

**Current release:** [v0.7.1](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.7.1) (Linux x86_64 — AppImage and tar.xz).

Windows and macOS builds for v0.6.0, v0.7.0, and v0.7.1 were not published; the latest **Windows** (MSI/zip) and **Apple Silicon macOS** (DMG/zip) builds remain **[v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0)** until a follow-up release. See [Install]({% link install.md %}).

---

## v0.7.1 (2026-10-04) — Linux only

- **Updated installable agent skill** (Skills → Install excalidraw-sketching skill) — documents the desktop app (File menu and shortcuts, Reload unsaved prompt, Export image dialog, frames, sticky notes, right-click pan, dark mode) plus the headless **export** CLI, every flag, and `--help` / exit codes. Reinstall the skill after upgrading the app so agents pick up the new copy.
- Fixed broken YAML frontmatter in the bundled skill.

[Release notes](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.7.1) · [Full changelog](https://github.com/gfaurobert/excalidraw-offline-bin/compare/v0.7.0...v0.7.1)

---

## v0.7.0 (2026-10-04) — Linux only

- **Excalidraw pinned to `0.18.0-4ce38fb`** — upstream editor including sticky notes (**N**) and right-click drag to pan.
- **Reload (Ctrl+R / ⌘R) on a saved drawing with unsaved edits** — no longer wrongly reports “no file path”; native prompt offers **Save / Discard** and reload / **Cancel** (same pattern as other dirty flows).
- Headless PNG export CLI output unchanged vs v0.6.0 (pixel-identical in project e2e checks).

[Release notes](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.7.0) · [Full changelog](https://github.com/gfaurobert/excalidraw-offline-bin/compare/v0.6.0...v0.7.0)

---

## v0.6.0 (2026-10-03) — Linux only

- **Export image…** (Ctrl+Shift+E / ⌘⇧E) — upstream Excalidraw export dialog with **native save** for PNG/SVG (default folder: directory of the open `.excalidraw` file).
- **Headless PNG export CLI** — `excalidraw-offline export <file.excalidraw>` with `--frame`, `--all-frames`, `--element`, `--bbox`, `--scale`, `--json`, `--out` / `-d`.
- **`--help` / `-h`** — top-level and `export` subcommand help on stdout (exit 0, no GUI); `deno task export -- --help` in repo checkouts.
- Removed legacy quick “Export Selection as PNG” / fixed `export/` folder convention; use the dialog or CLI instead.

[Release notes](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.6.0) · [Full changelog](https://github.com/gfaurobert/excalidraw-offline-bin/compare/v0.5.0...v0.6.0)

---

## v0.5.0 (2026-10-02) — Linux, Windows 11, macOS arm64

- **File → Reload** (Ctrl+R / ⌘R) — re-read the open `.excalidraw` from disk (including `assets/`) after external edits (e.g. a coding agent). Unsaved edits on a saved file use **Cancel / Save / Discard** before reloading.
- **Apple Silicon macOS** — DMG and zip of the `.app` (WKWebView, `osascript` dialogs). This release also ships the latest **Windows 11** MSI and zip (WebView2, PowerShell dialogs).

[Release notes](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0) · [Full changelog](https://github.com/gfaurobert/excalidraw-offline-bin/compare/v0.4.0...v0.5.0)
