/** Parse file-open paths from process argv for CLI / MIME launches. */
import { isAbsolutePath, join } from "./path.ts";
import {
  findExportSubcommandIndex,
  isRuntimeArgvNoise,
  stripLeadingDesktopArgv,
} from "./process-argv.ts";

/**
 * Pick the first openable path from argv-like strings.
 * Skips leading flags (`-…`, `--…`), runtime noise, and `export` subcommands.
 */
export function parseOpenPathArg(args: readonly string[]): string | null {
  if (findExportSubcommandIndex(args) >= 0) {
    return null;
  }

  const tail = stripLeadingDesktopArgv(args);
  for (const a of tail) {
    const trimmed = a.trim();
    if (trimmed.length === 0) continue;
    if (isRuntimeArgvNoise(trimmed)) continue;
    if (!trimmed.toLowerCase().endsWith(".excalidraw")) continue;
    return trimmed;
  }
  return null;
}

/**
 * Resolve a user-supplied path to an absolute path.
 * Absolute inputs are returned as-is (after trim). Relative paths join with cwd.
 */
export function resolveOpenPath(
  raw: string,
  cwd: string,
): string {
  const trimmed = raw.trim();
  if (isAbsolutePath(trimmed)) return trimmed.replace(/\\/g, "/");
  const base = cwd.replace(/[\\/]+$/, "") || "/";
  if (trimmed === "" || trimmed === ".") return base.replace(/\\/g, "/");
  const rel = trimmed.replace(/^\.[\\/]/, "");
  return join(base, rel);
}

/** Parse argv and resolve; null if no path argument. */
export function openPathFromArgs(
  args: readonly string[],
  cwd: string,
): string | null {
  const raw = parseOpenPathArg(args);
  if (raw === null) return null;
  return resolveOpenPath(raw, cwd);
}
