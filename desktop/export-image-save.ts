/** Paths for upstream Excalidraw image export → native save dialog. */

import { drawingDirectoryForDocument } from "./export-png.ts";
import { basename, join } from "./path.ts";

export function sanitizeExportDownloadFilename(filename: string): string {
  const trimmed = filename.trim().replace(/[\\/:*?"<>|]/g, "_");
  return trimmed || "export.png";
}

export function extensionFromExportFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".excalidraw.png")) return "excalidraw.png";
  if (lower.endsWith(".excalidraw.svg")) return "excalidraw.svg";
  if (lower.endsWith(".svg")) return "svg";
  if (lower.endsWith(".png")) return "png";
  return "png";
}

/** Default native save path: same folder as the open `.excalidraw` file. */
export function suggestedImageExportPath(input: {
  documentPath: string | null;
  homeDir: string;
  filename: string;
}): string {
  const safeName = sanitizeExportDownloadFilename(input.filename);
  if (input.documentPath?.trim()) {
    return join(drawingDirectoryForDocument(input.documentPath.trim()), safeName);
  }
  const home = input.homeDir.replace(/[\\/]+$/, "") || ".";
  return join(home, safeName);
}
