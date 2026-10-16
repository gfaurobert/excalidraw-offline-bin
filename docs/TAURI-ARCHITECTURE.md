# Tauri 2 architecture

## Runtime shape

1. A **Tokio + Axum** server on `127.0.0.1:<ephemeral>` serves embedded `frontend/dist` and implements `/api/*` routes (poll queue, read/write scene, native pickers, CLI export session).
2. The Tauri **WebView** loads `http://127.0.0.1:<port>/` (GUI) or `export-cli.html` (headless export).

## Design choices

| Approach | Pros | Cons |
|----------|------|------|
| **Local HTTP (chosen)** | Zero frontend diff; same export path (`export-cli.html` + `exportToBlob`); easy to debug with curl | Extra localhost server; must ship frontend in the bundle |
| Tauri IPC + asset protocol | Idiomatic Tauri | Large frontend refactor |

**CLI PNG rendering:** WebKitGTK / WebView2 / WKWebView runs `@excalidraw/excalidraw` `exportToBlob` in `frontend/src/export-cli-main.tsx`, posts base64 PNGs back to Rust for filesystem writes.

**Native dialogs:** Linux uses **zenity** when available, else `rfd`. Windows and macOS use `rfd` / AppKit as appropriate. Save/Save As use `--filename=<full path>` so the picker opens in the drawing folder with the basename prefilled.

**Menu state:** `refresh_menu()` runs after `/api/set-mode`, `/api/read`, `/api/write`, and `/api/set-path` so Reload/Save enablement tracks canvas + path.

**Lean Linux tarball:** `scripts/package-tauri-linux-tarball.sh` builds `payload.tar.xz` (binary + frontend dist) for size comparisons; requires system `webkit2gtk-4.1`. AppImage (~82 MiB) bundles WebKit/GTK via linuxdeploy.

**Version source of truth:** `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `packaging/PKGBUILD*` must match (`scripts/release-version.sh` checks this).
