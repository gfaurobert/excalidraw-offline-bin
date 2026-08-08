/** Ensure a .excalidraw path exists on disk (create blank if missing). */
import { dirname } from "./path.ts";
import { writeScene } from "./file-format.ts";
import type { ScenePayload } from "./types.ts";

export function emptyScene(): ScenePayload {
  return {
    elements: [],
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: 20,
    },
    files: {},
  };
}

export function isExcalidrawPath(path: string): boolean {
  return path.trim().toLowerCase().endsWith(".excalidraw");
}

export type EnsureExcalidrawResult = "exists" | "created";

/**
 * If `path` already exists, return `"exists"`.
 * If missing, create parent dirs, write a blank Excalidraw document, return `"created"`.
 * Rejects non-`.excalidraw` paths.
 */
export async function ensureExcalidrawFile(
  path: string,
): Promise<EnsureExcalidrawResult> {
  const trimmed = path.trim();
  if (!isExcalidrawPath(trimmed)) {
    throw new Error(`not an .excalidraw path: ${trimmed}`);
  }
  try {
    const st = await Deno.stat(trimmed);
    if (st.isFile) return "exists";
    throw new Error(`path exists but is not a file: ${trimmed}`);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  await Deno.mkdir(dirname(trimmed), { recursive: true });
  await writeScene(trimmed, emptyScene());
  return "created";
}
