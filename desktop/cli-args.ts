/** Parse file-open paths from process argv for CLI / MIME launches. */
import { isAbsolutePath, join } from "./path.ts";

/**
 * Pick the first openable path from argv-like strings.
 * Skips leading flags (`-…`, `--…`) and non-`.excalidraw` tokens
 * (so `deno desktop … ./desktop/main.ts file.excalidraw` still works).
 */
export function parseOpenPathArg(args: readonly string[]): string | null {
  let i = 0;
  while (i < args.length) {
    const a = args[i]!;
    if (a === "--") {
      i += 1;
      break;
    }
    if (a.startsWith("-")) {
      i += 1;
      continue;
    }
    break;
  }
  for (; i < args.length; i++) {
    const a = args[i]!.trim();
    if (a.length === 0) continue;
    if (!a.toLowerCase().endsWith(".excalidraw")) continue;
    return a;
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
