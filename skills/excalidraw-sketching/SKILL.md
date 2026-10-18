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

**Excalidraw Offline** is a local **Tauri 2** desktop app for `.excalidraw` files.
It embeds upstream Excalidraw in the system webview with **native OS dialogs**
(Linux: zenity/kdialog or rfd; Windows: rfd; macOS: AppKit). No MCP, no canvas
server, no share links.

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

| Action | Menu / shortcut (Linux & Windows) | macOS (canvas webview) |
|--------|-----------------------------------|-------------------------|
| New | File → New · **Ctrl+N** | **⌘N** |
| Open | File → Open… · **Ctrl+O** | **⌘O** |
| Open Recent | File → Open Recent · up to 10 MRU paths (missing paths dropped on use) | same |
| Close | File → Close · **Ctrl+W** · returns to start screen | **⌘W** |
| Reload | File → Reload · **Ctrl+R** · re-reads saved file from disk (see below) | **⌘R** |
| Save | File → Save · **Ctrl+S** | **⌘S** |
| Save As | File → Save As… · **Ctrl+Shift+S** | **⌘⇧S** |
| Quit | File → Quit · **Ctrl+Q** | **⌘Q** |

Native menu labels may show `Ctrl+…` on all platforms; the canvas handler
accepts **Ctrl** (Linux/Windows) or **⌘ (Meta)** on macOS.

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

