---
name: excalidraw-sketching
description: >-
  Help humans use Excalidraw Offline (.excalidraw desktop app, native File menu,
  GUI export, headless PNG CLI) and create or edit agent sketches as plain JSON
  under sketches/. Use for wireframes, diagrams, CAD outlines, opening/saving
  files, Reload after external edits, CLI export flags, or installing this skill
  via Skills → Install excalidraw-sketching skill.
---

# Excalidraw Offline — agent guide

**Excalidraw Offline** is a local Deno Desktop app for `.excalidraw` files (not
Electron). It embeds upstream Excalidraw in a webview with **native OS dialogs**
(Linux: zenity/kdialog; Windows: PowerShell WinForms; macOS: osascript). No
MCP, no canvas server, no share links.

Agents typically either **(A)** help a human use the GUI/CLI, or **(B)** read/write
sketch JSON under `sketches/` and tell the human how to open or export.

## Install this skill

**Skills → Install excalidraw-sketching skill** copies `SKILL.md` and
`references/` from the app bundle (file copy, not a symlink).

1. Choose **Global (user)**, **Project**, or **Custom**.
2. For **Global** or **Project**, pick one or more agent targets (defaults:
   `.agents/skills` and **Claude Code**). **All** installs every target below.
3. **Custom** — pick any folder; the skill is copied to
   `<folder>/excalidraw-sketching/` (no extra suffix).

| Target | Global path | Project path |
|--------|-------------|--------------|
| `.agents/skills` (Codex, Cursor, GitHub Copilot, Gemini CLI, OpenCode, Amp, Goose, Roo Code, Windsurf) | `~/.agents/skills/excalidraw-sketching/` | `<root>/.agents/skills/excalidraw-sketching/` |
| Claude Code | `~/.claude/skills/excalidraw-sketching/` | `<root>/.claude/skills/excalidraw-sketching/` |
| Kiro | `~/.kiro/skills/excalidraw-sketching/` | `<root>/.kiro/skills/excalidraw-sketching/` |
| Cline | `~/.cline/skills/excalidraw-sketching/` | `<root>/.cline/skills/excalidraw-sketching/` |

Parent directories are created as needed. If any destination already exists,
the app lists them and asks once before overwriting.

## Desktop app — help the human

### Start screen

Cold start shows **New / Open / Recent** (canvas mounts after an action). Does
not auto-open the last file.

### Native **File** menu (also wired in the canvas webview)

| Action | Menu / shortcut |
|--------|-----------------|
| New | File → New · **Ctrl+N** (⌘N macOS) |
| Open | File → Open… · **Ctrl+O** |
| Open Recent | File → Open Recent · up to 10 MRU paths (missing paths dropped on use) |
| Close | File → Close · **Ctrl+W** · returns to start screen |
| Reload | File → Reload · **Ctrl+R** · re-reads saved file from disk (see below) |
| Save | File → Save · **Ctrl+S** |
| Save As | File → Save As… · **Ctrl+Shift+S** |
| Quit | File → Quit · **Ctrl+Q** |

**Reload** is enabled only on the **canvas** with a **saved path** (not Untitled,
not start screen). Use when a coding agent or other tool changed the `.excalidraw`
on disk. If the human has **unsaved local edits**, Reload shows native
**Cancel / Save / Discard** (reload reason: save to disk first, discard local
edits then load disk, or cancel). Same three-button pattern for dirty **Untitled**
on Close / New / Open / Quit.

Once a drawing has a path, **autosave** (~1.5s debounce) writes back to that file.
Untitled sketches need Save / Save As before autosave works.

### Open / create from CLI

```bash
excalidraw-offline /path/to/drawing.excalidraw
```

Missing path → creates blank `.excalidraw` (parents included) and opens it.
Existing file → opens in GUI (may hand off to an already-running instance per app
rules). Prefer this over Cursor chat file links (those open in the editor, not
Excalidraw Offline). Linux after MIME install: `xdg-open path.excalidraw`.

### Export image (GUI)

**Ctrl+Shift+E** (⌘⇧E macOS) or upstream **Excalidraw → Export image…** opens
the upstream export dialog (preview, selection/background/**dark mode**/embed
scene, scale 1×–3×, PNG / SVG / clipboard). **PNG and SVG** use the **native save
picker** (default folder: directory of the saved `.excalidraw`, or home when
Untitled). App header shows status and saved path.

### Upstream Excalidraw on the canvas

Bundled Excalidraw includes standard tools plus recent upstream additions:

- **Frames** — frame elements (`type: "frame"`, `name` for labels); use for
  screen regions; CLI can export by frame name (see below).
- **Sticky notes** — shortcut **`N`**; element type `stickynote`.
- **Pan** — **right-click drag** to pan (upstream behavior; threshold ~5px).
- **Dark mode** — canvas theme in `appState.theme` (`"light"` / `"dark"`); toggle
  via upstream Excalidraw’s in-app menu. **Export image…** (Ctrl+Shift+E) also
  offers a **Dark mode** export option in the dialog.

Space+drag and other upstream shortcuts behave as in stock Excalidraw.

