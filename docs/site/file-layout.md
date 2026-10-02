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
```

Exported PNGs from the CLI (or PNG/SVG you save via **Export image…**) can live in the same folder as the drawing or anywhere you choose in the save dialog. The CLI writes next to the `.excalidraw` file by default unless you pass `--out`.

## How attachments work

- On image import, the wrapper copies the file into the sibling `assets/` folder next to the `.excalidraw` file
- The `.excalidraw` JSON stores relative `assets/...` references (not absolute paths to the original file)
- On open, the wrapper rehydrates Excalidraw `BinaryFiles` from that folder so reopen never loses attachments
- Moving or copying the drawing: keep the `.excalidraw` file and its `assets/` folder together

This applies to attachment types upstream Excalidraw supports (images first).
