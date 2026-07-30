# Info Menu Design

## Goal

Move permanent footer tips into a native **Info** application menu with zenity/kdialog dialogs. Remove the footer. Show transient status in the header instead.

## Decisions

| Decision | Choice |
|----------|--------|
| Menu location | Native app menu bar: **Info** (next to File) |
| Menu shape | Flat: four enabled items, one dialog each |
| Dialog backend | zenity/kdialog info box (same family as file pickers) |
| Footer | Remove entirely |
| Transient status | Header (existing `status` state / poll commands) |
| App version source | Root `deno.json` `version` |
| Upstream version source | Installed `@excalidraw/excalidraw` (package.json / lock) |
| Ownership | Desktop owns Info menu + info dialogs; frontend only relocates status UI |

## Architecture

```text
Info → Runtime | Assets | About Excalidraw Offline | About Excalidraw
        │
        ▼
  menuclick (Deno)
        │
        ▼
  infoDialog(title, text)  →  zenity --info / kdialog --msgbox
```

Startup no longer enqueues `Ready · dialog: …` as a UI status message. That string is shown only via **Info → Runtime**.

## Components

| Piece | Role |
|-------|------|
| `desktop/dialogs.ts` | Add `infoDialog(title, text)` using zenity `--info` / kdialog `--msgbox` (or equivalent); keep fallback when neither tool exists |
| `desktop/dialogs_test.ts` | Cover backend selection / args for info dialogs |
| `desktop/main.ts` | Add Info submenu to `applyMenu`; wire menu ids; resolve versions at startup; drop Ready status enqueue |
| `frontend/src/App.tsx` | Remove footer; render `status` in header; stop forcing Ready dialog string from `/api/info` |
| `README.md` / `use-cases.md` | Document Info menu; note header status |

### Menu shape

**Application menus:** File · **Info**

**Info items (order):**

1. Runtime — `id: info-runtime`
2. Assets — `id: info-assets`
3. About Excalidraw Offline — `id: info-about-app`
4. About Excalidraw — `id: info-about-excalidraw`

### Dialog copy

| Item | Title | Body |
|------|-------|------|
| Runtime | Runtime | `Ready · dialog: {dialogBackend}+http` (same meaning as today’s footer/status string) |
| Assets | Assets | `Images save into assets/ next to the .excalidraw file.` |
| About Excalidraw Offline | About Excalidraw Offline | App name, wrapper version from `deno.json`, one-line description that this is a Deno Desktop offline wrapper |
| About Excalidraw | About Excalidraw | Upstream `@excalidraw/excalidraw` resolved version (e.g. `0.18.1`) |

### Frontend status

- Delete the `<footer>` block (status + permanent assets tip).
- Show `{status}` in the header (alongside brand / path label).
- Keep poll handling for `{ type: "status", message }` so open/save/cancel/errors still surface.
- `/api/info` may still set `homeRef` and log connectivity; do not rewrite status to `Ready · dialog: …` on success. Connectivity failure may still set a header status such as `HTTP API unavailable`.

### Startup (desktop)

1. Resolve `dialogBackend`, app version, Excalidraw version.
2. Build menu including Info (via existing `applyMenu`).
3. Do **not** enqueue the Ready dialog string as UI status.
4. Log dialog backend to console as today.

## Error handling

| Case | Behavior |
|------|----------|
| Neither zenity nor kdialog | `infoDialog` returns unavailable; log warning; optional brief header status |
| Version file unreadable | Show `unknown` in the About dialog body; do not crash menu build |
| Info while file dialog busy | Same as other menu handlers (async; no webview binding) |

## Testing & acceptance

**Unit (`desktop/dialogs_test.ts`):**

- `infoDialog` prefers zenity when present, else kdialog
- Args include title and text appropriately

**Manual:**

1. Footer gone; header shows transient status after Open/Save/cancel
2. Info → Runtime shows Ready · dialog string
3. Info → Assets shows assets/ tip
4. Info → About Excalidraw Offline shows app version from `deno.json`
5. Info → About Excalidraw shows upstream package version
6. No Ready string auto-injected into header on successful `/api/info`

## Out of scope

- In-app Info button / webview About modal
- Single combined Info dialog
- About submenu nesting
- Changing File menu behavior
- Shipping zenity/kdialog alternatives beyond current dialog backend
