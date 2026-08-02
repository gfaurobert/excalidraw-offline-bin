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

The first version targets Linux (x86_64 releases; Arch `makepkg` from a local checkout). macOS and Windows are out of scope for now.

## Why do I need zenity or kdialog?

Open/save pickers and the unsaved Cancel / Save / Discard dialog use native zenity or kdialog. If neither is available, the app reports a status error rather than falling back to typed paths.

## Where are recent files stored?

Up to 10 recent paths are persisted under XDG config on the local machine.

## Why is there an `assets/` folder next to my drawing?

Imported images are copied there with relative paths so the drawing stays portable and reopen does not depend on the original absolute path of the imported file.

## How do I install the sketching Agent Skill?

Use the Skills menu: Global (`~/.agents/skills`), Project (`<root>/.agents/skills`), or Custom folder. The bundled skill is `excalidraw-sketching`.