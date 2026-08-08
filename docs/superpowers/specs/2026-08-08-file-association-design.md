# File Association and CLI Open Design

## Goal

Make `.excalidraw` files open in Excalidraw Offline via:

- File manager double-click / Open with / `xdg-open`
- `excalidraw-offline /path/to/file.excalidraw` (agent-friendly)
- Skill: tell the user the path **and** launch via the CLI

Install targets for MIME registration: **makepkg/system package** and **AppImage**. Portable tarball stays non-registering.

## Decisions

| Decision | Choice |
|----------|--------|
| Scope | OS MIME + CLI path + XDG-runtime single-instance handoff + skill/docs |
| Cursor chat links | Document only: open in-editor, not via OS MIME; agents must run CLI |
| Handoff | Most recently focused instance if `start` or `pathed`; else new window |
| Untitled window | Never hand off (would trigger Save/Discard); secondary becomes new primary |
| Pathed dirty | Reuse existing `runOpen` / `ensureCleanForNavigation` silent flush |
| Start screen | Accept handoff / cold-start open into that window |
| Multi-file `%F` | Open first path only in v1 |
| Packaging | System package + AppImage MIME; tarball no registration |
| URI scheme | Out of scope (`excalidraw-offline://` not added) |

## Architecture

```text
Launch (CLI / xdg-open / double-click)
        │
        ▼
  Parse argv → absolute path (or none)
        │
        ▼
  XDG_RUNTIME_DIR instance registry
        │
   ┌────┴────┐
   │         │
 eligible   none / untitled-only
   │         │
   ▼         ▼
 POST open  Become primary
 → exit 0   register + open path or start screen
```

Reuse existing UI open path: enqueue `{ type: "open", path }` → frontend `runOpen` (already flushes dirty+pathed).

### Instance registry

Each process publishes under `$XDG_RUNTIME_DIR/excalidraw-offline/instances/<pid>.json`:

| Field | Meaning |
|-------|---------|
| `pid`, `port` | Local HTTP API (`127.0.0.1`) |
| `state` | `start` \| `untitled` \| `pathed` from `uiMode` + `currentPath` |
| `path` | Current file path or `null` |
| `lastFocusedAt` | ISO/ms updated when webview reports focus |

Stale entries: skip dead `pid` or failed health. On exit, remove own entry (best-effort).

### Focus tracking

Frontend posts `POST /api/focus` on `window` `focus` and `visibilitychange` (visible). Desktop updates `lastFocusedAt` and rewrites the registry file.

### Cold start with path

If this process is primary and argv has a path: after HTTP server + window are up, ensure the file exists (create a blank `.excalidraw` + parent dirs if missing), then enqueue `{ type: "open", path }`. Non-`.excalidraw` paths or create failures → status error; remain on start screen.

## Components

| Piece | Role |
|-------|------|
| `desktop/open-path.ts` | Ensure path exists (create blank `.excalidraw` if missing) before open |
| `desktop/cli-args.ts` | Pure parse of open path from `Deno.args` |
| `desktop/instance-registry.ts` | Register / unregister / list / pick handoff target |
| `desktop/main.ts` | Startup handoff; `/api/instance-state`, `/api/open-external`, `/api/focus` |
| `frontend/src/App.tsx` | Focus heartbeat |
| `packaging/excalidraw-offline.desktop` | `Exec=excalidraw-offline %F` + MimeType |
| `packaging/application-x-excalidraw.xml` | shared-mime-info for `*.excalidraw` |
| PKGBUILDs | Install MIME XML; update mime/desktop DBs |
| `scripts/package-linux-release.sh` | Ensure AppImage `.desktop` has MimeType + `%F` |
| `skills/excalidraw-sketching/SKILL.md` | Report path + launch CLI |
| Docs / use-cases / README | Association, CLI, Cursor caveat |

## Handoff API (localhost only)

- `GET /api/instance-state` → `{ ok, state, path, lastFocusedAt }`
- `POST /api/open-external` body `{ path }` → if `untitled` → `409` `{ accepted: false, reason: "untitled" }`; else enqueue open, `win.focus()`, `{ accepted: true }`
- `POST /api/focus` → bump `lastFocusedAt`

Secondary: resolve path → pick target → POST open-external → success exit `0`; reject/failure continue as primary with that path.

## Skill behavior

1. Tell the human the sketch path.
2. Run `excalidraw-offline <path>` when the binary is available; otherwise say so and fall back to manual open.
3. Note: Cursor chat file links open in the editor. `xdg-open <path>` works after MIME install.

## Explicit non-goals

- Cursor extension / custom editor association
- Custom URI scheme
- Portable tarball MIME registration
- macOS/Windows association (Linux first; CLI shape stays portable)
- Multi-file open beyond first path
