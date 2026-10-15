---
title: FAQ
nav_order: 6
---

# FAQ

## Is this a fork of Excalidraw?

No. It embeds the upstream `@excalidraw/excalidraw` React package in a thin Deno Desktop wrapper. Drawing UX stays upstream Excalidraw.

## Does it need a network connection?

No for core drawing. There is no account, sync, or collaboration in the first version.

## Which platforms are supported?

Linux x86_64 (GitHub Releases AppImage/tarball; Arch `makepkg`), Windows 11 x86_64 (MSI and zip), and Apple Silicon macOS (DMG and zip of the `.app`). Intel Macs are not packaged yet.

**Which release should I install?** **Current version is [v0.7.2](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.7.2) (Linux only).** On Linux, use [Latest release](https://github.com/gfaurobert/excalidraw-offline-bin/releases/latest). On Windows and macOS, use **[v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0)** — v0.6.0, v0.7.0, v0.7.1, and v0.7.2 did not ship Win/mac assets.

## Where are Export image and `excalidraw-offline export`?

From **v0.6.0** (Linux builds today): **Export image…** (Ctrl+Shift+E / ⌘⇧E) and the headless **`excalidraw-offline export`** CLI plus **`--help`**. Windows and macOS **v0.5.0** builds do not include them yet; **File → Reload** (Ctrl+R / ⌘R) is available on v0.5.0 on all platforms. See [Usage]({{ '/usage.html' | relative_url }}) and [What's new]({{ '/whats-new.html' | relative_url }}).

## Why do I need zenity, kdialog, PowerShell, or osascript?

Open/save pickers and the unsaved Cancel / Save / Discard dialog use native OS dialogs: zenity or kdialog on Linux, PowerShell WinForms on Windows, and `osascript` on macOS. If they are unavailable, the app reports a status error rather than falling back to typed paths.

## Where are recent files stored?

Up to 10 recent paths are persisted locally: `$XDG_CONFIG_HOME/excalidraw-offline/recent.json` on Linux (fallback `~/.config/...`), `%APPDATA%\excalidraw-offline\recent.json` on Windows, and `~/Library/Application Support/excalidraw-offline/recent.json` on macOS.

## Why is there an `assets/` folder next to my drawing?

Imported images are copied there with relative paths so the drawing stays portable and reopen does not depend on the original absolute path of the imported file.

## How do I install the sketching Agent Skill?

Use **Skills → Install excalidraw-sketching skill**. Choose **Global** or **Project**, then check which agent tools should receive a copy (defaults: `.agents/skills` and Claude Code; **All** installs every supported target). Paths include `~/.agents/skills`, `~/.claude/skills`, `~/.kiro/skills`, and `~/.cline/skills` (or the same folders under your project root). **Custom** still copies to any folder you pick. The bundled skill is `excalidraw-sketching`. **Reinstall after upgrading the app** (especially v0.7.1+) so agents read the updated skill — it documents the app guide, Reload prompt, Export dialog, export CLI flags, `--help`, output naming, and exit codes.

## macOS says the app is damaged or cannot be opened

Release builds are **ad-hoc signed**, not Developer ID–signed or notarized. After a download, Gatekeeper attaches a quarantine flag. Double-clicking then often shows *“[App] is damaged and can’t be opened”* / *« Impossible d’ouvrir l’application… car elle est peut-être endommagée ou incomplète »*, and the Dock/Finder icon can show a prohibitory (circle-with-slash) badge. The DMG is usually fine — macOS is refusing an unsigned/ad-hoc app from the internet.

Clear quarantine once (preferred over right-click → Open for the “damaged” dialog):

```bash
xattr -cr "/Applications/Excalidraw Offline.app"
```

Then launch from Applications. If System Settings → Privacy & Security offers **Open Anyway** after a blocked launch, that also works. Confirm you are on **Apple Silicon**; Intel Macs cannot run the arm64 build.

## Does Finder double-click open a drawing on macOS?

The `.app` declares a `.excalidraw` UTI so the file type is associated, but Deno Desktop does not yet deliver macOS Open Documents Apple Events into the app. Use File → Open, or pass the path as argv (`open -a "Excalidraw Offline" --args ~/drawing.excalidraw`).

## An agent (or another app) changed my `.excalidraw` on disk — why doesn’t the canvas update?

The app does not continuously watch every path for external edits (file watchers are unreliable on some setups, e.g. WSL paths under `/mnt/`). With a **saved** file open, use **File → Reload** or **Ctrl+R** (⌘R on macOS) to re-read the file and `assets/` folder from disk. If you have unsaved local edits, Reload asks **Cancel / Save / Discard** instead of silently autosaving over the on-disk file.