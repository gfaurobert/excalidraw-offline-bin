# Skills Menu Design

## Goal

Native **Skills** menu to install the bundled `excalidraw-sketching` Agent Skill. Flow: `sketches/install-skills-user-flow.excalidraw`.

## Decisions

| Decision | Choice |
|----------|--------|
| Menu | File · **Skills** · Info |
| Item | Install excalidraw-sketching skill |
| Destinations | Global `~/.agents/skills/…`, Project `<root>/.agents/skills/…`, Custom `<picked>/…` (no `.agents/skills` appended) |
| Implementation | Native Deno + zenity/kdialog (Approach A) |
| Bundled payload | `skills/excalidraw-sketching/` via `--include=./skills` |
| Overwrite | Confirm dialog; decline aborts |

## Architecture

```
Skills → Install …
  → choiceDialog (global|project|custom)
  → [openDirectoryDialog if project/custom]
  → resolveInstallTarget → confirm if exists → copyDirRecursive
  → infoDialog success/error
```

## Research

See `docs/research/2026-07-31-agent-skills-locations.md` and sketch `sketches/install-skills-user-flow.excalidraw`.
