# macOS arm64 Port Design

## Goal

Run Excalidraw Offline as a Deno Desktop app on **Apple Silicon macOS** (M-series, including M5), with native file dialogs, idiomatic config/runtime paths, CLI open, and GitHub Release artifacts (DMG + zip of the `.app`), without changing Linux or Windows behavior.

## Decisions

| Decision | Choice |
|----------|--------|
| Rendering | Keep `webview` (WKWebView on macOS) |
| Architectures | `arm64` only (`aarch64-apple-darwin`) |
| Dialogs | `osascript` AppleScript, same external-process pattern as zenity/kdialog and PowerShell |
| Config (recent files) | `~/Library/Application Support/excalidraw-offline/recent.json` |
| Instance registry | `$TMPDIR/excalidraw-offline/instances` (fallback `~/Library/Caches/excalidraw-offline/instances`) |
| Home | `$HOME` |
| Packaging | `.app` bundle + UDZO DMG (drag to Applications) + zip of the `.app` |
| Artifact names | `excalidraw-offline-<ver>-macos-arm64.dmg`, `.zip`, `SHA256SUMS-macos-arm64` |
| CI | New `release-macos.yml` on `macos-latest` (arm64 host; DMG needs `hdiutil`) |
| File association | Post-build `Info.plist` `CFBundleDocumentTypes` + exported UTI; `lsregister -f` on packaged-app launch |
| Finder double-click | Register the type so Get Info / Open With work; Deno Desktop does not yet deliver macOS `odoc` Apple Events into JS — CLI argv is the reliable open path until that lands |
| Signing | Ad-hoc (`codesign -s -`) after the plist patch; Developer ID + notarization out of scope |
| Homebrew | Out of scope |
| Intel macOS | Out of scope |

Linux AppImage/tarball/makepkg and Windows MSI/zip stay unchanged. Checksums use a **distinct filename** so macOS CI does not overwrite Linux `SHA256SUMS` or Windows `SHA256SUMS-windows-x86_64` on the same GitHub Release.

## Architecture

```text
macOS launch (Spotlight / CLI / Open With)
        │
        ▼
  Parse argv (POSIX paths) → absolute path
        │
        ▼
  TMPDIR instance registry + localhost handoff (same as Linux)
        │
   ┌────┴────┐
   eligible   none
   │         │
   ▼         ▼
 POST open  WKWebView window + osascript dialogs
```

Frontend, file format (`assets/` next to the `.excalidraw` file), menus, skills, start screen, and HTTP UI queue stay shared. Platform-specific pieces:

| Unit | Role |
|------|------|
| `desktop/platform.ts` | Darwin Application Support / TMPDIR dirs |
| `desktop/dialogs-macos.ts` | AppleScript builders + `osascript` stdin spawn |
| `desktop/dialogs.ts` | Dispatch: Windows → PowerShell; Darwin → osascript; else zenity/kdialog |
| `desktop/file-association-macos.ts` | Detect packaged `.app`; `lsregister -f` |
| `scripts/macos-info-plist.ts` | Inject document type + UTI into generated `Info.plist` |
| `scripts/package-macos-release.ts` | Frontend build + `.app` + plist patch + ad-hoc sign + DMG/zip + checksums |
| `.github/workflows/release-macos.yml` | Tag/dispatch CI on `macos-latest`, upload to the same Release as Linux/Windows |

## Dialogs

Deno Desktop still has **no native file-picker API**. Do not call pickers from webview bindings (same freeze risk as Linux/Windows).

`/usr/bin/osascript` reads AppleScript on stdin. Cancel is empty stdout + exit `1` (including error `-128`), same `DialogResult` reasons as other backends.

| Action | UI |
|--------|----|
| Open / Save `.excalidraw` | `choose file` / `choose file name` |
| Import image | `choose file` (images; all files still selectable) |
| Folder (skills) | `choose folder` |
| Info | `display dialog` OK |
| Confirm overwrite | `display dialog` Yes/No |
| Unsaved | `display dialog` **Save / Discard / Cancel** (stdout `save`\|`discard`\|`cancel`) |
| Skill destination | `choose from list`; stdout is the option **id** |

`EXCALIDRAW_FORCE_SAVE_PATH` still bypasses the save picker.

## Paths

POSIX paths already work. Darwin-specific dirs:

