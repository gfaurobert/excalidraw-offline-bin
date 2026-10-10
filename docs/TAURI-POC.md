# Tauri 2 proof-of-concept

## Architecture choice

The existing `frontend/` talks to the desktop through **same-origin HTTP** (`fetch("/api/…")`), not Tauri `invoke`. To reuse the Vite bundle unchanged, the POC keeps that contract:

1. A **Tokio + Axum** server on `127.0.0.1:<ephemeral>` serves `frontend/dist` and implements the Deno-compatible `/api/*` routes (poll queue, read/write scene, native pickers, CLI export session).
2. The Tauri **WebView** loads `http://127.0.0.1:<port>/` (GUI) or `export-cli.html` (headless export), same as Deno Desktop’s hidden webview for `excalidraw-offline export`.

### Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| **Local HTTP (chosen)** | Zero frontend diff; same export path as Deno (`export-cli.html` + `exportToBlob`); easy to debug with curl | Extra localhost server; must ship `frontend/dist` in the bundle; not idiomatic Tauri |
| Tauri `invoke` + asset protocol | Smaller surface, no HTTP server | Requires rewriting all `fetch("/api/…")` calls or a fetch shim |
| Embedded Deno runtime | Reuse `desktop/*.ts` | Huge binary, defeats migration goal |

**CLI PNG rendering:** identical to Deno — WebKitGTK webview runs `@excalidraw/excalidraw` `exportToBlob` in `frontend/src/export-cli-main.tsx`, posts base64 PNGs back to Rust for filesystem writes.

**Native dialogs:** `rfd` (GTK on Linux) with directory preloaded from the drawing folder for Save/Save As, matching zenity `--filename=` behavior.

## Not yet ported (POC gaps)

- Skills multi-select installer (zenity/kdialog checklist flow)
- Info menu dialogs (runtime/assets/about)
- Open Recent menu refresh after `/api/set-mode` (menu rebuild hook)
- Single-instance handoff registry
- File associations (Linux/macOS/Windows)
- E2E harness endpoints
- macOS/Windows builds (Linux-only POC)
- Close/save guards wired to window title updates
