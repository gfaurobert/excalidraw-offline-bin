# macOS arm64 Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Excalidraw Offline to Apple Silicon macOS: WKWebView, osascript dialogs, Application Support/TMPDIR paths, CLI argv open, Info.plist UTI, DMG+zip GitHub Release assets.

**Architecture:** Shared frontend and file format. New `desktop/dialogs-macos.ts` and `desktop/file-association-macos.ts` isolate OS differences. `desktop/dialogs.ts` dispatches. Packaging is a Deno script so it can run on macOS CI (and compile `.app` from Linux).

**Tech Stack:** Deno ≥ 2.9 (`deno desktop --backend=webview`), `/usr/bin/osascript`, GitHub Actions `macos-latest` + `--target aarch64-apple-darwin`.

## Global Constraints

- Keep Linux zenity/kdialog and Windows PowerShell / release artifacts unchanged
- macOS **arm64** only
- Artifact names: `excalidraw-offline-<version>-macos-arm64.dmg`, `.zip`, `SHA256SUMS-macos-arm64`
- Tag `vX.Y.Z` must match `deno.json` version
- Reuse `deno desktop -A --backend=webview --compress=xz --include=./frontend/dist --include=./icons --include=./skills`
- No Developer ID, notarization, Homebrew, Intel, or CEF work
- Build `.app` with a dot-free basename then rename/zip (Laufey last-`.` pitfall)
- Patch Info.plist **then** ad-hoc re-sign before DMG

## File map

| Path | Responsibility |
|------|----------------|
| `desktop/platform.ts` | Darwin Application Support + TMPDIR |
| `desktop/dialogs-macos.ts` | AppleScript builders + osascript spawn |
| `desktop/dialogs.ts` | OS dispatch; Linux/Windows backends unchanged |
| `desktop/file-association-macos.ts` | Packaged `.app` lsregister |
| `desktop/main.ts` | Shared homeDir; OS-aware picker errors; register association |
| `scripts/macos-info-plist.ts` | Pure Info.plist document-type patch |
| `scripts/release-names.ts` | `macosArtifactBasenames` |
| `scripts/package-macos-release.ts` | Build `.app` + patch + sign + DMG/zip + checksums |
| `.github/workflows/release-macos.yml` | Tag/dispatch CI on macos-latest |
| `deno.json` | macOS icon/output + tasks |
| README / docs/site / use-cases / handoff | macOS install and smoke test |

---

### Task 1: Platform dirs

**Files:** `desktop/platform.ts`, `desktop/platform_test.ts`

**Produces:** `configDirFromEnv("darwin")` → Application Support; `runtimeDirFromEnv("darwin")` → TMPDIR.

### Task 2: Dialogs-macos + dispatch

**Files:** `desktop/dialogs-macos.ts`, `desktop/dialogs-macos_test.ts`, `desktop/dialogs.ts`, `desktop/dialogs_test.ts`

**Produces:** AppleScript builders; `parseMacUnsavedOutcome`; `runMacDialog` spawn; dialogs.ts calls macOS backend when `Deno.build.os === "darwin"`.

### Task 3: File association + main

**Files:** `desktop/file-association-macos.ts`, `desktop/file-association-macos_test.ts`, `scripts/macos-info-plist.ts`, `scripts/macos-info-plist_test.ts`, `desktop/main.ts`

### Task 4: Packaging + CI + docs

**Files:** `scripts/release-names.ts`, `scripts/package-macos-release.ts`, `.github/workflows/release-macos.yml`, `deno.json`, README, docs, handoff.

---

## Self-review

- Spec coverage: dialogs, paths, registry, association, DMG/zip, CI, docs, Gatekeeper, Finder limitation — each has a task or a docs section.
- Linux `artifactBasenames` and Windows `windowsArtifactBasenames` unchanged; macOS checksums use a distinct name.
- No signing/Homebrew/Intel in this plan.
