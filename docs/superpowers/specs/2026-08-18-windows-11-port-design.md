# Windows 11 Port Design

## Goal

Run Excalidraw Offline as a Deno Desktop app on **Windows 11 x86_64**, with native file dialogs, idiomatic config/runtime paths, CLI open, and GitHub Release artifacts (MSI + zip), without changing Linux behavior.

## Decisions

| Decision | Choice |
|----------|--------|
| Rendering | Keep `webview` (WebView2 on Windows 11; Evergreen runtime is present by default) |
| Architectures | `x86_64` only (`x86_64-pc-windows-msvc`) |
| Dialogs | PowerShell + WinForms, same external-process pattern as zenity/kdialog |
| Config (recent files) | `%APPDATA%\excalidraw-offline\recent.json` |
| Instance registry | `%TEMP%\excalidraw-offline\instances` |
| Home | `%USERPROFILE%` (fallback `HOME`) |
| Packaging | MSI + zip of the app directory; `--compress=xz` |
| Artifact names | `excalidraw-offline-<ver>-windows-x86_64.msi`, `.zip`, `SHA256SUMS-windows-x86_64` |
| CI | New `release-windows.yml`; cross-compile from `ubuntu-latest` |
| File association | HKCU `.excalidraw` when the packaged launcher runs (not `deno.exe` during `deno task start`) |
| Signing | Out of scope (SmartScreen warning expected) |
| Winget / ARM64 | Out of scope |

Linux AppImage/tarball/makepkg stay unchanged. Checksums use a **distinct filename** so Windows CI does not overwrite Linux `SHA256SUMS` on the same GitHub Release.

## Architecture

```text
Win11 launch (Start / CLI / double-click)
        │
        ▼
  Parse argv (C:\… and relative) → absolute path
        │
        ▼
  TEMP instance registry + localhost handoff (same as Linux)
        │
   ┌────┴────┐
   eligible   none
   │         │
   ▼         ▼
 POST open  WebView2 window + PowerShell dialogs
```

Frontend, file format (`assets/` next to the `.excalidraw` file), menus, skills, start screen, and HTTP UI queue stay shared. Platform-specific pieces:

| Unit | Role |
|------|------|
| `desktop/path.ts` | Absolute Windows paths, `file:///C:/…`, join/dirname |
| `desktop/platform.ts` | Home / APPDATA / TEMP, `commandExists`, `isProcessAlive` |
| `desktop/dialogs-win.ts` | PowerShell script builders + spawn (`-STA -EncodedCommand`) |
| `desktop/dialogs.ts` | Dispatch: Windows → PowerShell; else zenity/kdialog |
| `desktop/file-association-win.ts` | Idempotent HKCU `.excalidraw` → packaged exe `"%1"` |
| `scripts/package-windows-release.ts` | Frontend build + MSI + zip + checksums |
| `.github/workflows/release-windows.yml` | Tag/dispatch CI, upload to the same Release as Linux |

## Dialogs

Deno Desktop still has **no native file-picker API**. Do not call pickers from webview bindings (same freeze risk as Linux).

PowerShell 5.1 (`powershell.exe`) + `System.Windows.Forms`, always `-STA -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand`.

| Action | UI |
|--------|----|
| Open / Save `.excalidraw` | `OpenFileDialog` / `SaveFileDialog` (filter `*.excalidraw`) |
| Import image | `OpenFileDialog` with image filters |
| Folder (skills) | `FolderBrowserDialog` |
| Info | `MessageBox` OK |
| Confirm overwrite | `MessageBox` Yes/No |
| Unsaved | Custom form **Save / Discard / Cancel** (stdout `save`\|`discard`\|`cancel`) |
| Skill destination | Custom form radio list; stdout is the option **id** |

Cancel → empty stdout + exit `1`, same `DialogResult` reasons as Linux. `EXCALIDRAW_FORCE_SAVE_PATH` still bypasses the save picker.

## Paths

Keep forward slashes internally (Deno accepts them on Windows).

- Absolute: `C:\…`, `C:/…`, UNC `\\server\share`, POSIX `/…`
- `fromFileUrl("file:///C:/Users/a.ts")` → `C:/Users/a.ts`
- CLI `resolveOpenPath` treats drive-letter and UNC as absolute
- Skills global dir remains `%USERPROFILE%\.agents\skills`

`isProcessAlive`: Unix keeps `Deno.kill(pid, 0)`; Windows parses `tasklist.exe /FI PID eq N /FO CSV /NH` (signal `0` is not reliable there).

## File association (v1)

On packaged-app startup, if `basename(Deno.execPath())` starts with `excalidraw-offline`, write HKCU:

- `Software\Classes\.excalidraw` → `ExcalidrawOffline.drawing`
- `Software\Classes\ExcalidrawOffline.drawing\shell\open\command` → `"<execPath>" "%1"`

Skip when `execPath` is `deno` / `deno.exe`. Portable zip and MSI both get a per-user association without elevation. Deno's MSI does not register custom file types.

## Packaging and CI

```
deno desktop -A --backend=webview --compress=xz --target x86_64-pc-windows-msvc
  --include=./frontend/dist --include=./icons --include=./skills
```

Build the MSI and the directory bundle with a **dot-free** output basename (`excalidraw-offline.msi` / `…/excalidraw-offline`), then rename to the canonical versioned names (same Laufey “last `.` is the extension” pitfall as Linux AppImage).

`deno.json`:

- `desktop.app.icons.windows` = `./icons/icon.png` (Deno assembles `.ico`)
- `desktop.output.windows` = `./dist/windows/excalidraw-offline`
- tasks: `package:windows`, `package:windows:release`

Workflow mirrors Linux: Deno 2.9.4, version must match `v*` tags, `workflow_dispatch` uploads artifacts only.

Runtime note: WebView2 (Win11 default). Unsigned builds may show SmartScreen; users can still run.

## Docs

README + GitHub Pages install/usage/faq: Windows 11 x86_64 MSI/zip, WebView2, PowerShell dialogs, `%APPDATA%` recents, CLI `excalidraw-offline path\to\file.excalidraw`, SmartScreen. Handoff with a Win11 smoke-test checklist.

## Out of scope

- Authenticode / SmartScreen reputation
- Winget
- Windows ARM64
- CEF backend
- macOS (still a separate port)
- Changing Linux packaging or zenity/kdialog behavior
- Custom URI scheme (`excalidraw-offline://`)

## Success criteria

1. `deno task start` on Windows 11 opens the start screen; New / Open / Save / unsaved Save-Discard-Cancel / Skills install use WinForms dialogs.
2. `excalidraw-offline C:\path\drawing.excalidraw` opens or creates the file; single-instance handoff matches Linux rules.
3. Recent files persist under `%APPDATA%\excalidraw-offline\recent.json`.
4. Packaged exe registers HKCU `.excalidraw` so Explorer double-click opens the app.
5. Tag `vX.Y.Z` produces Windows MSI + zip + `SHA256SUMS-windows-x86_64` on the GitHub Release without clobbering Linux assets.
6. Existing Linux unit tests still pass.
