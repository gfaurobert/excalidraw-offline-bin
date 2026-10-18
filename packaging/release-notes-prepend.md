## Tauri 2 — Linux, Windows 11, and macOS

This release ships the **Tauri 2** desktop app on **all supported platforms** (system webview; no bundled Deno runtime).

### Downloads

| Platform | Assets |
|----------|--------|
| **Linux x86_64** | AppImage, `excalidraw-offline-<ver>-linux-x86_64.tar.gz`, Arch `PKGBUILD` / `PKGBUILD-bin`, prebuilt `.pkg.tar.zst`, `SHA256SUMS` |
| **Windows 11 x64** | Portable zip, NSIS installer, `SHA256SUMS-windows-x86_64` |
| **macOS 11+** | Universal and Apple Silicon arm64 `.zip` (`.app` inside), `SHA256SUMS-macos` |

### Highlights (since v0.7.2)

- **Tauri 2 shell** on Linux, Windows, and macOS — smaller Linux binary (~19 MB stripped) using WebKitGTK / WebView2 / WKWebView
- **Native OS dialogs** (GTK / Win32 / AppKit) for open, save, and unsaved prompts
- **Skills → Install excalidraw-sketching skill** with Global / Project / Custom targets; skill embedded in the binary
- **Headless export CLI** (`excalidraw-offline export`) and GUI **Export image…** on all platforms
- **macOS universal** `.app` (Apple Silicon + Intel), ad-hoc signed — right-click → **Open** on first launch if Gatekeeper blocks

**Not in this release:** single-instance handoff and OS file associations (double-click `.excalidraw`); pass the path as a CLI argument.
