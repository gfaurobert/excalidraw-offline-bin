# Excalidraw offline — file & element cheatsheet

Companion to `excalidraw-sketching`. Agents CRUD `.excalidraw` files under
`sketches/`. No MCP, no canvas server.

## Scene document

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "excalidraw-offline-bin",
  "elements": [],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": 20
  },
  "files": {}
}
```

Write pretty-printed JSON (2 spaces) + trailing newline.

### Images (`files` + `assets/`)

On-disk form (what Excalidraw Offline writes):

```json
"files": {
  "a1b2c3": {
    "mimeType": "image/png",
    "id": "a1b2c3",
    "path": "assets/a1b2c3.png",
    "created": 1710000000000
  }
}
```

Binary at `sketches/assets/<id>.png` (sibling `assets/` of the `.excalidraw`
file’s directory). Upstream embedded `dataURL` entries also open, but prefer
path refs when adding images for the offline app.

Supported extensions: `png`, `jpg`, `gif`, `webp`, `svg`.

## Shared element fields

Every non-deleted element should include:

| Field | Notes |
|-------|--------|
| `id` | Stable string; agent-chosen kebab or short id |
| `type` | `rectangle` \| `ellipse` \| `diamond` \| `text` \| `arrow` \| `line` \| `image` \| … |
| `x`, `y` | Top-left (text: baseline origin behaves like Excalidraw text) |
| `width`, `height` | Box size; for arrows/lines often bbox of `points` |
| `angle` | Radians; usually `0` |
| `strokeColor` | e.g. `#1e1e1e` |
| `backgroundColor` | `"transparent"` or pastel fill |
| `fillStyle` | Prefer `"solid"` |
| `strokeWidth` | `1`–`4`; default `2` |
| `strokeStyle` | `"solid"` \| `"dashed"` \| `"dotted"` |
| `roughness` | `0` for crisp wireframe/CAD; `1` sketchy |
| `opacity` | `0`–`100` |
| `groupIds` | `[]` or group id strings |
| `frameId` | `null` unless using frames |
| `roundness` | `{ "type": 3 }` rounded rect; `null` sharp |
| `seed`, `versionNonce` | Integers (any stable ints are fine) |
| `isDeleted` | `false` |
| `boundElements` | `[]` or `[{ "type": "text"\|"arrow", "id": "..." }]` |
| `updated` | Integer timestamp-ish |
| `link` | `null` |
| `locked` | `false` |

## Shape + bound label

```json
[
  {
    "id": "node-api",
    "type": "rectangle",
    "x": 200,
    "y": 120,
    "width": 180,
    "height": 64,
    "angle": 0,
    "strokeColor": "#1971c2",
    "backgroundColor": "#a5d8ff",
    "fillStyle": "solid",
    "strokeWidth": 2,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "groupIds": [],
    "frameId": null,
    "roundness": { "type": 3 },
    "seed": 11,
    "versionNonce": 11,
    "isDeleted": false,
    "boundElements": [{ "type": "text", "id": "node-api-label" }],
    "updated": 1,
    "link": null,
    "locked": false
  },
  {
    "id": "node-api-label",
    "type": "text",
    "x": 220,
    "y": 138,
    "width": 140,
    "height": 28,
    "angle": 0,
    "strokeColor": "#1e1e1e",
    "backgroundColor": "transparent",
    "fillStyle": "solid",
    "strokeWidth": 2,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "groupIds": [],
    "frameId": null,
    "roundness": null,
    "seed": 12,
    "versionNonce": 12,
    "isDeleted": false,
    "boundElements": null,
    "updated": 1,
    "link": null,
    "locked": false,
    "text": "API",
    "fontSize": 20,
    "fontFamily": 5,
    "textAlign": "center",
    "verticalAlign": "middle",
    "containerId": "node-api",
    "originalText": "API",
    "autoResize": true,
    "lineHeight": 1.25
  }
]
```

`fontFamily`: `1` Virgil, `2` Helvetica, `3` Cascadia, `5` Excalifont — prefer
`5` or `2` for UI wireframes.

## Free-standing zone title

```json
{
  "id": "zone-vpc",
  "type": "rectangle",
  "x": 40,
  "y": 40,
  "width": 720,
  "height": 420,
  "strokeColor": "#1971c2",
  "backgroundColor": "#e7f5ff",
  "fillStyle": "solid",
  "strokeStyle": "dashed",
  "roughness": 0,
  "boundElements": [],
  "...": "plus shared fields"
},
{
  "id": "zone-vpc-title",
  "type": "text",
  "x": 56,
  "y": 52,
  "width": 280,
  "height": 28,
  "text": "VPC",
  "originalText": "VPC",
  "fontSize": 18,
  "fontFamily": 2,
  "textAlign": "left",
  "verticalAlign": "top",
  "containerId": null,
  "...": "plus shared fields; boundElements null"
}
```

## Arrow with bindings

`points` are **relative** to the arrow element’s `x`/`y`.

```json
{
  "id": "arr-1",
  "type": "arrow",
  "x": 290,
  "y": 152,
  "width": 200,
  "height": 0,
  "angle": 0,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "groupIds": [],
  "frameId": null,
  "roundness": { "type": 2 },
  "seed": 21,
  "versionNonce": 21,
  "isDeleted": false,
  "boundElements": null,
  "updated": 1,
  "link": null,
  "locked": false,
  "points": [[0, 0], [200, 0]],
  "lastCommittedPoint": null,
  "startBinding": {
    "elementId": "node-api",
    "focus": 0,
    "gap": 8
  },
  "endBinding": {
    "elementId": "node-db",
    "focus": 0,
    "gap": 8
  },
  "startArrowhead": null,
  "endArrowhead": "arrow"
}
```

Elbowed route: multiple points, e.g.
`[[0,0],[0,-40],[220,-40],[220,0]]`.

Also push `{ "type": "arrow", "id": "arr-1" }` into each endpoint’s
`boundElements`.

## Palette (stroke / fill)

| Name | Stroke | Fill |
|------|--------|------|
| Red | `#e03131` | `#ffc9c9` |
| Green | `#2f9e44` | `#b2f2bb` |
| Blue | `#1971c2` | `#a5d8ff` |
| Orange | `#e8590c` | `#ffd8a8` |
| Cyan | `#0c8599` | `#99e9f2` |
| Gray | `#868e96` | `#e9ecef` |
| Ink | `#1e1e1e` | `transparent` |

Wireframes: gray fills + blue accent for primary CTA. CAD sketches: light fills,
dark strokes, dashed for hidden/section edges.

## Sizing defaults

| Kind | Size |
|------|------|
| Button / field | ≥ 120×40 |
| Diagram node | ≥ 160×60; width ≥ `chars * 12` |
| Screen frame | ≥ 320×480 (mobile) or 640×400 (desktop panel) |
| Font body | ≥ 16 |
| Font title | ≥ 20 |
| Grid | 20px |

## Minimal empty sketch

Path: `sketches/sketch-abc123.excalidraw`

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "excalidraw-offline-bin",
  "elements": [],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": 20
  },
  "files": {}
}
```

## CRUD checklist

- **Create** — write new file under `sketches/`
- **Read** — parse `elements`; report ids, types, labels (`text` / bound text)
- **Update** — mutate `elements` / `files`; rewrite file
- **Delete** — remove `.excalidraw`; remove orphaned `assets/<id>.*` you own

Never start MCP or a canvas HTTP server.
