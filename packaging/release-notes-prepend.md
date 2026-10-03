## Linux-only release

**This GitHub Release contains Linux x86_64 assets only.** Windows and macOS builds for **v0.6.0** were not end-to-end tested for the new export CLI and help changes; the latest published **Windows/macOS** builds remain **[v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0)** until a follow-up release.

## Highlights (since v0.5.0)

- **Export image…** (Ctrl+Shift+E / ⌘⇧E) — upstream Excalidraw export dialog with native PNG/SVG save (default folder: the open drawing’s directory)
- **Headless PNG export CLI** — `excalidraw-offline export <file.excalidraw>` with `--frame`, `--all-frames`, `--element`, `--bbox`, `--scale`, `--json`, `--out` / **`-d`**
- **`--help` / `-h`** — top-level and `export` subcommand help on stdout (exit 0, no GUI); `deno task export -- --help` and `deno task start -- --help` in repo checkouts
- Removed legacy quick “Export Selection as PNG” / `export/` folder convention; use the dialog or CLI instead
