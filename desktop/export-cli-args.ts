/** Parse `excalidraw-offline export <file.excalidraw> [options]` from argv. */

import { resolveOpenPath } from "./cli-args.ts";
import type { ExportBBox } from "./export-selectors.ts";

export interface ParsedExportCli {
  documentPath: string;
  frames: string[];
  allFrames: boolean;
  elementIds: string[];
  bbox?: ExportBBox;
  out?: string;
  scale: number;
  json: boolean;
}

export type ParseExportCliResult =
  | { kind: "none" }
  | { kind: "export"; command: ParsedExportCli }
  | { kind: "error"; message: string };

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

function parseBbox(value: string): ExportBBox | { error: string } {
  const parts = value.split(",").map((p) => p.trim());
  if (parts.length !== 4) {
    return { error: "--bbox expects x,y,width,height" };
  }
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) {
    return { error: "--bbox values must be numbers" };
  }
  const [x, y, w, h] = nums as [number, number, number, number];
  if (w <= 0 || h <= 0) {
    return { error: "--bbox width and height must be positive" };
  }
  return { x, y, w, h };
}

function takeValue(
  flags: string[],
  index: number,
  name: string,
): { value: string; nextIndex: number } | { error: string } {
  const value = flags[index + 1];
  if (!value || value.startsWith("-")) {
    return { error: `${name} requires a value` };
  }
  return { value, nextIndex: index + 1 };
}

export function parseExportCliCommand(
  args: readonly string[],
  cwd: string,
): ParseExportCliResult {
  const tail = stripLeadingDesktopArgv(args);
  if (tail.length === 0 || tail[0] !== "export") {
    return { kind: "none" };
  }

  let documentRaw: string | null = null;
  const frames: string[] = [];
  const elementIds: string[] = [];
  let allFrames = false;
  let bbox: ExportBBox | undefined;
  let out: string | undefined;
  let scale = 2;
  let json = false;

  const tokens = tail.slice(1);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === "--all-frames") {
      allFrames = true;
      continue;
    }
    if (t === "--json") {
      json = true;
      continue;
    }
    if (t === "--frame") {
      const next = takeValue(tokens, i, "--frame");
      if ("error" in next) return { kind: "error", message: next.error };
      frames.push(next.value);
      i = next.nextIndex;
      continue;
    }
    if (t === "--element") {
      const next = takeValue(tokens, i, "--element");
      if ("error" in next) return { kind: "error", message: next.error };
      elementIds.push(next.value);
      i = next.nextIndex;
      continue;
    }
    if (t === "--bbox") {
      const next = takeValue(tokens, i, "--bbox");
      if ("error" in next) return { kind: "error", message: next.error };
      const parsed = parseBbox(next.value);
      if ("error" in parsed) return { kind: "error", message: parsed.error };
      bbox = parsed;
      i = next.nextIndex;
      continue;
    }
    if (t === "--out") {
      const next = takeValue(tokens, i, "--out");
      if ("error" in next) return { kind: "error", message: next.error };
      out = next.value;
      i = next.nextIndex;
      continue;
    }
    if (t === "--scale") {
      const next = takeValue(tokens, i, "--scale");
      if ("error" in next) return { kind: "error", message: next.error };
      const n = Number(next.value);
      if (!Number.isFinite(n) || n <= 0 || n > 8) {
        return { kind: "error", message: "--scale must be a number between 0 and 8" };
      }
      scale = n;
      i = next.nextIndex;
      continue;
    }
    if (t.startsWith("-")) {
      return { kind: "error", message: `Unknown export flag: ${t}` };
    }
    if (!documentRaw) {
      documentRaw = t;
      continue;
    }
    return { kind: "error", message: `Unexpected argument: ${t}` };
  }

  if (!documentRaw) {
    return {
      kind: "error",
      message: "Usage: excalidraw-offline export <file.excalidraw> [options]",
    };
  }
  if (!documentRaw.toLowerCase().endsWith(".excalidraw")) {
    return { kind: "error", message: "Export path must end with .excalidraw" };
  }

  const documentPath = resolveOpenPath(documentRaw, cwd);
  if (out) {
    out = resolveOpenPath(out, cwd);
  }

  return {
    kind: "export",
    command: {
      documentPath,
      frames,
      allFrames,
      elementIds,
      bbox,
      out,
      scale,
      json,
    },
  };
}
