# Open Recent Design

## Goal

Remove the non-functional **Edit** menu (Excalidraw already handles undo/redo/clipboard via keyboard shortcuts). Add **File → Open Recent** as a nested submenu of recently used `.excalidraw` paths so users can reopen drawings without a file picker.

## Decisions

| Decision | Choice |
|----------|--------|
| Edit menu | Remove entirely |
| UI shape | `File → Open Recent →` nested submenu |
| Cap | 10 paths, most-recent first |
| When to record | After successful Open, Save, or Save As (`/api/read`, `/api/write`) |
| Missing path on click | Status error, remove from list, rebuild menu; do not enqueue open |
| Clear Recent | Yes — separator + Clear Recent (disabled when empty) |
| Ownership | Desktop-owned store + menu rebuild |
| Open semantics | Reuse existing `{ type: "open", path }` (same dirty-save flow as File → Open) |

## Architecture

Desktop owns recent files end-to-end. A small module persists an ordered path list. The application menu is rebuilt whenever that list changes. Opening a recent entry reuses the existing Open command path.

```text
Open / Save / Save As succeed
        │
        ▼
  /api/read or /api/write
        │
        ▼
  recent.touch(path) → disk + rebuild File menu
        │
File → Open Recent → path
        │
        ▼
  stat path → ok? enqueue { type: "open", path }
              missing? status + drop + rebuild
```

## Components

| Piece | Role |
|-------|------|
| `desktop/recent-files.ts` | Load/save JSON; `touch(path)`, `clear()`, `list()`, `remove(path)`; cap 10; MRU order; display-label helper |
| `desktop/recent-files_test.ts` | Unit tests for touch/dedupe/cap/remove/clear + load missing/corrupt + labels |
| `desktop/main.ts` | Drop Edit menu; add Open Recent submenu; rebuild menu on list changes; wire menu ids; call `touch` after successful read/write |
| `use-cases.md` / `README.md` | Document Open Recent; remove “recent files list” from first-version non-goals |

### Menu shape

**File menu order:** New · Open… · **Open Recent →** · separator · Save · Save As… · separator · Quit

**Open Recent submenu:**

- Up to 10 entries; label = basename, or basename plus disambiguating parent when basenames collide
- Empty list: one disabled “(No recent files)” placeholder
- Separator
- Clear Recent (`id: clear-recent`), disabled when empty

**Menu ids:** `recent:<absolute-path>` for entries; `clear-recent` for clear.

### Persistence

- Path: `$XDG_CONFIG_HOME/excalidraw-offline/recent.json` (fallback `~/.config/excalidraw-offline/recent.json`)
- Shape: `{ "version": 1, "paths": ["…"] }` — absolute paths, most-recent first
- Corrupt or missing file: treat as empty list; overwrite on next successful `touch`

### Startup

On app start: load recent.json (or empty), then build the application menu once so Open Recent is populated before any file ops.

### Record rules

- Call `touch(path)` only after successful `/api/read` and `/api/write`
- Do not record cancelled pickers, failed writes, or `/api/set-path` alone
- `touch`: dedupe, move to front, truncate to 10, write disk, rebuild menu
- Menu id parsing: strip the `recent:` prefix; the remainder is the absolute path (Linux paths are `/…`)

### Open Recent click

1. Parse absolute path from menu id (`recent:<path>`)
2. `Deno.stat(path)` — if missing/unreadable: enqueue status message, `remove(path)`, rebuild menu; stop
3. If ok: `enqueueUi({ type: "open", path })` — UI handles dirty document the same as File → Open

### Clear Recent

`clear()` → empty list on disk → rebuild menu.

### Frontend

No new `UiCommand` types. Existing `open` with `path` is sufficient. No Edit-menu wiring.

## Error handling

| Case | Behavior |
|------|----------|
| Recent path missing on disk | Status error; remove entry; rebuild menu |
| Config file missing/corrupt | Empty list; next touch rewrites |
| Clear when empty | Menu item disabled; no-op if invoked |
| Open Recent while dirty | Same as File → Open (existing UI flow) |
| Open Recent while busy / dialog open | Same poll/`busyRef` guards as other file commands |

## Testing & acceptance

**Unit (`desktop/recent-files_test.ts`):**

- `touch` bumps and dedupes
- Cap at 10
- `remove` / `clear`
- Load missing or corrupt → empty
- Label helper: basename vs disambiguation on collision

**Manual:**

1. Edit menu gone; Ctrl+Z / clipboard still work in Excalidraw
2. Open a file → appears under Open Recent
3. Save As to a new path → that path is #1
4. Re-open an older recent → it moves to top
5. Delete a recent file on disk, pick it → error status, entry removed
6. Clear Recent → empty placeholder
7. Restart app → list persists
8. Open Recent with dirty canvas → same save prompt as File → Open

## Out of scope

- System FreeDesktop `recently-used.xbel` integration
- UI-owned / localStorage recent list
- Accelerators for individual recent entries
- Pinning or favorites
