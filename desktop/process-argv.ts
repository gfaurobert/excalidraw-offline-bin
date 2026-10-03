/** Normalize Deno.args from dev (`deno desktop`) and packaged desktop binaries. */

import { isAbsolutePath, join } from "./path.ts";

/** Skip Deno Desktop / deno flags and the main.ts script path. */
export function stripLeadingDesktopArgv(args: readonly string[]): string[] {
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
  const tail = args.slice(i).map((a) => a.trim()).filter((a) => a.length > 0);
  while (
    tail.length > 0 &&
    (tail[0]!.endsWith(".ts") || tail[0]!.endsWith(".js")) &&
    !tail[0]!.toLowerCase().endsWith(".excalidraw")
  ) {
    tail.shift();
  }
  return tail;
}

/** Tokens injected by the desktop launcher/runtime, not user intent. */
export function isRuntimeArgvNoise(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (lower === "export") return false;
  if (lower.endsWith(".excalidraw")) return false;
  if (lower.endsWith(".so") || lower.endsWith(".dylib") || lower.endsWith(".dll")) {
    return true;
  }
  if (lower.endsWith(".ts") || lower.endsWith(".js")) return true;
  const normalized = trimmed.replace(/\\/g, "/");
  if (/\/excalidraw-offline(\.exe|\.app)?$/i.test(normalized)) return true;
  if (normalized.endsWith("/excalidraw-offline/excalidraw-offline")) return true;
  return false;
}

export function findExportSubcommandIndex(args: readonly string[]): number {
  const tail = stripLeadingDesktopArgv(args);
  for (let i = 0; i < tail.length; i++) {
    if (tail[i] === "export") return i;
  }
  return -1;
}

/** Packaged runtimes may pass the same drawing twice (basename + absolute path). */
function resolvePathForCompare(raw: string, cwd: string): string {
  const trimmed = raw.trim();
  if (isAbsolutePath(trimmed)) return trimmed.replace(/\\/g, "/");
  const base = cwd.replace(/[\\/]+$/, "") || "/";
  const rel = trimmed.replace(/^\.[\\/]/, "");
  return join(base, rel);
}

/** Packaged runtimes may pass the same drawing twice (basename + absolute path). */
export function preferredExcalidrawDocumentArg(
  candidates: readonly string[],
  cwd: string,
): string {
  if (candidates.length === 0) {
    throw new Error("preferredExcalidrawDocumentArg: empty candidates");
  }
  if (candidates.length === 1) return candidates[0]!;

  const resolved = candidates.map((raw) => ({
    raw,
    abs: resolvePathForCompare(raw, cwd),
  }));

  const absolutes = resolved.filter((r) => isAbsolutePath(r.raw.trim()));
  if (absolutes.length > 0) {
    return absolutes[absolutes.length - 1]!.raw;
  }

  const last = resolved[resolved.length - 1]!;
  if (resolved.every((r) => r.abs === last.abs)) {
    return last.raw;
  }
  return last.raw;
}
