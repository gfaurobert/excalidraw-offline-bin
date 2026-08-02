# Excalidraw Offline

Thin Deno Desktop wrapper around [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) for offline desktop use on Linux. It does **not** rebuild Excalidraw — it packages the upstream React component and adds local file open/save/autosave plus durable `assets/` attachments.

**Docs:** [https://gfaurobert.github.io/excalidraw-offline-bin/](https://gfaurobert.github.io/excalidraw-offline-bin/)

## Features (MVP)

- Launch an offline Excalidraw desktop app
- Start screen on launch (New / Open / Recent); canvas opens after a choice
- File → Close returns to the start screen; Quit exits
- Native zenity/kdialog for open/save and unsaved Cancel/Save/Discard
- Open / Save / Save As `.excalidraw` files anywhere on disk
- File → Open Recent (up to 10 paths, persisted locally)
- Autosave once a file path exists
- Image attachments copied into a sibling `assets/` folder with relative paths so reopen never loses them
- Info menu: Runtime, Assets tip, About Excalidraw Offline, About Excalidraw (native dialogs)
- Skills menu: install the bundled `excalidraw-sketching` Agent Skill (Global / Project / Custom → `.agents/skills`)
- Transient open/save status appears in the header (not a footer)

## Requirements

- Deno **≥ 2.9** (`deno desktop`)
- Runtime: `webkit2gtk-4.1`, `gtk3`, `zenity` (or `kdialog`)

## Install

### Linux (GitHub Releases)

Download from [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases):

- **AppImage** — `excalidraw-offline-<version>-linux-x86_64.AppImage` (chmod +x, then run)
- **Binary tarball** — `excalidraw-offline-<version>-linux-x86_64.tar.xz` (extract and run `./excalidraw-offline`; built with `--compress=xz`, so the archive contains the launcher plus `payload.tar.xz` — a Deno Desktop self-extracting layout — not an expanded `.so`/icons tree)

Runtime deps: `webkit2gtk-4.1`, `gtk3`, and `zenity` (or `kdialog`).

Maintainers: tagging `vX.Y.Z` (matching `deno.json` version) runs [`.github/workflows/release-linux.yml`](.github/workflows/release-linux.yml). Local dry-run: `deno task package:release`.

### Arch Linux (makepkg)

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
- `/usr/share/icons/hicolor/128x128/apps/excalidraw-offline.png`

Uninstall: `sudo pacman -Rns excalidraw-offline`.

[`packaging/PKGBUILD`](packaging/PKGBUILD) is an optional AUR/release-tarball template for later; skip it until you publish.

## Develop

```bash
# Frontend
cd frontend && deno install && deno task build && cd ..

# Desktop (serves frontend/dist)
deno desktop --backend=webview --include=./frontend/dist --include=./icons --include=./skills ./desktop/main.ts
```

Or use tasks from the repo root:

```bash
deno task start
deno task test:file-format
deno task test:release
deno task package:linux
deno task package:release
```

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
| `desktop/` | Deno Desktop entry, dialogs, file format |
| `skills/` | Bundled Agent Skills (e.g. `excalidraw-sketching`) |
| `scripts/` | Release packaging and naming helpers |
| `packaging/` | Local/AUR PKGBUILD + `.desktop` |
| `docs/site/` | Public GitHub Pages docs (Jekyll + Just the Docs) |
| `.github/workflows/` | CI: `release-linux.yml`, `jekyll-gh-pages.yml` |
| `use-cases.md` | Product scope and clarifications |
| `docs/research/2026-07-31-agent-skills-locations.md` | Where AI tools store user/project skills |
