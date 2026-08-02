---
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

## How attachments work

- On image import, the wrapper copies the file into the sibling `assets/` folder next to the `.excalidraw` file
- The `.excalidraw` JSON stores relative `assets/...` references (not absolute paths to the original file)
- On open, the wrapper rehydrates Excalidraw `BinaryFiles` from that folder so reopen never loses attachments
- Moving or copying the drawing: keep the `.excalidraw` file and its `assets/` folder together

This applies to attachment types upstream Excalidraw supports (images first).
