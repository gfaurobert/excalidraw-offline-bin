import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExportPngTarget } from "../../desktop/export-png.ts";
import { renderSceneExportPng } from "./export-scene-png.ts";

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

export async function renderExportSelectionPng(
  input: RenderExportPngInput,
): Promise<RenderExportPngResult> {
  const appState = input.api.getAppState();
  return await renderSceneExportPng({
    scene: {
      elements: input.api.getSceneElements(),
      appState,
      files: input.api.getFiles(),
    },
    documentPath: input.documentPath,
    selectedElementIds: appState.selectedElementIds,
    scale: EXPORT_SCALE,
    now: input.now,
  });
}
