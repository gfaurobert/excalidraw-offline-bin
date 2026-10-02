---
layout: default
title: File layout
nav_order: 4
---

# File layout

Drawings on disk use a portable pair: the `.excalidraw` JSON file plus a sibling `assets/` folder for attachments.

```text
drawing.excalidraw
assets/
  <fileId>.png
export/
  drawing_20261002-170512.png
  drawing_Login_20261002-170512.png
```

## Export PNGs

- **File → Export Selection as PNG** writes PNGs into `export/` beside the `.excalidraw` file (created automatically)
- Filenames use the drawing basename, optional frame name, and a local timestamp (`YYYYMMDD-HHMMSS`)
- Keep or gitignore `export/` depending on whether PNG snapshots belong in your project

## How attachments work

- On image import, the wrapper copies the file into the sibling `assets/` folder next to the `.excalidraw` file
- The `.excalidraw` JSON stores relative `assets/...` references (not absolute paths to the original file)
- On open, the wrapper rehydrates Excalidraw `BinaryFiles` from that folder so reopen never loses attachments
- Moving or copying the drawing: keep the `.excalidraw` file and its `assets/` folder together

This applies to attachment types upstream Excalidraw supports (images first).
