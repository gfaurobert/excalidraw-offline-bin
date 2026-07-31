# Excalidraw Offline

Thin Deno Desktop wrapper around [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) for Arch Linux. It does **not** rebuild Excalidraw — it packages the upstream React component and adds local file open/save/autosave plus durable `assets/` attachments.

## Features (MVP)

- Launch an offline Excalidraw desktop app
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
deno task package:linux
```

## Packaging (Arch, no AUR required)

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
| `packaging/` | Local/AUR PKGBUILD + `.desktop` |
| `use-cases.md` | Product scope and clarifications |
| `docs/research/2026-07-31-agent-skills-locations.md` | Where AI tools store user/project skills |
