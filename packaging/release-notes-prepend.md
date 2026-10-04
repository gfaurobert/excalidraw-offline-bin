## Linux-only release

**This GitHub Release contains Linux x86_64 assets only.** Windows and macOS builds for **v0.7.2** were not end-to-end tested; the latest published **Windows/macOS** builds remain **[v0.5.0](https://github.com/gfaurobert/excalidraw-offline-bin/releases/tag/v0.5.0)** until a follow-up release.

## Highlights (since v0.7.1)

- **Skills → Install excalidraw-sketching skill** — multi-select checklist of agent install targets: `.agents/skills` (Codex, Cursor, GitHub Copilot, Gemini CLI, OpenCode, Amp, Goose, Roo Code, Windsurf), Claude Code (`.claude/skills`), Kiro (`.kiro/skills`), Cline (`.cline/skills`), or **All**; creates missing folders. The installed skill contains only `SKILL.md` and `references/` (no evals or test files).
