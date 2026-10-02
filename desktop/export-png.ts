/** Pure helpers for File → Export selection as PNG (paths + naming). */

import { basename, dirname, join } from "./path.ts";

export interface ExportElementStub {
  id: string;
  type: string;
  isDeleted?: boolean;
  name?: string | null;
}

export type ExportPngTarget =
  | { kind: "whole_scene" }
  | { kind: "selection" }
  | { kind: "named_frame"; frameNameSanitized: string };

export type ExportSelectionPlan =
  | { kind: "noop"; reason: "start_screen" | "untitled" }
  | { kind: "export"; documentPath: string };

const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;
const MAX_FRAME_FILENAME_PART = 80;

export function planExportSelectionPng(input: {
  mode: "start" | "canvas";
  documentPath: string | null;
}): ExportSelectionPlan {
  if (input.mode !== "canvas") {
    return { kind: "noop", reason: "start_screen" };
  }
  const path = input.documentPath?.trim();
  if (!path) return { kind: "noop", reason: "untitled" };
  return { kind: "export", documentPath: path };
}

export function drawingBaseNameFromPath(documentPath: string): string {
  const file = basename(documentPath);
  const lower = file.toLowerCase();
  if (lower.endsWith(".excalidraw")) {
    return sanitizeFilenamePart(file.slice(0, -".excalidraw".length));
  }
  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file;
  return sanitizeFilenamePart(stem);
}

export function sanitizeFilenamePart(part: string): string {
  let s = part.trim().replace(ILLEGAL_FILENAME_CHARS, "_");
  s = s.replace(/\s+/g, " ");
  s = s.replace(/[.\s]+$/g, "");
  return s || "drawing";
}

export function sanitizeFrameNameForFilename(
  name: string,
  maxLen = MAX_FRAME_FILENAME_PART,
): string {
  let s = name.trim().replace(ILLEGAL_FILENAME_CHARS, "_");
  s = s.replace(/\s+/g, " ");
  s = s.replace(/[.\s]+$/g, "");
  if (!s) return "";
  if (s.length > maxLen) {
    s = s.slice(0, maxLen).replace(/[.\s]+$/g, "");
  }
  return s;
}

/** Local time, filesystem-safe, sortable: YYYYMMDD-HHMMSS */
export function formatExportTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${
    pad(date.getHours())
  }${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function selectedElementIdsList(
  selectedElementIds: Readonly<Record<string, true>>,
): string[] {
  return Object.keys(selectedElementIds).filter((id) => selectedElementIds[id]);
}

export function resolveExportPngTarget(
  elements: readonly ExportElementStub[],
  selectedElementIds: Readonly<Record<string, true>>,
): ExportPngTarget {
  const selectedIds = selectedElementIdsList(selectedElementIds);
  const live = elements.filter((el) => !el.isDeleted);
  const selected = live.filter((el) => selectedIds.includes(el.id));

  if (selected.length === 0) {
    return { kind: "whole_scene" };
  }

  if (selected.length === 1 && selected[0]!.type === "frame") {
    const rawName = selected[0]!.name?.trim() ?? "";
    const frameNameSanitized = sanitizeFrameNameForFilename(rawName);
    if (frameNameSanitized) {
      return { kind: "named_frame", frameNameSanitized };
    }
  }

  return { kind: "selection" };
}

export function buildExportPngFilename(input: {
  drawingBase: string;
  timestamp: string;
  frameNameSanitized?: string;
}): string {
  const base = sanitizeFilenamePart(input.drawingBase);
  const stem = input.frameNameSanitized?.trim()
    ? `${base}_${input.frameNameSanitized}_${input.timestamp}`
    : `${base}_${input.timestamp}`;
  return `${stem}.png`;
}

/** attempt 0 = preferred name; 1 → `-2` before extension; 2 → `-3`, etc. */
export function withExportCollisionSuffix(
  filename: string,
  attempt: number,
): string {
  if (attempt <= 0) return filename;
  const lower = filename.toLowerCase();
  if (!lower.endsWith(".png")) {
    return `${filename}-${attempt + 1}`;
  }
  const stem = filename.slice(0, -4);
  return `${stem}-${attempt + 1}.png`;
}

export function exportDirForDocument(documentPath: string): string {
  return join(dirname(documentPath), "export");
}

export async function pickUniqueExportFilename(
  exportDir: string,
  preferredFilename: string,
  exists: (absolutePath: string) => Promise<boolean>,
): Promise<{ filename: string; absolutePath: string }> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const filename = withExportCollisionSuffix(preferredFilename, attempt);
    const absolutePath = join(exportDir, filename);
    if (!(await exists(absolutePath))) {
      return { filename, absolutePath };
    }
  }
  throw new Error("too many export PNG name collisions");
}

export function decodePngBase64(base64: string): Uint8Array {
  const trimmed = base64.trim();
  if (!trimmed) throw new Error("empty PNG payload");
  const binary = atob(trimmed);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
