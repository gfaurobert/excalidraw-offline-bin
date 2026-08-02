---
title: Home
nav_order: 1
description: Offline Excalidraw desktop wrapper for Linux
permalink: /
---

# Excalidraw Offline

Thin Deno Desktop wrapper around [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) for offline desktop use on Linux. It does **not** rebuild Excalidraw — it packages the upstream React component and adds local file open/save/autosave plus durable `assets/` attachments.

## Features (MVP)

- Launch an offline Excalidraw desktop app
- Start screen on launch (New / Open / Recent); canvas opens after a choice
- File → Close returns to the start screen; Quit exits
- Native zenity/kdialog for open/save and unsaved Cancel/Save/Discard
- Open / Save / Save As `.excalidraw` files anywhere on disk
- File → Open Recent (up to 10 paths, persisted locally)
- Autosave once a file path exists
- Image attachments copied into a sibling `assets/` folder with relative paths so reopen never loses them
- Info menu: Runtime, Assets tip, About Excalidraw Offline, About Excalidraw (native dialogs)
- Skills menu: install the bundled `excalidraw-sketching` Agent Skill (Global / Project / Custom → `.agents/skills`)
- Transient open/save status appears in the header (not a footer)

[Get started with Install]({% link install.md %}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
