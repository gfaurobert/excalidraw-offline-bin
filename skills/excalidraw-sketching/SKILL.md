---
name: excalidraw-sketching
  description: >-
  AI agent sketching for wireframes, diagrams, and CAD object drawings via
  plain .excalidraw files under sketches/. Use when the user asks to sketch,
  wireframe, diagram, draw a flowchart/architecture, or outline a part/assembly
  for CAD. CRUD files on disk only — never launch MCP, never start a canvas
  server. After create/update, tell the user the path and launch
  `excalidraw-offline <path>` when available.
---

# Excalidraw sketches (offline)

Sketch by **writing and editing `.excalidraw` JSON** under the workspace
`sketches/` folder. The source of truth is the file on disk. The user views and
hand-edits with the local **`excalidraw-offline`** desktop app.

**Do not** use MCP tools, `mcp-excalidraw-server`, `npx` canvas servers, REST
canvas APIs, Mermaid-to-canvas converters, or share-link uploads.

## Scope

Use this skill for:

1. **UI wireframes** — screens, flows, controls, navigation
2. **Diagrams** — architecture, sequence-ish boxes, data flow, decision trees
3. **CAD object sketches** — orthographic outlines, assembly layouts, feature
   callouts, exploded-ish part diagrams that feed FreeCAD / ForgeCAD work

Not for: parametric CAD models, precise manufacturing drawings, or live
collaboration canvases.

## File CRUD (required)

Root: `<workspace-root>/sketches/` (create if missing).

| Op | How |
|----|-----|
| **Create** | Write `sketches/<name>.excalidraw` (valid scene JSON) |
| **Read** | Read the `.excalidraw` file; summarize elements by `id` / label |
| **Update** | Edit elements in place (change coords, labels, add/remove shapes), then rewrite the file |
| **Delete** | Delete the `.excalidraw` file (and unused `sketches/assets/<id>.*` if you added images) |

### Naming

- User gives a name → `sketches/<name>.excalidraw` (slug: lowercase, dashes)
- No name → `sketches/sketch-<6 alphanumeric>.excalidraw`
- If the file already exists → **open/edit it**, do not overwrite blindly

### Paths

- Only write under `sketches/`
- Plain `.excalidraw` JSON only (never Obsidian `.excalidraw.md`)
- Do not git-commit sketches unless the user asks

### Viewing

After create or update:

1. Tell the human the sketch path (workspace-relative, e.g. `sketches/<name>.excalidraw`).
2. Launch it with the CLI when available (preferred — works for agents and is reliable):

```bash
excalidraw-offline sketches/<name>.excalidraw
```

If the file does not exist yet, the app **creates a blank** `.excalidraw` at that path (including parent directories) and opens it. Prefer writing the sketch JSON yourself for real content; use create-on-open when you want a blank canvas at a known path.

If `excalidraw-offline` is not on `PATH`, say so and fall back to: open the file manually via File → Open in Excalidraw Offline.

After OS MIME install, `xdg-open sketches/<name>.excalidraw` also works for existing files. Prefer the CLI for agent launches.

**Cursor note:** Clicking a `.excalidraw` path in Cursor chat usually opens it **inside the editor**, not via the OS handler. Do not rely on chat file links for viewing — run the CLI (or `xdg-open`) instead.

## Document format

Every sketch file:

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

- Pretty-print with 2-space indent and a trailing newline (matches the offline
  binary writer).
- `files` stays `{}` unless the sketch embeds images. Image binaries live in
  `sketches/assets/<fileId>.<ext>` with a stored ref:

```json
"files": {
  "<fileId>": {
    "mimeType": "image/png",
    "id": "<fileId>",
    "path": "assets/<fileId>.png",
    "created": 1710000000000
  }
}
```

All sketches in the same `sketches/` folder share one `assets/` directory — use
unique `fileId` values (random hex/nanoid-style). Prefer no images unless the
user provides reference pictures.

Full field reference: `references/cheatsheet.md`.

## Element rules

Every element needs stable fields the offline app expects. Prefer this template
and only change what you need:

