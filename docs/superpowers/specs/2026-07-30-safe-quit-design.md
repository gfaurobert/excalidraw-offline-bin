# Safe Quit Design

## Goal

Make **File → Quit** and **window close** (title-bar X / Alt+F4) safely exit the app: persist unsaved work first, and never quit if the user cancels the save path prompt or if a write fails.

## Decisions

| Decision | Choice |
|----------|--------|
| Cancel / save failure | Abort quit; stay open |
| Window close | Same flow as File → Quit |
| Dirty + existing path | Silent save, then quit |
| Dirty + no path | Prompt for path (existing save picker), then save and quit |
| Clean document | Quit immediately |
| Confirm “Save before quitting?” when path exists | No — save silently |

## Architecture

Quit is a handshake between Deno Desktop and the React UI, using the existing menu → HTTP poll queue → UI handler pattern.

```text
File → Quit  ─┐
              ├─► preventDefault (if close) ─► enqueue { type: "quit" }
Window close ─┘                                      │
                                                     ▼
                                              UI runQuit()
                                      dirty? ──yes──► save (reuse save path)
                                        │                 │
                                        │            cancel/fail → abort
                                        │                 │
                                        no / success ◄────┘
                                        │
                                        ▼
                                  POST /api/quit
                                        │
                                        ▼
                          allowClose = true; win.close()
```

### Desktop (`desktop/main.ts`)

1. Replace `{ role: { role: "quit" } }` with a custom menu item:
   - label: `Quit`
   - id: `quit`
   - accelerator: `CmdOrCtrl+Q`
2. On `menuclick` with `id === "quit"`: enqueue `{ type: "quit" }`.
3. Listen for window `"close"`:
   - If `allowClose` is true, allow the close to proceed.
   - Otherwise `e.preventDefault()` and enqueue `{ type: "quit" }`.
4. Add `POST /api/quit`:
   - Set `allowClose = true`.
   - Call `win.close()`.
   - Then `Deno.exit(0)`. The HTTP `Deno.serve` listener would otherwise keep the process alive after the window closes; the former menu `{ role: "quit" }` exited the process, and we must preserve that.
5. Extend `UiCommand` with `{ type: "quit" }`.

### Frontend (`frontend/src/App.tsx`)

1. Extend the polled `UiCommand` union with `"quit"`.
2. Add `runQuit`:
   - Guard with an in-flight quit / `busyRef` so duplicate quit commands (Quit + X) are ignored while a quit or other file op is running.
   - If not dirty: `POST /api/quit` and return.
   - If dirty: call the same save logic as `runSave` without a preset path when needed (existing path → write; no path → in-webview `askPath`, matching Save’s fallback when the native picker is unavailable). A shared desktop pick-save API for quit is out of scope.
   - If save cancelled or write fails: abort quit (status message already covers failures).
   - On successful save (or already clean): `POST /api/quit`.
3. Refactor lightly so save returns success/failure (e.g. `writeSceneToPath` / `runSave` return `boolean`) for `runQuit` to branch on. No new “Discard?” dialog on quit.

### Re-entrancy

Calling `win.close()` after `/api/quit` fires `"close"` again. The `allowClose` flag must be set **before** `win.close()` so the second event is not prevented and does not re-enqueue quit.

## Error handling

| Case | Behavior |
|------|----------|
| Save path dialog cancelled | Abort quit |
| Write fails | Abort quit; keep existing “Save failed…” status |
| Busy (open/save in progress) | Skip quit command until idle (same busy guard as save/open) |
| Dialog already open | Poll loop already pauses; quit remains queued |

## Out of scope

- “Don’t Save” / discard-and-quit option
- Multi-window apps
- Changing New/Open discard confirm behavior
- Automated E2E of the native window close path

## Manual verification

1. Clean untitled → Quit / window X → app exits.
2. Dirty with path → Quit → file updated on disk, app exits.
3. Dirty without path → Quit → picker appears; choose path → saved and exits.
4. Dirty without path → Quit → cancel picker → app stays open, drawing intact.
5. Simulate write failure (if practical) → Quit aborts, status shows failure.
6. Window X matches File → Quit in all of the above.
