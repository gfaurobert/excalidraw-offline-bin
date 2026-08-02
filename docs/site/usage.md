---
title: Usage
nav_order: 3
---

# Usage

## Start screen

On cold start the app shows a start screen (New / Open / Recent). The Excalidraw canvas mounts only after you choose an action. The app does not auto-open the last file.

## Files

- **New** — blank Untitled drawing on the canvas
- **Open** / **Save** / **Save As** — native zenity or kdialog file pickers for `.excalidraw` files anywhere on disk
- **Open Recent** — up to 10 recently opened or saved paths (persisted under XDG config). Missing or unreadable paths are removed when selected
- **Close** (File → Close / Ctrl+W) — returns to the start screen (after unsaved prompts if needed)
- **Quit** — exits the app

### Unsaved changes

- Dirty drawing with a path: flush/autosave write, then continue
- Dirty Untitled: native **Cancel / Save / Discard** dialog
- If zenity/kdialog is unavailable: status error; there is no typed-path fallback

## Autosave

Once a drawing has a file path, autosave writes back to that `.excalidraw` file. Brand-new Untitled drawings need Save / Save As before autosave can write. Crash recovery from a separate temp location is not part of the first version.

## Menus

- **Info** (native dialogs): Runtime backend, Assets tip, About Excalidraw Offline (wrapper version), About Excalidraw (upstream package version)
- **Skills**: install the bundled `excalidraw-sketching` Agent Skill to Global (`~/.agents/skills`), Project (`<root>/.agents/skills`), or Custom (folder as-is)

Transient open/save status appears in the app header (not a footer).
