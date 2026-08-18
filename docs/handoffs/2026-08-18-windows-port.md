# Handoff: Smoke-test Excalidraw Offline on Windows 11

**Date:** 2026-08-18  
**Repo:** https://github.com/gfaurobert/excalidraw-offline-bin  
**Branch:** `cursor/windows-11-port-3c09`  
**Focus:** Verify the Win11 port on a real Windows 11 x86_64 machine. Unit tests and packaging scripts were written on Linux; dialogs and WebView2 cannot be smoke-tested here.

## What landed

- PowerShell + WinForms dialogs (open/save/image/folder/info/confirm/unsaved Save-Discard-Cancel/skill choice)
- Windows paths (`C:\`, UNC, `file:///C:/…`), `%USERPROFILE%` / `%APPDATA%` / `%TEMP%`
- CLI open + single-instance handoff (registry under `%TEMP%\excalidraw-offline\instances`)
- Packaged exe registers HKCU `.excalidraw` (skipped for `deno.exe` during `deno task start`)
- Release artifacts: MSI + zip + `SHA256SUMS-windows-x86_64` (CI on `ubuntu-latest` with `--target x86_64-pc-windows-msvc`)

Design: `docs/superpowers/specs/2026-08-18-windows-11-port-design.md`  
Plan: `docs/superpowers/plans/2026-08-18-windows-11-port.md`

## Dev loop on the Windows machine

Prereqs: Deno **≥ 2.9**, Git, WebView2 (Win11 default).

```powershell
git clone https://github.com/gfaurobert/excalidraw-offline-bin.git
cd excalidraw-offline-bin
git checkout cursor/windows-11-port-3c09
cd frontend; deno install; deno task build; cd ..
deno task start
```

## Smoke checklist

1. Start screen: New / Open / Recent
2. Open/Save `.excalidraw` via WinForms picker; extension appended if omitted
3. Untitled dirty Close/Quit → Save / Discard / Cancel
4. Import image → sibling `assets/`
5. Skills → install Global (`%USERPROFILE%\.agents\skills`)
6. Info → Runtime shows `powershell+http`
7. CLI: `deno desktop -A --backend=webview --include=./frontend/dist --include=./icons --include=./skills ./desktop/main.ts C:\temp\demo.excalidraw`
8. Recents file: `%APPDATA%\excalidraw-offline\recent.json`
9. Optional: `deno task package:windows` then run the launcher; confirm Explorer double-click on `.excalidraw` after first launch
10. SmartScreen: expected on unsigned builds — More info → Run anyway

## CI / release

Tag `vX.Y.Z` matching `deno.json` version. Linux and Windows workflows both upload to the same GitHub Release. Windows checksum file is **`SHA256SUMS-windows-x86_64`** so it does not overwrite Linux `SHA256SUMS`.

Local dry-run from Linux or Windows:

```
deno task package:windows:release
```

## Out of scope still

Authenticode, Winget, ARM64, CEF, macOS.
