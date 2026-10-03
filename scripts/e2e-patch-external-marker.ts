/** Add a distinct text marker to an on-disk .excalidraw (simulates external edit). */
import { readScene, writeScene } from "../desktop/file-format.ts";

const path = Deno.args[0]?.trim();
const marker = Deno.args[1]?.trim() || "E2E_EXTERNAL_MARKER";

if (!path) {
  console.error("usage: e2e-patch-external-marker.ts <file.excalidraw> [marker]");
  Deno.exit(1);
}

const scene = await readScene(path);
const elements = [...(scene.elements ?? [])] as Record<string, unknown>[];
const id = `e2e-ext-${Date.now()}`;
elements.push({
  id,
  type: "text",
  x: 880,
  y: 120,
  width: 320,
  height: 40,
  angle: 0,
  strokeColor: "#c92a2a",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  seed: 1,
  groupIds: [],
  frameId: null,
  roundness: null,
  boundElements: null,
  updated: Date.now(),
  link: null,
  locked: false,
  text: marker,
  fontSize: 28,
  fontFamily: 1,
  textAlign: "left",
  verticalAlign: "top",
  containerId: null,
  originalText: marker,
  lineHeight: 1.25,
});

await writeScene(path, {
  elements: elements as typeof scene.elements,
  appState: scene.appState ?? {},
  files: scene.files ?? {},
});

console.log(`patched ${path} with ${marker}`);
