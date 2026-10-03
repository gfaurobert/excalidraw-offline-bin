/** Resolve CLI/GUI export selectors to concrete export jobs. */

import {
  type ExportElementStub,
  sanitizeFrameNameForFilename,
} from "./export-png.ts";

export interface ExportBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExportSelectorInput {
  frames?: readonly string[];
  allFrames?: boolean;
  elementIds?: readonly string[];
  bbox?: ExportBBox;
}

export interface BoundableExportElement extends ExportElementStub {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ResolvedExportJob {
  jobId: string;
  selectedElementIds: Record<string, true>;
  /** Set when exporting a named frame clip. */
  exportingFrameId?: string;
  frameNameSanitized?: string;
}

export type ResolveExportJobsResult =
  | { ok: true; jobs: ResolvedExportJob[] }
  | { ok: false; error: string };

function liveElements(
  elements: readonly ExportElementStub[],
): ExportElementStub[] {
  return elements.filter((el) => !el.isDeleted);
}

function frameElements(
  elements: readonly ExportElementStub[],
): ExportElementStub[] {
  return liveElements(elements).filter((el) => el.type === "frame");
}

export function findFramesByName(
  elements: readonly ExportElementStub[],
  name: string,
): ExportElementStub[] {
  const wanted = name.trim();
  if (!wanted) return [];
  return frameElements(elements).filter(
    (f) => (f.name?.trim() ?? "") === wanted,
  );
}

export function namedFrames(
  elements: readonly ExportElementStub[],
): ExportElementStub[] {
  return frameElements(elements).filter((f) =>
    sanitizeFrameNameForFilename(f.name?.trim() ?? "") !== ""
  );
}

export function elementIntersectsBBox(
  el: BoundableExportElement,
  bbox: ExportBBox,
): boolean {
  if (el.x === undefined || el.y === undefined) return false;
  const w = el.width ?? 0;
  const h = el.height ?? 0;
  const ex1 = el.x;
  const ey1 = el.y;
  const ex2 = ex1 + w;
  const ey2 = ey1 + h;
  const bx2 = bbox.x + bbox.w;
  const by2 = bbox.y + bbox.h;
  return !(ex2 < bbox.x || ex1 > bx2 || ey2 < bbox.y || ey1 > by2);
}

export function elementIdsInBBox(
  elements: readonly BoundableExportElement[],
  bbox: ExportBBox,
): string[] {
  return liveElements(elements)
    .filter((el) => elementIntersectsBBox(el as BoundableExportElement, bbox))
    .map((el) => el.id);
}

function jobForFrame(frame: ExportElementStub, index: number): ResolvedExportJob {
  const frameNameSanitized = sanitizeFrameNameForFilename(
    frame.name?.trim() ?? "",
  );
  return {
    jobId: `frame-${frame.id}-${index}`,
    selectedElementIds: { [frame.id]: true },
    exportingFrameId: frame.id,
    frameNameSanitized: frameNameSanitized || undefined,
  };
}

export function resolveExportJobs(
  elements: readonly BoundableExportElement[],
  input: ExportSelectorInput,
): ResolveExportJobsResult {
  const hasFrames = Boolean(input.allFrames || input.frames?.length);
  const hasElements = Boolean(input.elementIds?.length);
  const hasBbox = Boolean(input.bbox);

  const modeCount = [hasFrames, hasElements, hasBbox].filter(Boolean).length;
  if (modeCount > 1) {
    return {
      ok: false,
      error:
        "Use only one selector kind: --frame/--all-frames, --element, or --bbox",
    };
  }

  if (input.allFrames || input.frames?.length) {
    const jobs: ResolvedExportJob[] = [];
    if (input.allFrames) {
      const frames = namedFrames(elements);
      if (frames.length === 0) {
        return { ok: false, error: "No named frames found in the drawing" };
      }
      frames.forEach((frame, i) => jobs.push(jobForFrame(frame, i)));
    } else if (input.frames?.length) {
      for (const name of input.frames) {
        const matches = findFramesByName(elements, name);
        if (matches.length === 0) {
          return { ok: false, error: `Frame not found: ${name.trim()}` };
        }
        matches.forEach((frame, i) => jobs.push(jobForFrame(frame, i)));
      }
    }
    return { ok: true, jobs };
  }

  if (input.elementIds?.length) {
    const live = liveElements(elements);
    const ids: Record<string, true> = {};
    for (const id of input.elementIds) {
      const trimmed = id.trim();
      if (!trimmed) continue;
      const found = live.find((el) => el.id === trimmed);
      if (!found) {
        return { ok: false, error: `Element not found: ${trimmed}` };
      }
      ids[trimmed] = true;
    }
    if (Object.keys(ids).length === 0) {
      return { ok: false, error: "No element ids provided" };
    }
    return {
      ok: true,
      jobs: [{
        jobId: "elements",
        selectedElementIds: ids,
      }],
    };
  }

  if (input.bbox) {
    const ids = elementIdsInBBox(elements, input.bbox);
    if (ids.length === 0) {
      return {
        ok: false,
        error: "No elements intersect the given --bbox",
      };
    }
    const selectedElementIds: Record<string, true> = {};
    for (const id of ids) selectedElementIds[id] = true;
    return {
      ok: true,
      jobs: [{ jobId: "bbox", selectedElementIds }],
    };
  }

  return {
    ok: true,
    jobs: [{ jobId: "whole-scene", selectedElementIds: {} }],
  };
}
