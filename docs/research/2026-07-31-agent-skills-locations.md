# Agent Skills install locations (research)

**Date:** 2026-07-31  
**Purpose:** Decide where Excalidraw Offline should copy the bundled `excalidraw-sketching` skill when the user chooses **Skills → Install…**.  
**Format:** [Agent Skills](https://agentskills.io) — a folder with `SKILL.md` (+ optional `scripts/`, `references/`, `assets/`).

Paths use Unix home (`~`). On Windows, map `~` to the user profile and keep the same relative layout.

---

## Primary comparison table

| AI harness / tool | User (global) skills | Project (repo) skills | Notes / also loads |
| ----------------- | -------------------- | --------------------- | ------------------ |
| **Cursor** | `~/.agents/skills/` · `~/.cursor/skills/` | `.agents/skills/` · `.cursor/skills/` | Also loads Claude/Codex dirs for compatibility: `~/.claude/skills/`, `~/.codex/skills/`, `.claude/skills/`, `.codex/skills/`. Nested `.cursor/skills/` / `.agents/skills/` under packages are scoped to that subtree. |
| **Claude Code** | `~/.claude/skills/` | `.claude/skills/` | Nested `.claude/skills/` under packages when working in that subtree. Plugins can ship skills too. |
| **OpenAI Codex** (CLI / IDE) | `~/.agents/skills/` | `.agents/skills/` (walks cwd → repo root) | Also admin/system: `/etc/codex/skills/`. Older experimental path `~/.codex/skills/` still seen in some Cursor-compat lists; Codex docs emphasize `.agents/skills`. |
| **OpenCode** | `~/.config/opencode/skills/` · `~/.agents/skills/` · `~/.claude/skills/` | `.opencode/skills/` · `.agents/skills/` · `.claude/skills/` | Native global path is **`~/.config/opencode/skills/`** (not `~/.opencode/skills/`). Walks up to git root for project dirs. |
| **OpenClaw** | `~/.openclaw/skills/` (managed / `--global`) · also `~/.agents/skills/` | `<workspace>/skills/` (default install) · `<workspace>/.agents/skills/` | Precedence (high→low): workspace `skills/` → workspace `.agents/skills/` → `~/.agents/skills/` → `~/.openclaw/skills/` → bundled → `extraDirs`. |
| **Hermes Agent** | `~/.hermes/skills/` | *(no first-class project skills dir in docs)* | Single source of truth is user dir; optional category subfolders (`mlops/…`). Hub/URL installs land here. Extra dirs via config (`skills_dirs` / similar). |
| **GitHub Copilot** | `~/.copilot/skills/` · `~/.agents/skills/` | `.github/skills/` · `.agents/skills/` · `.claude/skills/` | Also sees `~/.claude/skills/` as personal in some IDE docs. |
| **Gemini CLI** | `~/.gemini/skills/` · `~/.agents/skills/` | `.gemini/skills/` · `.agents/skills/` | Within the same tier, `.agents/skills/` wins over `.gemini/skills/`. |
| **Google Antigravity** | `~/.gemini/config/skills/` (reported) | `.agents/skills/` | Aligns with Agent Skills / Gemini family. |
| **Windsurf** (Cascade) | `~/.codeium/windsurf/skills/` (installer maps) | `.windsurf/skills/` | Community tables also mention `.agents/skills/` for some setups; native project path is `.windsurf/skills/`. |
| **Cline** | `~/.agents/skills/` (common installer target) | `.cline/skills/` (also reads `.claude/skills/`) | Feature may need enabling in Settings. |
| **Continue.dev** | `~/.continue/skills/` | `.continue/skills/` | Installer-mapped; also often used with `.agents/skills/` via universal installers. |
| **Kiro** | `~/.kiro/skills/` | `.kiro/skills/` | Custom agents may need an explicit `resources` glob. |
| **Amp** | `~/.config/agents/skills/` | `.agents/skills/` | Per `skills` CLI agent map. |
| **Universal / cross-tool default** | `~/.agents/skills/` | `.agents/skills/` | Emerging shared convention (Codex, Cursor, Copilot, Gemini alias, OpenCode, OpenClaw tier). **Best single target** if the user wants one copy for many tools. |

---

## Recommended defaults for this app

| User intent | Suggested destination | Why |
| ----------- | --------------------- | --- |
| “Install for me everywhere (Cursor / Linux)” | `~/.agents/skills/excalidraw-sketching/` | Cursor + Codex + Copilot + Gemini alias + OpenCode/OpenClaw all read it. Matches your current machine layout. |
| “Install for this git project / team” | `<project>/.agents/skills/excalidraw-sketching/` | Commit-friendly; widest project-level overlap. |
| “Claude Code only (user)” | `~/.claude/skills/excalidraw-sketching/` | Claude’s native personal path. |
| “Claude Code only (project)” | `<project>/.claude/skills/excalidraw-sketching/` | Team Claude workflows. |
| “OpenCode native (user)” | `~/.config/opencode/skills/excalidraw-sketching/` | OpenCode-first global path. |
| “OpenClaw workspace” | `<workspace>/skills/excalidraw-sketching/` | Default `openclaw skills install` target. |
| “OpenClaw all agents” | `~/.openclaw/skills/excalidraw-sketching/` | `openclaw skills install … --global`. |
| “Hermes” | `~/.hermes/skills/excalidraw-sketching/` | Hermes only documents the user tree. |

**Layout to copy:** entire skill folder (at least `SKILL.md`; include `references/`, `evals/`, etc. if present).

```text
<destination-root>/
└── excalidraw-sketching/
    ├── SKILL.md
    ├── references/   # optional
    ├── evals/        # optional
    └── …
```

---

## Sources (checked 2026-07-31)

| Tool | Doc |
| ---- | --- |
| Cursor | https://cursor.com/docs/skills |
| Claude Code | https://code.claude.com/docs/en/skills |
| Codex | https://developers.openai.com/codex/skills |
| OpenCode | https://opencode.ai/docs/skills/ |
| OpenClaw | https://docs.openclaw.ai/tools/skills · https://docs.openclaw.ai/cli/skills |
| Hermes | https://hermes-agent.nousresearch.com/docs/user-guide/features/skills |
| GitHub Copilot | https://docs.github.com/en/copilot/concepts/agents/about-agent-skills |
| Gemini CLI | https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md |
| Cross-agent map | https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/docs/COMPATIBILITY.md |
| Spec | https://agentskills.io |

Paths drift as tools ship updates; prefer each vendor’s current docs (or `npx skills` / `gh skill install`) when installing at scale.

---

## Implication for Excalidraw Offline UI

1. Offer **User vs Project** first.  
2. Then either:
   - **Recommended:** copy to `.agents/skills` (project) or `~/.agents/skills` (user), or  
   - **Tool-specific:** pick Cursor / Claude / Codex / OpenCode / OpenClaw / Hermes and map to the table above.  
3. For **Project**, ask for a project/workspace root (folder picker), then write `<root>/.agents/skills/excalidraw-sketching/` (or the tool-specific project path).  
4. Confirm overwrite if the destination folder already exists.
