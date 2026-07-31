# Skills Menu — Install excalidraw-sketching

## Goal

Add a native **Skills** menu that installs the bundled `excalidraw-sketching` Agent Skill into a user-chosen destination.

## Flow

Source of truth: `sketches/install-skills-user-flow.excalidraw`

```
START → Skills → Install excalidraw-sketching skill
  → choice: Global | Project | Custom
  → (pick folder if Project/Custom)
  → copy skill tree
  → success/error dialog → END
```

## Destinations

| Mode | Destination |
|------|-------------|
| Global | `~/.agents/skills/excalidraw-sketching/` |
| Project | `<picked-root>/.agents/skills/excalidraw-sketching/` |
| Custom | `<picked>/excalidraw-sketching/` (no `.agents/skills` appended) |

## Architecture

- Native Deno only (same as Info): menu → zenity/kdialog → filesystem copy → infoDialog
- Bundled skill at `skills/excalidraw-sketching/` included via `--include=./skills`
- Source resolved as `join(ROOT, "skills", "excalidraw-sketching")`

## Components

| Piece | Role |
|-------|------|
| `skills/excalidraw-sketching/` | Bundled skill payload |
| `desktop/dialogs.ts` | choice list, directory picker, yes/no confirm |
| `desktop/install-skill.ts` | resolve paths, recursive copy, overwrite policy |
| `desktop/main.ts` | Skills menu + handler |
| `deno.json` / PKGBUILDs | `--include=./skills` |

## Errors

| Case | Behavior |
|------|----------|
| Cancel choice/folder | Status message; no copy |
| No zenity/kdialog | Info/status: dialogs unavailable |
| Target exists | Confirm overwrite; No/Cancel aborts |
| Missing bundled skill | Error dialog |
| Copy failure | Error dialog with detail |
