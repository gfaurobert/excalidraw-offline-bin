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

Linux x86_64 (GitHub Releases AppImage/tarball; Arch `makepkg`) and Windows 11 x86_64 (MSI and zip). macOS is not packaged yet.

## Why do I need zenity, kdialog, or PowerShell?

Open/save pickers and the unsaved Cancel / Save / Discard dialog use native OS dialogs: zenity or kdialog on Linux, PowerShell WinForms on Windows. If they are unavailable, the app reports a status error rather than falling back to typed paths.

## Where are recent files stored?

Up to 10 recent paths are persisted locally: `$XDG_CONFIG_HOME/excalidraw-offline/recent.json` on Linux (fallback `~/.config/...`), and `%APPDATA%\excalidraw-offline\recent.json` on Windows.

## Why is there an `assets/` folder next to my drawing?

Imported images are copied there with relative paths so the drawing stays portable and reopen does not depend on the original absolute path of the imported file.

## How do I install the sketching Agent Skill?

Use the Skills menu: Global (`~/.agents/skills`), Project (`<root>/.agents/skills`), or Custom folder. The bundled skill is `excalidraw-sketching`.