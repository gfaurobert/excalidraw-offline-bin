# Use Cases to support on first version

1) Launch Excalidraw App  
2) Open a exalidraw file  
3) Save under a repo  
4) Auto save  
5) import image into canvas. (assets are stored under assets folder where the excalidraw file is stored)

## Clarifications

### Product approach
- We do **not** rebuild Excalidraw.
- We use the open-source Excalidraw project and build a thin desktop wrapper around it.
- Integration choice: embed the `@excalidraw/excalidraw` React package in a small Vite/React UI.
- The **Tauri 2** shell owns offline packaging, local file open/save/autosave, and image asset handling.
- Drawing UX stays upstream Excalidraw.

### Runtime and packaging
- Linux x86_64, Windows 11 x86_64, and macOS (universal) share the same Tauri wrapper.
- App runtime: Tauri 2 + system webview (WebKitGTK / WebView2 / WKWebView). Native dialogs via GTK / Win32 / AppKit (and zenity on Linux when available).
- Primary distribution: GitHub Releases (AppImage + Arch package on Linux; portable zip + NSIS on Windows; universal + arm64 zips on macOS); AUR-ready `PKGBUILD` for Arch.
- Priority: keep the install/binary as small as possible.

### 1) Launch Excalidraw App
- Offline desktop app that wraps upstream Excalidraw (not a reimplementation).
- No account, sync, collaboration, or network requirement for core drawing.
- Cold start shows a start screen (New file / Open file / Recent files). Excalidraw canvas mounts only after the user chooses an action.
- File → Close (Ctrl+W) returns to the start screen. Quit exits the app.
- Unsaved Untitled drawings use a native Cancel / Save / Discard dialog. Open/Save path prompts are native file pickers only.
- Info menu (native): Runtime dialog backend, assets storage tip, About Excalidraw Offline (wrapper version), About Excalidraw (upstream package version). Transient open/save status shows in the app header; there is no footer status bar.
- Skills menu (native): Install bundled `excalidraw-sketching` Agent Skill to Global (`~/.agents/skills`), Project (`<root>/.agents/skills`), or Custom (folder as-is).

### 2) Open a `.excalidraw` file
- User can open an existing local `.excalidraw` file from the app (menu/open dialog or start-screen Open).
- CLI: `excalidraw-offline /path/to/file.excalidraw` (creates a blank file if the path is missing).
- OS file associations and Finder double-click are **not ported yet** — pass the path as CLI argv (`open -a "Excalidraw Offline" --args <path>` on macOS).
- File → Open Recent and the start-screen Recent list show up to 10 recently opened/saved paths (Linux: XDG config; Windows: `%APPDATA%\excalidraw-offline`; macOS: `~/Library/Application Support/excalidraw-offline`). Missing or unreadable paths are removed from the list when selected.
- Cursor chat path clicks typically open inside the editor — agents should launch the CLI (or `xdg-open` on Linux, `open -a "Excalidraw Offline" --args` on macOS) instead.

### 3) Save under a repo
- Means: save the `.excalidraw` file anywhere on local disk.
- A git repository is just one possible destination folder, not a special mode.
- The app is not git-aware in the first version.
- Includes Save and Save As.

### 4) Auto save
- If the drawing already has a file path, autosave writes directly back to that `.excalidraw` file.
- Brand-new unsaved drawings still need a manual Save / Save As before autosave can write.
- Crash recovery from a separate temp location is not part of the first version.
