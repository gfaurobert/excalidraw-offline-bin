---
title: Usage
nav_order: 3
---

# Usage

## Start screen

On cold start the app shows a start screen (New / Open / Recent). The Excalidraw canvas mounts only after you choose an action. The app does not auto-open the last file.

![Start Screen](assets/start_screen_01.png)

## Files

- **New** (File → New / Ctrl+N)— blank Untitled drawing on the canvas
- **Open** (File → Open / Ctrl+O or ⌘O) — native file picker (zenity/kdialog on Linux, WinForms on Windows, osascript on macOS) for `.excalidraw` files anywhere on disk
- **Save** (File → Save / Ctrl+S or ⌘S) / **Save As**  (File → Save As / Ctrl+Shift+S or ⌘⇧S) — native file picker for `.excalidraw` files anywhere on disk
- **Open Recent** (File → Open recent) — up to 10 recently opened or saved paths (Linux: XDG config; Windows: `%APPDATA%\excalidraw-offline\recent.json`; macOS: `~/Library/Application Support/excalidraw-offline/recent.json`). Missing or unreadable paths are removed when selected
- **Close** (File → Close / Ctrl+W) — returns to the start screen (after unsaved prompts if needed)
- **Reload** (File → Reload / Ctrl+R or ⌘R) — re-reads the current file from disk and refreshes the canvas (disabled on the start screen and for Untitled drawings). Use this when something else changed the file on disk (e.g. a coding agent). Unsaved local edits trigger **Cancel / Save / Discard** (not a silent autosave) so reload does not overwrite external changes by accident
- **Quit** (File → Quit) — exits the app

### Open from CLI or file manager

```bash
excalidraw-offline /path/to/drawing.excalidraw
xdg-open /path/to/drawing.excalidraw   # Linux, after MIME install (package / AppImage integration)
```

```powershell
excalidraw-offline C:\path\to\drawing.excalidraw
```

```bash
open -a "Excalidraw Offline" --args /path/to/drawing.excalidraw   # macOS
"/Applications/Excalidraw Offline.app/Contents/MacOS/excalidraw-offline" /path/to/drawing.excalidraw
```

If the path does not exist yet, `excalidraw-offline` creates a blank `.excalidraw` there (parent directories included) and opens it. Existing files are opened as usual.

If another Excalidraw Offline window is already open on the **start screen** or a **saved** drawing, the file opens there (after a silent flush when the current drawing has a path). If the focused window is an **Untitled** sketch, a new window opens so you are not interrupted with Save/Discard.

### Cursor / agent note

Clicking a `.excalidraw` path in Cursor chat usually opens the file **inside the editor**, not in Excalidraw Offline. Agents should run `excalidraw-offline <path>` (or `xdg-open` on Linux, or `open -a "Excalidraw Offline" --args <path>` on macOS) instead of relying on chat links.

### Unsaved changes

- Dirty drawing with a path (Open, Close, New, Quit): flush/autosave write, then continue
- Dirty drawing with a path (**Reload**): native **Cancel / Save / Discard** — Discard drops local edits and loads disk; Save writes your version first, then reloads
- Dirty Untitled: native **Cancel / Save / Discard** dialog
- If zenity/kdialog (Linux), PowerShell WinForms (Windows), or osascript (macOS) is unavailable: status error; there is no typed-path fallback



## Autosave

Once a drawing has a file path, autosave writes back to that `.excalidraw` file. Brand-new Untitled drawings need Save / Save As before autosave can write. Crash recovery from a separate temp location is not part of the first version.

## Skills

Use **Skills → Install excalidraw-sketching skill** to copy the bundled [Agent Skill](https://agentskills.io) into a destination your coding agents can read.

![Skills menu](assets/install_skills_01.png)

Choose where to install:

- **Global (user)** — `~/.agents/skills/excalidraw-sketching/`
- **Project** — pick a project root, then `<root>/.agents/skills/excalidraw-sketching/`
- **Custom** — pick any folder; the skill is copied there as-is (no `.agents/skills` appended)

![Install skill dialog](assets/install_skills_02.png)

If the destination already exists, the app asks before overwriting. Decline aborts the install.

## Menus

- **Info** (native dialogs): Runtime backend, Assets tip, About Excalidraw Offline (wrapper version), About Excalidraw (upstream package version)

Transient open/save status appears in the app header (not a footer).