- Recents: `~/Library/Application Support/excalidraw-offline/recent.json`
- Instances: `$TMPDIR/excalidraw-offline/instances`
- Skills global dir remains `~/.agents/skills`

`isProcessAlive` keeps `Deno.kill(pid, 0)` on Darwin (same as Linux). Do **not** honor `XDG_*` on Darwin; Application Support is the idiomatic location.

## File association (v1)

Deno Desktop does not expose `CFBundleDocumentTypes` in `deno.json`. After `deno desktop --output=….app`:

1. Patch `Contents/Info.plist` with exported UTI `dev.excalidraw.offline.drawing` (`.excalidraw`, `application/vnd.excalidraw+json`) and a document type (Editor / Owner).
2. Stamp `CFBundleShortVersionString` / `CFBundleVersion` from `deno.json` `"version"`.
3. Ad-hoc re-sign (`codesign --force --deep -s -`) because the plist edit invalidates Deno's signature.
4. On packaged-app startup, if `execPath` is inside `*.app/Contents/MacOS/` and is not `deno`, run `lsregister -f` on the bundle so Launch Services notices the type.

Skip registration during `deno task start` (execPath is `deno`).

**Open delivery:** Finder / `open -a` send Apple Events. Deno Desktop does not yet surface those to the app (same gap as deep-link delivery). Reliable opens:

- In-app File → Open / start-screen Open (`osascript` picker)
- CLI argv: `"…/Excalidraw Offline.app/Contents/MacOS/Excalidraw Offline" /path/to/file.excalidraw`
- `open -a "Excalidraw Offline" --args /path/to/file.excalidraw`

Document this honestly; do not claim Finder double-click opens the drawing until Deno delivers `odoc`.

## Packaging and CI

```
deno desktop -A --backend=webview --compress=xz --target aarch64-apple-darwin
  --include=./frontend/dist --include=./icons --include=./skills
  --output=./dist/macos/Excalidraw Offline.app
```

Build the `.app` with a **dot-free** basename (`Excalidraw Offline.app`), patch + sign, then:

- Zip the `.app` as `excalidraw-offline-<ver>-macos-arm64.zip`
- On Darwin, `hdiutil` UDZO DMG named `excalidraw-offline-<ver>-macos-arm64.dmg` (volume contains the `.app` + `/Applications` symlink)

`deno.json`:

- `desktop.app.icons.macos` = `./icons/icon.png` (Deno assembles `.icns`)
- `desktop.output.macos` = `./dist/macos/Excalidraw Offline.app`
- tasks: `package:macos`, `package:macos:release`

Workflow mirrors Linux/Windows: Deno 2.9.4, version must match `v*` tags, `workflow_dispatch` uploads artifacts only. Job runs on **`macos-latest`** because DMG and `codesign` need a macOS host. `.app` *can* be cross-compiled from Linux, but release artifacts are produced on macOS CI.

Runtime note: WKWebView (system). Unsigned / ad-hoc builds hit Gatekeeper; users can right-click → Open, or `xattr -d com.apple.quarantine`.

## Docs

README + GitHub Pages install/usage/faq: macOS arm64 DMG/zip, osascript dialogs, Application Support recents, CLI `--args` / binary argv, Gatekeeper. Handoff with an M-series smoke-test checklist.

## Out of scope

- Developer ID / notarization / stapling
- Homebrew cask
- Intel (`x86_64-apple-darwin`) and universal binaries
- CEF backend
- Changing Linux or Windows packaging or dialog backends
- Custom URI scheme (`excalidraw-offline://`)
- Finder double-click actually loading the drawing (blocked on Deno Desktop Apple Event delivery)

## Success criteria

1. `deno task start` on Apple Silicon opens the start screen; New / Open / Save / unsaved Save-Discard-Cancel / Skills install use osascript dialogs.
2. Passing a `.excalidraw` path as argv opens or creates the file; single-instance handoff matches Linux/Windows rules.
3. Recent files persist under `~/Library/Application Support/excalidraw-offline/recent.json`.
4. Packaged `.app` Info.plist declares the `.excalidraw` UTI; first launch runs `lsregister`.
5. Tag `vX.Y.Z` produces macOS DMG + zip + `SHA256SUMS-macos-arm64` on the GitHub Release without clobbering Linux/Windows assets.
6. Existing Linux and Windows unit tests still pass.
