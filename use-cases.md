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
- The Deno Desktop shell owns offline packaging, local file open/save/autosave, and image asset handling.
- Drawing UX stays upstream Excalidraw.

### Runtime and packaging
- First version targets Arch Linux users.
- App runtime: Deno Desktop (not Electron).
- Primary distribution path: AUR package.
- Priority: keep the install/binary as small as possible.

### 1) Launch Excalidraw App
- Offline desktop app that wraps upstream Excalidraw (not a reimplementation).
- No account, sync, collaboration, or network requirement for core drawing.

### 2) Open a `.excalidraw` file
- User can open an existing local `.excalidraw` file from the app (menu/open dialog).
- File-manager double-click association is not required for the first version unless added later.
- File → Open Recent lists up to 10 recently opened/saved paths (persisted under XDG config). Missing paths are removed from the list when selected.

### 3) Save under a repo
- Means: save the `.excalidraw` file anywhere on local disk.
- A git repository is just one possible destination folder, not a special mode.
- The app is not git-aware in the first version.
- Includes Save and Save As.

### 4) Auto save
- If the drawing already has a file path, autosave writes directly back to that `.excalidraw` file.
- Brand-new unsaved drawings still need a manual Save / Save As before autosave can write.
- Crash recovery from a separate temp location is not part of the first version.

### 5) Import image into canvas
- Goal: attachments must still be present after closing the file/app and reopening the same `.excalidraw` file.
- On import, copy the attachment into a sibling `assets/` folder next to the `.excalidraw` file.
- Store/reference assets with relative paths under that `assets/` folder so the drawing stays portable and reopen does not lose assets.
- Applies to whatever attachment types upstream Excalidraw supports (images first; PDF or others only if Excalidraw supports them).
- Do not depend on the original absolute path of the imported file after copy.

## Explicit non-goals for first version
- Export to PNG/SVG
- Cloud sync / collaboration / login
- Git integration beyond saving into a folder that happens to be a repo