```json
{
  "id": "btn-primary",
  "type": "rectangle",
  "x": 100,
  "y": 80,
  "width": 160,
  "height": 48,
  "angle": 0,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "groupIds": [],
  "frameId": null,
  "roundness": { "type": 3 },
  "seed": 1,
  "versionNonce": 1,
  "isDeleted": false,
  "boundElements": [],
  "updated": 1,
  "link": null,
  "locked": false
}
```

### Labels (critical)

Do **not** invent MCP-style `"text": "..."` on shapes. Persist real Excalidraw
structure:

1. Shape with `boundElements: [{ "type": "text", "id": "btn-primary-label" }]`
2. Sibling text element with `"containerId": "btn-primary"` and the label string

Or use a free-standing `text` element (required for zone titles — never bind
text to large background rectangles).

### Arrows

Create the arrow with `points` relative to the arrow's `x`/`y`, and set
`startBinding` / `endBinding` to the connected element ids (with `focus` /
`gap`). Keep arrow labels short or omit them.

### Types to use

| Need | `type` |
|------|--------|
| Box / panel / part silhouette | `rectangle` |
| Soft node / sensor | `ellipse` |
| Decision | `diamond` |
| Label / title / dimension note | `text` |
| Flow / constraint / leader | `arrow` |
| Guide / section cut | `line` (`strokeStyle: "dashed"`) |

Use `"roughness": 0` and `"fillStyle": "solid"` for wireframes and CAD sketches
(crisp, not sketchy).

## Coordinate system and layout

- Origin top-left; **x → right**, **y → down**
- Align to a **20px grid**
- Gaps: 40–80px between siblings; 80–120px between tiers; 120px+ when arrows
  carry labels
- Shape width: `max(160, labelChars * 12)`; height 48–80 for UI chrome, 60–100
  for diagram nodes
- Zone padding: ≥ 50px around contained elements

### Anti-patterns

1. Bound labels on large zone rectangles (label centers in the middle and
   overlaps children) — use free-standing text at the top-left of the zone
2. Long diagonal cross-zone arrows — route along edges with elbowed points
3. Labels on every arrow — only when the relationship name matters (≤ 12 chars)
4. Overlapping shapes or truncated text — widen boxes before adding more

## Workflows by sketch kind

### UI wireframe

1. Plan screen frames left-to-right or top-to-bottom
2. Draw frames as large rectangles + free-standing screen titles
3. Place controls (rects/ellipses) with bound labels
4. Add navigation arrows between screens sparingly
5. Prefer grayscale + one accent for primary actions

### Diagram

1. Lay out tiers on a grid before writing JSON
2. Nodes first (stable ids), then arrows with bindings
3. Background zones only when they clarify boundaries (dashed stroke, light fill)
4. Re-read the file and check: no overlaps, labels fit, arrows clear

### CAD object sketch

1. One orthographic view per cluster (Front / Top / Side) or a single clear
   outline — label the view with free-standing text
2. Outer silhouette as rectangle/ellipse/line paths; features as nested shapes
3. Callouts: short arrows + free text (`hole Ø6`, `fillet R3`, `M4×0.7`) — these
   are **intent notes**, not parametric constraints
4. Keep proportions approximate; say in the reply that exact dims belong in
   FreeCAD / ForgeCAD
5. If feeding a CAD skill next, keep part/feature ids stable and human-readable
   (`housing`, `lid`, `boss-m4`)

## Quality checklist

Before saying done:

1. File exists at `sketches/<name>.excalidraw` and parses as JSON
2. `type` / `version` / `elements` / `appState` / `files` present
3. Every label either bound correctly or free-standing (no MCP shorthand)
4. No overlapping critical shapes; text not clipped
5. Point the user at the path and how to open it in Excalidraw Offline
6. Do not commit unless asked

## Iterative edits

1. Read the file
2. Find elements by `id` or label text (not by brittle x/y alone)
3. Patch elements (move, resize, recolor, add/delete)
4. Rewrite the whole file
5. Summarize what changed (ids + intent)

When rebuilding a messy sketch is faster than patching, replace `elements`
entirely but keep the same filename and ids the user already relies on when
possible.
