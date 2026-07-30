# Excalidraw Offline

Thin Deno Desktop wrapper around [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) for Arch Linux. It does **not** rebuild Excalidraw — it packages the upstream React component and adds local file open/save/autosave plus durable `assets/` attachments.

## Features (MVP)

- Launch an offline Excalidraw desktop app
- Open / Save / Save As `.excalidraw` files anywhere on disk
- File → Open Recent (up to 10 paths, persisted locally)
- Autosave once a file path exists
- Image attachments copied into a sibling `assets/` folder with relative paths so reopen never loses them

## Requirements

- Deno **≥ 2.9** (`deno desktop`)
- Runtime: `webkit2gtk-4.1`, `gtk3`, `zenity` (or `kdialog`)

## Develop

```bash
# Frontend
cd frontend && deno install && deno task build && cd ..

# Desktop (serves frontend/dist)
deno desktop --backend=webview --include=./frontend/dist --include=./icons ./desktop/main.ts
```

Or use tasks from the repo root:

```bash
deno task start
deno task test:file-format
deno task package:linux
```

## Packaging (Arch / AUR)

- [`packaging/PKGBUILD`](packaging/PKGBUILD) — AUR-oriented build from a release tarball
- [`packaging/PKGBUILD.local`](packaging/PKGBUILD.local) — build from a local checkout:

```bash
makepkg -f -p packaging/PKGBUILD.local
```

Installs:

- `/usr/bin/excalidraw-offline`
- desktop entry + icon

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
| `packaging/` | AUR PKGBUILD + `.desktop` |
| `use-cases.md` | Product scope and clarifications |
