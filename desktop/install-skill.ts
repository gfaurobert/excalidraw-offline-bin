/**
 * Install the bundled excalidraw-sketching Agent Skill into destination roots.
 */

import { join, basename } from "./path.ts";

export const SKILL_ID = "excalidraw-sketching";

export type InstallMode = "global" | "project" | "custom";

export type InstallHarnessId = "agents" | "claude" | "kiro" | "cline" | "all";

type ConcreteHarnessId = Exclude<InstallHarnessId, "all">;

export const HARNESS_TARGET_OPTIONS: {
  id: InstallHarnessId;
  label: string;
}[] = [
  {
    id: "agents",
    label:
      ".agents/skills (Codex, Cursor, GitHub Copilot, Gemini CLI, OpenCode, Amp, Goose, Roo Code, Windsurf)",
  },
  { id: "claude", label: "Claude Code" },
  { id: "kiro", label: "Kiro" },
  { id: "cline", label: "Cline" },
  { id: "all", label: "All" },
];

export const DEFAULT_HARNESS_TARGET_IDS: InstallHarnessId[] = ["agents", "claude"];

const CONCRETE_HARNESS_IDS: ConcreteHarnessId[] = [
  "agents",
  "claude",
  "kiro",
  "cline",
];

/** Entries copied into each install destination (no tests or evals). */
export const SKILL_INSTALL_ENTRIES = ["SKILL.md", "references"] as const;

export function agentsSkillsUserDir(home: string): string {
  return join(home, ".agents", "skills");
}

function normalizeRoot(pickedPath: string): string {
  return pickedPath.trim().replace(/[\\/]+$/, "") || "/";
}

export function harnessSkillsDir(
  harnessId: ConcreteHarnessId,
  root: string,
): string {
  switch (harnessId) {
    case "agents":
      return join(root, ".agents", "skills");
    case "claude":
      return join(root, ".claude", "skills");
    case "kiro":
      return join(root, ".kiro", "skills");
    case "cline":
      return join(root, ".cline", "skills");
  }
}

export function expandHarnessSelection(
  selected: InstallHarnessId[],
): ConcreteHarnessId[] {
  if (selected.includes("all")) {
    return CONCRETE_HARNESS_IDS.slice();
  }
  const out: ConcreteHarnessId[] = [];
  for (const id of selected) {
    if (id === "all") continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Resolve install folder paths for global/project harness targets. */
export function resolveHarnessInstallDests(
  mode: "global" | "project",
  home: string,
  harnessIds: InstallHarnessId[],
  projectRoot?: string,
): string[] {
  const root = mode === "global" ? home : normalizeRoot(projectRoot ?? "");
  if (mode === "project" && !projectRoot?.trim()) {
    throw new Error("picked path required for project install");
  }
  const expanded = expandHarnessSelection(harnessIds);
  return expanded.map((h) =>
    join(harnessSkillsDir(h, root), SKILL_ID)
  );
}

/** Absolute path of the skill folder for custom install (unchanged behavior). */
export function resolveInstallTarget(
  mode: InstallMode,
  home: string,
  pickedPath?: string,
): string {
  if (mode === "global") {
    return join(agentsSkillsUserDir(home), SKILL_ID);
  }
  if (!pickedPath || !pickedPath.trim()) {
    throw new Error("picked path required for project/custom install");
  }
  const root = normalizeRoot(pickedPath);
  if (mode === "project") {
    return join(root, ".agents", "skills", SKILL_ID);
  }
  return join(root, SKILL_ID);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Recursively copy a directory tree. Overwrites destination if it exists. */
export async function copyDirRecursive(
  source: string,
  dest: string,
): Promise<void> {
  if (await pathExists(dest)) {
    await Deno.remove(dest, { recursive: true });
  }
  await Deno.mkdir(dest, { recursive: true });

  for await (const entry of Deno.readDir(source)) {
    const from = join(source, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory) {
      await copyDirRecursive(from, to);
    } else if (entry.isFile) {
      await Deno.copyFile(from, to);
    } else if (entry.isSymlink) {
      const target = await Deno.readLink(from);
      await Deno.symlink(target, to);
    }
  }
}

/** Copy only skill payload files (SKILL.md, references/) for installs. */
export async function copySkillContent(
  source: string,
  dest: string,
): Promise<void> {
  if (await pathExists(dest)) {
    await Deno.remove(dest, { recursive: true });
  }
  await Deno.mkdir(dest, { recursive: true });

  for (const name of SKILL_INSTALL_ENTRIES) {
    const from = join(source, name);
    if (!(await pathExists(from))) continue;
    const to = join(dest, name);
    const info = await Deno.stat(from);
    if (info.isFile) {
      await Deno.copyFile(from, to);
    } else if (info.isDirectory) {
      await copyDirRecursive(from, to);
    }
  }
}

export async function assertSkillSource(source: string): Promise<void> {
  const skillMd = join(source, "SKILL.md");
  try {
    const info = await Deno.stat(skillMd);
    if (!info.isFile) throw new Error("SKILL.md is not a file");
  } catch (err) {
    throw new Error(
      `Bundled skill missing at ${source} (${String(err)})`,
    );
  }
  if (basename(source) !== SKILL_ID) {
    throw new Error(`Expected skill folder named ${SKILL_ID}, got ${source}`);
  }
}

export type InstallSkillResult =
  | { ok: true; dest: string }
  | { ok: false; reason: "cancelled" | "error"; detail: string };

export type InstallSkillManyResult =
  | { ok: true; dests: string[] }
  | { ok: false; reason: "error"; detail: string };

export async function installSkillTo(
  source: string,
  dest: string,
): Promise<InstallSkillResult> {
  try {
    await assertSkillSource(source);
    await Deno.mkdir(join(dest, ".."), { recursive: true });
    await copySkillContent(source, dest);
    return { ok: true, dest };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}

export async function installSkillToMany(
  source: string,
  dests: string[],
): Promise<InstallSkillManyResult> {
  if (dests.length === 0) {
    return { ok: false, reason: "error", detail: "no destinations" };
  }
  const installed: string[] = [];
  try {
    await assertSkillSource(source);
    for (const dest of dests) {
      await Deno.mkdir(join(dest, ".."), { recursive: true });
      await copySkillContent(source, dest);
      installed.push(dest);
    }
    return { ok: true, dests: installed };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}
