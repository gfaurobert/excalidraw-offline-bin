import { exportToBlob, MIME_TYPES } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  buildExportPngFilename,
  drawingBaseNameFromPath,
  formatExportTimestamp,
  resolveExportPngTarget,
  type ExportPngTarget,
} from "../../desktop/export-png.ts";

export interface SceneExportPayload {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

export interface SceneExportRenderInput {
  scene: SceneExportPayload;
  documentPath: string;
  selectedElementIds: Readonly<Record<string, true>>;
  exportingFrameId?: string;
  frameNameSanitized?: string;
  scale?: number;
  now?: Date;
}

export interface SceneExportRenderResult {
  preferredFilename: string;
  pngBase64: string;
  target: ExportPngTarget;
}

const DEFAULT_SCALE = 2;

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function elementsForTarget(
  allElements: readonly ExcalidrawElement[],
  selectedElementIds: Readonly<Record<string, true>>,
  target: ExportPngTarget,
): readonly ExcalidrawElement[] {
  if (target.kind === "whole_scene" || target.kind === "named_frame") {
    return allElements;
  }
  const ids = Object.keys(selectedElementIds).filter((id) => selectedElementIds[id]);
  return allElements.filter((el) => ids.includes(el.id));
}

export async function renderSceneExportPng(
  input: SceneExportRenderInput,
): Promise<SceneExportRenderResult> {
  const allElements = input.scene.elements.filter((el) => !el.isDeleted);
  const stubs = allElements.map((el) => ({
    id: el.id,
    type: el.type,
    isDeleted: el.isDeleted,
    name: "name" in el ? (el as { name?: string | null }).name : undefined,
  }));
  const target = resolveExportPngTarget(stubs, input.selectedElementIds);
  const elements = elementsForTarget(
    allElements,
    input.selectedElementIds,
    target,
  );

  let exportingFrame: ExcalidrawElement | undefined;
  if (input.exportingFrameId) {
    exportingFrame = allElements.find((el) => el.id === input.exportingFrameId);
  } else if (target.kind === "named_frame") {
    const frameId = Object.keys(input.selectedElementIds).find(
      (id) => input.selectedElementIds[id],
    );
    exportingFrame = allElements.find((el) => el.id === frameId);
  }

  const baseAppState = input.scene.appState ?? {};
  const theme = baseAppState.theme ?? "light";
  const scale = input.scale ?? DEFAULT_SCALE;

  const blob = await exportToBlob({
    elements,
    appState: {
      ...baseAppState,
      exportBackground: true,
      exportScale: scale,
      exportWithDarkMode: theme === "dark",
      viewBackgroundColor: baseAppState.viewBackgroundColor ?? "#ffffff",
    },
    files: input.scene.files ?? {},
    mimeType: MIME_TYPES.png,
    exportPadding: 10,
    exportingFrame: exportingFrame ?? undefined,
  });

  const timestamp = formatExportTimestamp(input.now ?? new Date());
  const frameNameSanitized = input.frameNameSanitized?.trim() ||
    (target.kind === "named_frame" ? target.frameNameSanitized : undefined);

  const preferredFilename = buildExportPngFilename({
    drawingBase: drawingBaseNameFromPath(input.documentPath),
    timestamp,
    frameNameSanitized,
  });

  return {
    preferredFilename,
    pngBase64: await blobToBase64(blob),
    target,
  };
}
