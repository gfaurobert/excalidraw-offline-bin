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

**Native dialogs:** On Linux, **zenity** (same as Deno) when available, else `rfd`. Save/Save As use `--filename=<full path>` so the picker opens in the drawing folder with the basename prefilled.

**Menu state:** `refresh_menu()` runs after `/api/set-mode`, `/api/read`, `/api/write`, and `/api/set-path` so Reload/Save enablement tracks canvas + path (matches Deno `applyMenu()`).

**Lean Linux tarball:** `scripts/package-tauri-linux-tarball.sh` builds `payload.tar.xz` (binary + `resources/` frontend dist) for like-for-like size comparison with Deno’s compressed payload (~5.5 MiB vs ~23 MiB); requires system `webkit2gtk-4.1`. AppImage (~82 MiB) bundles WebKit/GTK via linuxdeploy.

## Not yet ported (POC gaps)

- Skills multi-select installer (zenity/kdialog checklist flow)
- Info menu dialogs (runtime/assets/about)
- Open Recent menu refresh after `/api/set-mode` (menu rebuild hook)
- Single-instance handoff registry
- File associations (Linux/macOS/Windows)
- E2E harness endpoints
- macOS/Windows builds (Linux-only POC)
- Close/save guards wired to window title updates
