# Changelog

## v0.8.0 (2026-10-18)

First **unified Tauri 2** release for **Linux, Windows 11, and macOS** (universal).

- Remove the legacy Deno Desktop shell; Tauri 2 is the only desktop runtime
- Linux: AppImage + AUR-ready `PKGBUILD`; Arch package built in CI
- Windows: portable zip + NSIS installer; WebView2
- macOS: universal and arm64 zips; ad-hoc signed `.app`
- Version source of truth: `src-tauri/tauri.conf.json`, `Cargo.toml`, `packaging/PKGBUILD*`

## v0.7.2 and earlier

See [GitHub Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases) and [What's new](docs/site/whats-new.md).
