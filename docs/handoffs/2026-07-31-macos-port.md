# Handoff: Port Excalidraw Offline to macOS

**Date:** 2026-07-31  
**Repo:** https://github.com/gfaurobert/excalidraw-offline-bin  
**Branch at handoff:** `main` (after `v0.1.0` Linux release)  
**Next focus:** Make the Deno Desktop app work on macOS (dialogs + packaging), then optionally wire a macOS GitHub Release like Linux.

## Where things stand

- Linux AppImage + binary tarball release pipeline is **shipped**.
- First release: **[v0.1.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.1.0)**  
  Assets: AppImage, `.tar.xz`, `SHA256SUMS`. Workflow: `.github/workflows/release-linux.yml`.
- Design/plan for Linux release (for patterns to mirror):
  - `docs/superpowers/specs/2026-07-31-linux-release-design.md`
  - `docs/superpowers/plans/2026-07-31-linux-release.md`
- Distribution mental model (GitHub Releases = hub; Homebrew later):  
  `sketches/release-distribution-pipeline.excalidraw` (open with Excalidraw Offline).

## Prior assessment (macOS difficulty)

From earlier session — **moderate** if a Mac is available to smoke-test:

| Area | Status |
|------|--------|
| Deno Desktop webview | Already supports WKWebView; `--output` can produce `.app` / `.dmg` |
| Frontend / file format / menus / skills | Largely portable |
| **Blocker** | `desktop/dialogs.ts` is **zenity/kdialog only** — need `osascript` (or similar) on Darwin |
| Config | `deno.json` `desktop.app.icons` / `output` are Linux-oriented today |
| Paths | `HOME` OK; recent files use XDG `~/.config/...` (works on Mac; `~/Library/Application Support` would be more idiomatic) |
| Distribution | Unsigned builds hit Gatekeeper; Developer ID + notarization for public users |
| Homebrew | Optional later (cask pointing at Release DMG); **DMG first** |

Deno Desktop docs (as of mid-2026): macOS targets x64/arm64; `.dmg` needs a macOS host (`hdiutil`); `.app` can be cross-compiled from Linux.

## What to build next (suggested order)

1. **Dialog backend for Darwin** — extend `desktop/dialogs.ts` (+ tests) with `osascript` for: open/save file, open directory, info, choice, confirm. Keep zenity/kdialog on Linux. Pattern already exists for dual backends.
2. **Smoke on a Mac** — `deno task start` / `deno desktop --backend=webview …` with system dialogs.
3. **Packaging** — `package:macos` (or shared release script sibling): produce `.app` (and `.dmg` on macOS CI runner). Align names with Linux convention, e.g. `excalidraw-offline-<ver>-macos-arm64.dmg`.
4. **CI** — new workflow or extend release: `macos-latest` (arm64) on tag `v*`; upload to same GitHub Release. Mirror `scripts/package-linux-release.sh` + `scripts/release-names.ts`.
5. **Docs** — README Install section for macOS (DMG / drag to Applications; Gatekeeper note).
6. **Later / out of scope for MVP port** — Homebrew cask, notarization, Intel macOS unless needed.

Do **not** redo Linux release work unless fixing shared helpers for multi-platform naming.

## Key files to touch

- `desktop/dialogs.ts`, `desktop/dialogs_test.ts`
- `desktop/recent-files.ts` (optional Application Support path)
- `desktop/path.ts` / tests (POSIX paths already OK)
- `deno.json` (`desktop` icons/output, tasks)
- New: `scripts/package-macos-release.sh` (or generalize release-names for platform)
- New: `.github/workflows/release-macos.yml` (or matrix)
- `README.md`, `packaging/README.md`

## Constraints / product notes

- App is Deno Desktop wrapper around `@excalidraw/excalidraw`; file dialogs intentionally external because Deno Desktop lacks a native picker API (Linux comment in packaging README).
- Skills install targets `~/.agents/skills` — fine on macOS.
- Version must stay in sync with tags (`deno.json` `"version"`); Linux release script enforces this.

## Suggested skills

Invoke these when continuing:

1. **`brainstorming`** — before implementing the macOS port; lock dialog strategy, arch (arm64-only vs universal), signing scope.
2. **`writing-plans`** — after design approval; mirror the Linux release plan structure.
3. **`subagent-driven-development`** or **`executing-plans`** — to implement task-by-task.
4. **`excalidraw-sketching`** — if a macOS install/dialog flow diagram helps.
5. **`context7-mcp` / Deno docs** — confirm current `deno desktop` macOS output formats and CI constraints.
6. **`verification-before-completion`** — before claiming the Mac build works.
7. **`finishing-a-development-branch`** — when the port branch is ready to merge/PR.
8. **`using-git-worktrees`** — start macOS work on a fresh branch from `main` in isolation.

## Open questions for the next session

- Does the user have a Mac (or macOS CI only) for smoke-testing dialogs?
- First ship: **arm64 only** vs Intel + arm64?
- MVP: runnable `.app` unsigned for personal use, or aim for notarized DMG immediately?
- Should recent-files config move to `~/Library/Application Support/excalidraw-offline/` on Darwin?

## Do not

- Re-implement Linux packaging from scratch.
- Commit secrets or Apple Developer credentials into the repo.
- Assume Gatekeeper-friendly distribution without signing/notarization discussion.
