/** Paths and naming for upstream Excalidraw image export → native save. */

import { exportDirForDocument } from "./export-png.ts";
import { join } from "./path.ts";

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

export function suggestedImageExportPath(input: {
  documentPath: string | null;
  homeDir: string;
  filename: string;
}): string {
  const safeName = sanitizeExportDownloadFilename(input.filename);
  if (input.documentPath?.trim()) {
    return join(exportDirForDocument(input.documentPath.trim()), safeName);
  }
  return join(input.homeDir.replace(/[\\/]+$/, "") || ".", "export", safeName);
}
