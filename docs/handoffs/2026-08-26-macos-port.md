# Handoff: Smoke-test Excalidraw Offline on Apple Silicon macOS

**Date:** 2026-08-26  
**Repo:** https://github.com/gfaurobert/excalidraw-offline-bin  
**Branch:** `cursor/macos-arm64-port-fff0`  
**Focus:** Verify the macOS arm64 port on a real M-series Mac (M5 MBA). Unit tests and packaging scripts were written on Linux; WKWebView, osascript dialogs, Gatekeeper, and `hdiutil` cannot be smoke-tested here.

## What landed

- osascript AppleScript dialogs (open/save/image/folder/info/confirm/unsaved Save-Discard-Cancel/skill choice)
- Darwin paths (`~/Library/Application Support/excalidraw-offline/recent.json`, `$TMPDIR/.../instances`)
- CLI open + single-instance handoff (same HTTP registry as Linux/Windows)
- Packaged `.app` Info.plist UTI `dev.excalidraw.offline.drawing`; `lsregister -f` on launch (skipped for `deno` during `deno task start`)
- Release artifacts: DMG + zip of `.app` + `SHA256SUMS-macos-arm64` (CI on `macos-latest` with `--target aarch64-apple-darwin`)

Design: `docs/superpowers/specs/2026-08-26-macos-arm64-port-design.md`  
Plan: `docs/superpowers/plans/2026-08-26-macos-arm64-port.md`

Earlier assessment (now implemented): `docs/handoffs/2026-07-31-macos-port.md`.

## Dev loop on the Mac

Prereqs: Deno **≥ 2.9**, Git. WKWebView and `osascript` are system.

```bash
git clone https://github.com/gfaurobert/excalidraw-offline-bin.git
cd excalidraw-offline-bin
git checkout cursor/macos-arm64-port-fff0
cd frontend; deno install; deno task build; cd ..
deno task start
```

## Smoke checklist

1. Start screen: New / Open / Recent
2. Open/Save `.excalidraw` via osascript picker; extension appended if omitted
3. Untitled dirty Close/Quit → Save / Discard / Cancel
4. Import image → sibling `assets/`
5. Skills → install Global (`~/.agents/skills`)
6. Info → Runtime shows `osascript+http`
7. CLI: `deno desktop -A --backend=webview --include=./frontend/dist --include=./icons --include=./skills ./desktop/main.ts ~/Desktop/demo.excalidraw`
8. Recents file: `~/Library/Application Support/excalidraw-offline/recent.json`
9. Optional: `deno task package:macos` then open the `.app`; Gatekeeper: right-click → Open
10. Optional: `open -a "Excalidraw Offline" --args ~/Desktop/demo.excalidraw` (argv). Finder double-click is expected to **launch only** until Deno Desktop delivers Apple Events.
11. Info.plist on the packaged app contains `CFBundleDocumentTypes` / `dev.excalidraw.offline.drawing`

## CI / release

Tag `vX.Y.Z` matching `deno.json` version. Linux, Windows, and macOS workflows all upload to the same GitHub Release. macOS checksum file is **`SHA256SUMS-macos-arm64`** so it does not overwrite Linux `SHA256SUMS`.

Local dry-run on a Mac:

```
deno task package:macos:release
```

From Linux this builds the `.app` and zip but skips DMG/`codesign`.

## Out of scope still

Developer ID, notarization, Homebrew cask, Intel (`x86_64-apple-darwin`), CEF, Finder-delivered open-document events.
