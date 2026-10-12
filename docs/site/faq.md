---
title: FAQ
nav_order: 6
---

# FAQ

## Is this a fork of Excalidraw?

No. It embeds the upstream `@excalidraw/excalidraw` React package in a thin Tauri 2 wrapper (system webview; the previous releases used Deno Desktop). Drawing UX stays upstream Excalidraw.

## Does it need a network connection?

No for core drawing. There is no account, sync, or collaboration in the first version.

## Which platforms are supported?

Linux x86_64, Windows 11 x64, and macOS 11+ (universal `.app` for Apple Silicon and Intel) — all end-to-end tested with the Tauri 2 build.

**Which build should I install?** The Tauri 2 build (CI artifacts or build from source) until it is released; the [Releases](https://github.com/gfaurobert/excalidraw-offline-bin/releases) page still has the previous Deno builds (Linux v0.7.2, Windows/macOS v0.5.0). See [Install]({{ '/install.html' | relative_url }}).

## Where are Export image and `excalidraw-offline export`?

**Export image…** (Ctrl+Shift+E / ⌘⇧E) and the headless **`excalidraw-offline export`** CLI plus **`--help`** are in the Tauri build on all platforms (and in Deno Linux releases v0.6.0+). See [Usage]({{ '/usage.html' | relative_url }}).

## Which dialogs does it use?

Native OS dialogs: GTK on Linux, Win32 on Windows, and AppKit on macOS — no zenity, kdialog, PowerShell, or `osascript` needed in the Tauri build.

## Where are recent files stored?

Up to 10 recent paths are persisted locally: `$XDG_CONFIG_HOME/excalidraw-offline/recent.json` on Linux (fallback `~/.config/...`), `%USERPROFILE%\.config\excalidraw-offline\recent.json` on Windows, and `~/Library/Application Support/excalidraw-offline/recent.json` on macOS.

## Why is there an `assets/` folder next to my drawing?

Imported images are copied there with relative paths so the drawing stays portable and reopen does not depend on the original absolute path of the imported file.

## How do I install the sketching Agent Skill?

Use **Skills → Install excalidraw-sketching skill**. Choose **Global** or **Project**, then check which agent tools should receive a copy (defaults: `.agents/skills` and Claude Code; **All** installs every supported target). Paths include `~/.agents/skills`, `~/.claude/skills`, `~/.kiro/skills`, and `~/.cline/skills` (or the same folders under your project root). **Custom** still copies to any folder you pick. The bundled skill is `excalidraw-sketching`. **Reinstall after upgrading the app** (especially v0.7.1+) so agents read the updated skill — it documents the app guide, Reload prompt, Export dialog, export CLI flags, `--help`, output naming, and exit codes.

## macOS says the app is damaged or cannot be opened

macOS builds are ad-hoc signed, not notarized. Gatekeeper may block the first launch. Right-click the app → **Open**, or:

```bash
xattr -cr "/Applications/Excalidraw Offline.app"
```

## Does double-clicking a `.excalidraw` file open it?

Not yet: OS file associations and single-instance handoff are not ported to the Tauri build. Use File → Open, or pass the path as an argument (`excalidraw-offline ~/drawing.excalidraw`; on macOS the binary is `Excalidraw Offline.app/Contents/MacOS/excalidraw-offline`).

## An agent (or another app) changed my `.excalidraw` on disk — why doesn’t the canvas update?

The app does not continuously watch every path for external edits (file watchers are unreliable on some setups, e.g. WSL paths under `/mnt/`). With a **saved** file open, use **File → Reload** or **Ctrl+R** (⌘R on macOS) to re-read the file and `assets/` folder from disk. If you have unsaved local edits, Reload asks **Cancel / Save / Discard** instead of silently autosaving over the on-disk file.