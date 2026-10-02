import {
  exportToBlob,
  MIME_TYPES,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  buildExportPngFilename,
  drawingBaseNameFromPath,
  formatExportTimestamp,
  resolveExportPngTarget,
  type ExportPngTarget,
} from "../../desktop/export-png.ts";

const EXPORT_SCALE = 2;

export interface RenderExportPngInput {
  api: ExcalidrawImperativeAPI;
  documentPath: string;
  now?: Date;
}

export interface RenderExportPngResult {
  preferredFilename: string;
  pngBase64: string;
  target: ExportPngTarget;
}

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
  selectedElementIds: AppState["selectedElementIds"],
  target: ExportPngTarget,
): readonly ExcalidrawElement[] {
  if (target.kind === "whole_scene" || target.kind === "named_frame") {
    return allElements;
  }
  const ids = Object.keys(selectedElementIds).filter((id) => selectedElementIds[id]);
  return allElements.filter((el) => ids.includes(el.id));
}

export async function renderExportSelectionPng(
  input: RenderExportPngInput,
): Promise<RenderExportPngResult> {
  const appState = input.api.getAppState();
  const allElements = input.api.getSceneElements();
  const files = input.api.getFiles();
  const stubs = allElements.map((el) => ({
    id: el.id,
    type: el.type,
    isDeleted: el.isDeleted,
    name: "name" in el ? (el as { name?: string | null }).name : undefined,
  }));
  const target = resolveExportPngTarget(stubs, appState.selectedElementIds);
  const elements = elementsForTarget(
    allElements,
    appState.selectedElementIds,
    target,
  );

  let exportingFrame: ExcalidrawElement | null | undefined;
  if (target.kind === "named_frame") {
    const frameId = Object.keys(appState.selectedElementIds).find(
      (id) => appState.selectedElementIds[id],
    );
    exportingFrame = allElements.find((el) => el.id === frameId) ?? null;
  }

  const theme = appState.theme ?? "light";
  const blob = await exportToBlob({
    elements,
    appState: {
      ...appState,
      exportBackground: true,
      exportScale: EXPORT_SCALE,
      exportWithDarkMode: theme === "dark",
      viewBackgroundColor: appState.viewBackgroundColor,
    },
    files,
    mimeType: MIME_TYPES.png,
    exportPadding: 10,
    exportingFrame: exportingFrame ?? undefined,
  });

  const timestamp = formatExportTimestamp(input.now ?? new Date());
  const preferredFilename = buildExportPngFilename({
    drawingBase: drawingBaseNameFromPath(input.documentPath),
    timestamp,
    frameNameSanitized: target.kind === "named_frame"
      ? target.frameNameSanitized
      : undefined,
  });

  return {
    preferredFilename,
    pngBase64: await blobToBase64(blob),
    target,
  };
}
