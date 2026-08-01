# Start Screen Design

## Goal

On launch, show a tldraw-style **start screen** (New / Open / Recent) instead of mounting Excalidraw immediately. Enter the canvas only after New, Open, or a recent file. **File → Close / Ctrl+W** returns to the start screen; **Quit** exits the app. Replace in-app typed-path and discard overlays with **native Zenity/KDialog** pickers and a Cancel / Save / Discard unsaved dialog.

## Decisions

| Decision | Choice |
|----------|--------|
| Layout | Mirror tldraw: bare white, centered brand + New/Open + Recent; **no** help `?` |
| Cold start | Always start screen; do not auto-open last file |
| Close (File → Close / Ctrl+W) | Return to start screen (unmount canvas) |
| Quit | Exit process (existing safe-quit handshake) |
| File → New on canvas | Dirty gate, then blank Untitled **on canvas** (not start) |
| Menus on start | Full File menu works (New / Open / Open Recent / …) |
| Dirty + path exists | Flush autosave / write; no discard prompt |
| Dirty + Untitled | Native **Cancel / Save / Discard** |
| Path pickers | Native only; remove React `PathDialog` |
| Discard confirm | Native only; remove React discard `ConfirmDialog` |
| Zenity unavailable | Status error; **no** typed-path fallback |
| Recent source | Existing desktop `recentStore` (`recent.json`) |
| Empty recent on start | Show muted “No recent files” (no fake rows) |

## Architecture

Frontend owns `mode: "start" | "canvas"`. Desktop keeps owning filesystem, recent list, menu accelerators, and native dialogs. UI requests pickers / unsaved choices over HTTP (same pattern as `/api/pick-image`).

```text
Launch → mode=start → GET /api/recent → StartScreen

New ──────────────────────────────► mode=canvas (blank)
Open → POST /api/pick-open ───────► path → /api/read → mode=canvas
Recent / menu open-with-path ─────► /api/read → mode=canvas

Close / Ctrl+W:
  path + dirty? → flush write → mode=start
  untitled + dirty? → POST /api/unsaved
       cancel → stay
       save → pick-save + write → mode=start
       discard → mode=start
  clean → mode=start

Quit → same dirty gate → POST /api/quit → exit
```

## Components

| Piece | Role |
|-------|------|
| `StartScreen` | Layout A: app icon + “Excalidraw offline”, New/Open rows with Ctrl N / Ctrl O, divider, Recent (basename + `>`) |
| `App` mode | `start` \| `canvas`; mount `<Excalidraw>` only in `canvas`; status header only on canvas |
| `UiCommand` | Add `{ type: "close" }`; keep `new` / `open` / `save` / `quit` / `status` |
| File menu | Add **Close** (`id: close`, `CmdOrCtrl+W`); order: New · Open · Open Recent · Close · separator · Save · Save As · … · Quit |
| `/api/recent` | `GET` → `{ ok, paths, labels }` from `recentStore` + `recentDisplayLabels` |
| `/api/pick-open` | POST → run `openExcalidrawDialog`; return path or cancelled/unavailable |
| `/api/pick-save` | POST optional suggested name → `saveExcalidrawDialog`; return path or cancelled/unavailable |
| `/api/unsaved` | POST → native Cancel / Save / Discard; return `{ choice }` or error |
| `dialogs.ts` | Add `unsavedChangesDialog` (and pure args builder for unit tests) |
| Remove | `PathDialog`, discard `ConfirmDialog`, and all `askPath` / typed-path fallbacks |

### Start screen actions

- **New file** / Ctrl+N / File → New: `mode = canvas`, blank scene, `path = null`
- **Open file** / Ctrl+O: `POST /api/pick-open`, then same open pipeline as today
- **Recent row**: open that absolute path; on missing file → status error, `recentStore.remove`, rebuild menu, refresh start list
- File → Open / Open Recent on start: same as today (menu Zenity or enqueue path), then UI switches to canvas on successful open

### Close vs New vs Quit

| Action | After successful dirty gate |
|--------|-----------------------------|
| Close | `mode = start`; clear path/scene refs; do not exit |
| New (on canvas) | Blank Untitled on canvas |
| Quit | `POST /api/quit` |

### Menu enablement

| Item | On start | On canvas |
|------|----------|-----------|
| New / Open / Open Recent / Quit | Enabled | Enabled |
| Close | Enabled (no-op if somehow idle) | Enabled |
| Save / Save As | No-op or disabled | Enabled |

Prefer **disabled** Save / Save As on start when the menu API allows toggling via `applyMenu`.

## Native dialogs

### Unsaved (Untitled + dirty)

Options: **Cancel**, **Save**, **Discard**.

- Cancel → abort pending Close / New / Open / Quit
- Save → run save picker (`/api/pick-save` or menu-equivalent path), write; on success continue the pending action; on cancel/fail abort
- Discard → discard scene changes and continue

Apply this gate anywhere the UI previously asked “Discard unsaved changes?” (Close, New, Open) and for Quit when Untitled + dirty (replacing “only path picker” with explicit Discard option as well).

When **path exists** and dirty: write/flush silently (aligned with safe-quit), then continue — no three-button dialog.

### Open / Save pickers

UI never prompts for a typed path. Call `/api/pick-open` or `/api/pick-save` when the UI itself needs a picker (start-screen Open, Save after unsaved→Save, Save As if ever driven from UI). Menu Open / Save / Save As keep running Zenity in the menu handler and enqueue commands with paths, as today — but **remove** the enqueue-without-path fallback that opens the typed-path dialog (`enqueueUi({ type: "open" })` / `forcePicker: true` without path). If menu Zenity is unavailable, enqueue status error only.

## Error handling

| Case | Behavior |
|------|----------|
| Picker cancelled | Stay in current mode; status cancelled |
| Dialog backend unavailable | Status error; no typed-path fallback |
| Open / recent missing | Status error; remove from recent; stay on start (or stay on canvas if Open from canvas failed) |
| Save failed after unsaved→Save | Abort pending action; stay on canvas; show error |
| `/api/unsaved` cancelled or error | Abort pending action |
| Close while already on start | No-op |
| Busy / dialog in flight | Existing `busyRef` / queue guards |

## Testing & acceptance

**Unit (`desktop/dialogs*_test.ts`):**

- Args builder for unsaved Cancel / Save / Discard (zenity + kdialog)

**Regression:** existing recent-files, dialogs, close-guard, file-format tests still pass.

**Manual:**

1. Launch → start screen only (Excalidraw not mounted)
2. New → blank canvas; Close → start; recent list refreshes after saves
3. Open via start button and File menu → Zenity → canvas
4. Recent row opens; deleted path → error + removed from list
5. Untitled dirty Close → Cancel stays; Discard → start; Save → picker + write → start
6. Pathed dirty Close → silent flush → start (no three-button dialog)
7. Quit exits the process
8. No React path or discard overlays appear

## Out of scope

- Help / `?` affordance
- Auto-reopen last session on launch
- Pinning / favorites / FreeDesktop `recently-used.xbel`
- Changing autosave timing
- macOS-specific dialog backends beyond current zenity/kdialog detection
