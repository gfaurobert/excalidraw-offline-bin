---
title: FAQ
nav_order: 5
---

# FAQ

## Is this a fork of Excalidraw?

No. It embeds the upstream `@excalidraw/excalidraw` React package in a thin Deno Desktop wrapper. Drawing UX stays upstream Excalidraw.

## Does it need a network connection?

No for core drawing. There is no account, sync, or collaboration in the first version.

## Which platforms are supported?

Linux x86_64 (GitHub Releases AppImage/tarball; Arch `makepkg`), Windows 11 x86_64 (MSI and zip), and Apple Silicon macOS (DMG and zip of the `.app`). Intel Macs are not packaged yet.

## Why do I need zenity, kdialog, PowerShell, or osascript?

Open/save pickers and the unsaved Cancel / Save / Discard dialog use native OS dialogs: zenity or kdialog on Linux, PowerShell WinForms on Windows, and `osascript` on macOS. If they are unavailable, the app reports a status error rather than falling back to typed paths.

## Where are recent files stored?

Up to 10 recent paths are persisted locally: `$XDG_CONFIG_HOME/excalidraw-offline/recent.json` on Linux (fallback `~/.config/...`), `%APPDATA%\excalidraw-offline\recent.json` on Windows, and `~/Library/Application Support/excalidraw-offline/recent.json` on macOS.

## Why is there an `assets/` folder next to my drawing?

Imported images are copied there with relative paths so the drawing stays portable and reopen does not depend on the original absolute path of the imported file.

## How do I install the sketching Agent Skill?

Use the Skills menu: Global (`~/.agents/skills`), Project (`<root>/.agents/skills`), or Custom folder. The bundled skill is `excalidraw-sketching`.

## macOS says the app is damaged or cannot be opened

Release builds are **ad-hoc signed**, not Developer ID–signed or notarized. After a download, Gatekeeper attaches a quarantine flag. Double-clicking then often shows *“[App] is damaged and can’t be opened”* / *« Impossible d’ouvrir l’application… car elle est peut-être endommagée ou incomplète »*, and the Dock/Finder icon can show a prohibitory (circle-with-slash) badge. The DMG is usually fine — macOS is refusing an unsigned/ad-hoc app from the internet.

Clear quarantine once (preferred over right-click → Open for the “damaged” dialog):

```bash
xattr -cr "/Applications/Excalidraw Offline.app"
```

Then launch from Applications. If System Settings → Privacy & Security offers **Open Anyway** after a blocked launch, that also works. Confirm you are on **Apple Silicon**; Intel Macs cannot run the arm64 build.

## Does Finder double-click open a drawing on macOS?

The `.app` declares a `.excalidraw` UTI so the file type is associated, but Deno Desktop does not yet deliver macOS Open Documents Apple Events into the app. Use File → Open, or pass the path as argv (`open -a "Excalidraw Offline" --args ~/drawing.excalidraw`).