**Existing file** → opens in the GUI. **Missing file** → open **fails** (status
error); the app does **not** create a blank file. Create the JSON first (see
[Agent sketching](#agent-sketching-file-crud)), then pass the path.

Each launch is a **separate process/window** (no single-instance handoff). Prefer
CLI paths over Cursor chat file links (those open in the editor, not Excalidraw
Offline).

**File associations (Tauri build):** the Arch **`excalidraw-offline` package**
installs `application/x-excalidraw` + `.desktop` so `xdg-open file.excalidraw`
works after package install. Release **AppImage** may need MIME/`%F` patching
(see repo `scripts/patch-appimage-mime.sh`). **Windows and macOS Tauri builds**
do not register `.excalidraw` handlers yet — pass the path as a CLI argument
(macOS: `open -a "Excalidraw Offline" --args /path/to/file.excalidraw`).

### Export image (GUI)

**Ctrl+Shift+E** (Linux/Windows) or **⌘⇧E** (macOS), or upstream **Excalidraw →
Export image…**, opens the upstream export dialog (preview, selection/background/**
dark mode**/embed scene, scale 1×–3×, PNG / SVG / clipboard). **PNG and SVG** use
the **native save picker** (default folder: directory of the saved `.excalidraw`,
or home when Untitled). App header shows status and saved path.

### Upstream Excalidraw on the canvas

Bundled Excalidraw includes standard tools plus recent upstream additions:

- **Frames** — frame elements (`type: "frame"`, `name` for labels); use for
  screen regions; CLI can export by frame name (see below).
- **Sticky notes** — shortcut **`N`**; element type `stickynote`.
- **Pan** — **right-click drag** to pan (upstream behavior; threshold ~5px).
- **Dark mode** — canvas theme in `appState.theme` (`"light"` / `"dark"`); toggle
  via upstream Excalidraw’s in-app menu. **Export image…** also offers a **Dark
  mode** export option in the dialog.

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

Same renderer as GUI (`exportToBlob`), via a short-lived hidden webview. **Does not**
open the main GUI window. Needs a display stack (Linux: X11/Wayland or **Xvfb** for
headless CI; Windows/macOS: WebView2 / WKWebView).

### Help (stdout, exit 0, no GUI)

```bash
excalidraw-offline --help
excalidraw-offline -h
excalidraw-offline export --help
excalidraw-offline export -h
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

### Invoking the binary (per OS)

Use the same `export` subcommand and flags after the binary path on every platform.

#### Linux

| Install | Binary |
|---------|--------|
| **Arch package** (PKGBUILD → `/usr/bin`) | `excalidraw-offline` |
| **AppImage** (release name) | `./excalidraw-offline-<version>-linux-x86_64.AppImage` |
| **Dev build** (repo) | `src-tauri/target/release/excalidraw-offline` |

```bash
DOC=test-fixtures/e2e-export/matrix-demo.excalidraw
OUT=/tmp/excalidraw-skill-export
mkdir -p "$OUT"

# Whole scene (default bbox)
/usr/bin/excalidraw-offline export "$DOC"
# or dev binary:
# xvfb-run -a ./src-tauri/target/release/excalidraw-offline export "$DOC"

# Single frame
excalidraw-offline export "$DOC" --frame 'UI "mock" / v2' -d "$OUT"

# All named frames
excalidraw-offline export "$DOC" --all-frames -d "$OUT"

# Element selection + JSON paths on stdout
excalidraw-offline export "$DOC" --element rect-outside-id --json

# Bounding box + scale
excalidraw-offline export "$DOC" --bbox 0,0,900,500 --scale 3 -d "$OUT"

# Single explicit output file (only when one job)
excalidraw-offline export "$DOC" --element rect-outside-id --out "$OUT/one.png"
```

On headless Linux (CI, SSH): prefix with `xvfb-run -a` so WebKitGTK has a display.

#### Windows (PowerShell)

| Install | Binary |
|---------|--------|
| **NSIS** (per-user default) | `"$env:LOCALAPPDATA\Excalidraw Offline\excalidraw-offline.exe"` |
| **Portable zip** | `Excalidraw-Offline.exe` next to the extracted folder |

PowerShell may return to the prompt before the process prints paths. Use
**`-Wait`** (and often **`-NoNewWindow`**) or capture output explicitly:

```powershell
$Doc = "C:\path\to\matrix-demo.excalidraw"
$Out = "C:\temp\excalidraw-skill-export"
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$Bin = "$env:LOCALAPPDATA\Excalidraw Offline\excalidraw-offline.exe"
# Portable: $Bin = "C:\path\to\Excalidraw-Offline.exe"

# Whole scene
& $Bin export $Doc | Out-Host

# Single frame (wait for completion)
$p = Start-Process -FilePath $Bin -ArgumentList @(
  "export", $Doc, "--frame", "Dashboard", "-d", $Out
) -Wait -NoNewWindow -PassThru
if ($p.ExitCode -ne 0) { throw "export failed $($p.ExitCode)" }

# Frame with embedded quotes: PS 5.1 strips inner " from --frame values; the CLI
# also matches with quotes removed. Prefer escaped quotes when you need an exact name:
#   --frame 'UI `"mock`" / v2'
& $Bin export $Doc --frame 'UI mock / v2' -d $Out

# All frames + JSON
& $Bin export $Doc --all-frames -d $Out | Out-Host
& $Bin export $Doc --element rect-outside-id --json | Out-Host

# Explicit single PNG
& $Bin export $Doc --element rect-outside-id --out "$Out\one.png" | Out-Host
```

Successful CLI exports stay quiet on stderr (errors only). A leftover WebView2
line like **`Failed to unregister class`** can still appear on some Windows builds;
treat it as harmless when exit code is 0 and PNG path(s) are on stdout.

Export flags require the **`export`** subcommand (`excalidraw-offline export ...`).
Headless export over SSH should exit after writing PNGs (non-interactive sessions).

#### macOS

| Install | Binary |
|---------|--------|
| **`.app` bundle** | `"Excalidraw Offline.app/Contents/MacOS/excalidraw-offline"` |

(`productName` / bundle folder: **Excalidraw Offline**; executable name:
**excalidraw-offline** — see `src-tauri/tauri.conf.json` and
`scripts/verify-tauri-macos.sh`.)

```bash
BIN="/Applications/Excalidraw Offline.app/Contents/MacOS/excalidraw-offline"
DOC="/path/to/matrix-demo.excalidraw"
OUT="/tmp/excalidraw-skill-export"
mkdir -p "$OUT"

"$BIN" export "$DOC"
"$BIN" export "$DOC" --frame 'Dashboard' -d "$OUT"
"$BIN" export "$DOC" --all-frames -d "$OUT"
"$BIN" export "$DOC" --element rect-outside-id --json
"$BIN" export "$DOC" --bbox 0,0,900,500 --scale 3 -d "$OUT"
"$BIN" export "$DOC" --element rect-outside-id --out "$OUT/one.png"
```

GUI open with path: `open -a "Excalidraw Offline" --args "$DOC"`

### Repo checkout (dev build)

```bash
cd frontend && pnpm install --frozen-lockfile && pnpm run build
cd ../src-tauri && cargo build --release --locked --features tauri/custom-protocol
export BIN="$PWD/target/release/excalidraw-offline"
"$BIN" export --help
```

### Examples (fixture: `test-fixtures/e2e-export/matrix-demo.excalidraw`)

Frames in that file: `Dashboard`, `UI "mock" / v2`. Sample element id:
`rect-outside-id`.

Humans can also use **Ctrl+Shift+E** / **⌘⇧E** (GUI export dialog) instead of CLI.

---

## Quality checklist (agent sketches)

1. Valid JSON at `sketches/<name>.excalidraw`
2. Labels via bound text or free-standing text (no fake `"text"` on shapes)
3. Tell human the path + `excalidraw-offline <path>` or export command
4. Do not git-commit unless asked

Full element reference: `references/cheatsheet.md`.
