/**
 * Install the bundled excalidraw-sketching Agent Skill into a destination root.
 */

import { join, basename } from "./path.ts";

export const SKILL_ID = "excalidraw-sketching";

export type InstallMode = "global" | "project" | "custom";

export function agentsSkillsUserDir(home: string): string {
  return join(home, ".agents", "skills");
}

/** Absolute path of the skill folder for a given mode + optional picked path. */
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
  const root = pickedPath.trim().replace(/\/+$/, "") || "/";
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

export async function installSkillTo(
  source: string,
  dest: string,
): Promise<InstallSkillResult> {
  try {
    await assertSkillSource(source);
    await Deno.mkdir(join(dest, ".."), { recursive: true });
    await copyDirRecursive(source, dest);
    return { ok: true, dest };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}