### Other native menus

- **Skills** — install this Agent Skill (above).
- **Info** — Runtime backend, Assets tip, About Excalidraw Offline (wrapper),
  About Excalidraw (upstream package version).

---

## Agent sketching (file CRUD)

Sketch by **writing and editing `.excalidraw` JSON** under the workspace
`sketches/` folder. Source of truth is the file on disk.

**Do not** use MCP tools, `mcp-excalidraw-server`, `npx` canvas servers, REST
canvas APIs, Mermaid-to-canvas converters, or share-link uploads.

### Scope

1. **UI wireframes** — screens, flows, controls
2. **Diagrams** — architecture, flow, decision trees
3. **CAD object sketches** — orthographic outlines, callouts (intent notes, not
   parametric models)

### File ops

Root: `<workspace-root>/sketches/` (create if missing).

| Op | How |
|----|-----|
| Create | Write `sketches/<name>.excalidraw` (valid scene JSON) |
| Read | Read file; summarize by `id` / label |
| Update | Patch elements; rewrite file |
| Delete | Remove file (+ unused `sketches/assets/<id>.*` if any) |

Naming: slug `sketches/<name>.excalidraw`; if exists, edit — do not overwrite
blindly. Only write under `sketches/`; plain JSON (not Obsidian `.excalidraw.md`).

After create/update: give the path and run `excalidraw-offline <path>` when on PATH.

### Document format

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

Pretty-print 2 spaces + trailing newline. Element/label rules: `references/cheatsheet.md`.

---

## Headless PNG export (CLI)

Same renderer as GUI (`exportToBlob`), via a short-lived hidden webview. **Does
not** join single-instance handoff. Requires packaged app / `deno desktop` webview
(not headless-only WSL without a host GUI).

### Help (stdout, exit 0, no GUI)

```bash
excalidraw-offline --help
excalidraw-offline -h
excalidraw-offline export --help
excalidraw-offline export -h
deno task export -- --help
```

Run these for authoritative flag text; summary below matches the shipped help.

### Flags (one selector kind per run)

| Flag | Meaning |
|------|---------|
| *(default)* | Whole scene bounding box |
| `--frame NAME` | Repeatable; **exact** frame name; one PNG per match |
| `--all-frames` | One PNG per **named** frame in the file |
| `--element ID` | Repeatable; one PNG with listed element ids selected |
| `--bbox x,y,width,height` | Scene coords; elements intersecting the rectangle |

| Output flag | Meaning |
|-------------|---------|
| `--out PATH` | Directory, or a single `.png` when exactly **one** export job |
| `-d DIR` | Same as `--out` (directory; **created recursively** if missing) |
| `--scale N` | Default `2`, max `8` |
| `--json` | stdout `{"paths":["…"]}` instead of one path per line |

**Default output dir:** folder containing the `.excalidraw` file.  
**Default filename:** `{drawingBase}_{YYYYMMDD-HHMMSS}.png`  
**Named frame:** `{drawingBase}_{frameNameSanitized}_{YYYYMMDD-HHMMSS}.png`  
**Collisions:** `-2`, `-3`, … before `.png`. Exit `1` on usage error, missing
file, unknown frame/element, empty bbox, or export failure.

### Repo checkout (dev)

Builds frontend, compiles `dist/linux/excalidraw-offline` if needed, then same argv:

```bash
deno task export -- <file.excalidraw> [options]
```

### Examples (fixture: `test-fixtures/e2e-export/matrix-demo.excalidraw`)

Frames in that file: `Dashboard`, `UI "mock" / v2`. Sample element id:
`rect-outside-id`.

```bash
DOC=test-fixtures/e2e-export/matrix-demo.excalidraw
OUT=/tmp/excalidraw-skill-export
mkdir -p "$OUT"

# Whole scene
excalidraw-offline export "$DOC"

# One frame (repeat --frame for multiple)
excalidraw-offline export "$DOC" --frame 'UI "mock" / v2' -d "$OUT"

# All named frames
excalidraw-offline export "$DOC" --all-frames -d "$OUT"

# Element selection + JSON paths on stdout
excalidraw-offline export "$DOC" --element rect-outside-id --json

# Bounding box + scale
excalidraw-offline export "$DOC" --bbox 0,0,900,500 --scale 3 -d "$OUT"

# Single explicit output file (only when one job)
excalidraw-offline export "$DOC" --element rect-outside-id --out "$OUT/one.png"

# Dev checkout equivalent
deno task export -- "$DOC" --frame Dashboard --json
deno task export -- "$DOC" --all-frames -d "$OUT"
```

Replace `excalidraw-offline` with `deno task export --` in a git checkout; keep
flags after `--`.

Humans can also use **Ctrl+Shift+E** (GUI export dialog) instead of CLI.

---

## Quality checklist (agent sketches)

1. Valid JSON at `sketches/<name>.excalidraw`
2. Labels via bound text or free-standing text (no fake `"text"` on shapes)
3. Tell human the path + `excalidraw-offline <path>` or export command
4. Do not git-commit unless asked

Full element reference: `references/cheatsheet.md`.
