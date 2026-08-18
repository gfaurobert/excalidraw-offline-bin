# Windows 11 Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Excalidraw Offline to Windows 11 x86_64: WebView2, PowerShell dialogs, APPDATA/TEMP paths, CLI/HKCU association, MSI+zip GitHub Release assets.

**Architecture:** Shared frontend and file format. New `desktop/platform.ts` and `desktop/dialogs-win.ts` isolate OS differences. `desktop/dialogs.ts` dispatches. Packaging is a Deno script so it runs on Linux CI (cross-compile) and on a Windows machine.

**Tech Stack:** Deno ≥ 2.9 (`deno desktop --backend=webview`), PowerShell 5.1 WinForms, GitHub Actions `ubuntu-latest` + `--target x86_64-pc-windows-msvc`.

## Global Constraints

- Keep Linux zenity/kdialog and Linux release artifacts unchanged
- Windows **x86_64** only
- Artifact names: `excalidraw-offline-<version>-windows-x86_64.msi`, `.zip`, `SHA256SUMS-windows-x86_64`
- Tag `vX.Y.Z` must match `deno.json` version
- Reuse `deno desktop -A --backend=webview --compress=xz --include=./frontend/dist --include=./icons --include=./skills`
- No Authenticode, Winget, ARM64, CEF, or macOS work
- Build MSI/directory with a dot-free basename then rename (Laufey last-`.` pitfall)

## File map

| Path | Responsibility |
|------|----------------|
| `desktop/path.ts` | Windows-aware join/dirname/fromFileUrl/isAbsolute |
| `desktop/platform.ts` | home/config/runtime dirs, commandExists, isProcessAlive |
| `desktop/dialogs-win.ts` | PowerShell script builders + encoded spawn |
| `desktop/dialogs.ts` | OS dispatch; Linux backends unchanged |
| `desktop/file-association-win.ts` | HKCU `.excalidraw` for packaged exe |
| `desktop/cli-args.ts` | Drive-letter / UNC absolute paths |
| `desktop/recent-files.ts` / `instance-registry.ts` | Use platform dirs |
| `desktop/install-skill.ts` | Strip trailing `\` as well as `/` |
| `desktop/main.ts` | Shared homeDir; OS-aware picker errors; register association |
| `scripts/release-names.ts` | `windowsArtifactBasenames` |
| `scripts/package-windows-release.ts` | Build MSI + zip + checksums |
| `.github/workflows/release-windows.yml` | Tag/dispatch CI |
| `deno.json` | Windows icon/output + tasks |
| README / docs/site / use-cases / handoff | Windows install and smoke test |

---

### Task 1: Path helpers

**Files:** `desktop/path.ts`, `desktop/path_test.ts`

**Produces:** `isAbsolutePath(path: string): boolean`; `join` / `dirname` / `fromFileUrl` handle `C:/` and UNC.

- [x] Tests for Windows absolute, UNC, `file:///C:/…`, dirname of `C:/foo`
- [x] Implement helpers (keep POSIX tests passing)
- [x] Commit with later tasks if needed

### Task 2: Platform dirs + process alive

**Files:** `desktop/platform.ts`, `desktop/platform_test.ts`

**Produces:** `homeDirFromEnv`, `configDirFromEnv`, `runtimeDirFromEnv`, `parseTasklistHasPid`, wrappers used by recent-files and instance-registry.

### Task 3: CLI resolve + dialogs-win + dispatch

**Files:** `desktop/cli-args.ts`, `desktop/cli-args_test.ts`, `desktop/dialogs-win.ts`, `desktop/dialogs-win_test.ts`, `desktop/dialogs.ts`, `desktop/dialogs_test.ts`

**Produces:** PowerShell builders; `parseWinUnsavedOutcome`; `runWindowsDialog` spawn; dialogs.ts calls Windows backend when `Deno.build.os === "windows"`.

### Task 4: Wire recent/registry/main/association

**Files:** `desktop/recent-files.ts`, `desktop/instance-registry.ts`, `desktop/file-association-win.ts`, `desktop/install-skill.ts`, `desktop/main.ts`

### Task 5: Packaging + CI + docs

**Files:** `scripts/release-names.ts`, `scripts/package-windows-release.ts`, `.github/workflows/release-windows.yml`, `deno.json`, README, docs, handoff.

---

## Self-review

- Spec coverage: dialogs, paths, registry, association, MSI/zip, CI, docs — each has a task.
- Linux `artifactBasenames` shape unchanged; Windows checksums use a distinct name.
- No macOS/signing/Winget in this plan.
