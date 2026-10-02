/** Write a rich .excalidraw fixture for CLI export E2E tests. */
import { bytesToDataURL, writeScene } from "../desktop/file-format.ts";
import { join } from "../desktop/path.ts";
import type { ScenePayload } from "../desktop/types.ts";

const FIXTURE_DIR = join(Deno.cwd(), "test-fixtures/e2e-export");
const DOC = join(FIXTURE_DIR, "matrix-demo.excalidraw");

/** Minimal Excalidraw element fields shared by shapes. */
function base(id: string, type: string, x: number, y: number, w: number, h: number) {
  return {
    id,
    type,
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: type === "text" ? "transparent" : "#a5d8ff",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    version: 141,
    versionNonce: 1,
    isDeleted: false,
    seed: 1,
    groupIds: [] as string[],
    frameId: null as string | null,
    roundness: type === "rectangle" ? { type: 3 } : null,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
  };
}

export const E2E_IDS = {
  frameLogin: "frame-login-id",
  frameDashboard: "frame-dash-id",
  rectOutside: "rect-outside-id",
  textOutside: "text-outside-id",
  rectLogin: "rect-login-inner-id",
  imageId: "img-file-id",
} as const;

export async function createE2eExportFixture(): Promise<string> {
  await Deno.mkdir(FIXTURE_DIR, { recursive: true });
  const iconBytes = await Deno.readFile(join(Deno.cwd(), "icons/icon.png"));

  const elements: Record<string, unknown>[] = [
    {
      ...base(E2E_IDS.frameLogin, "frame", 20, 20, 420, 320),
      name: 'UI "mock" / v2',
      index: "a0",
    },
    {
      ...base(E2E_IDS.frameDashboard, "frame", 480, 20, 360, 280),
      name: "Dashboard",
      index: "a1",
    },
    {
      ...base(E2E_IDS.rectOutside, "rectangle", 520, 360, 180, 90),
      backgroundColor: "#ffc9c9",
      frameId: null,
    },
    {
      ...base(E2E_IDS.textOutside, "text", 520, 480, 220, 40),
      backgroundColor: "transparent",
      text: "Outside all frames",
      fontSize: 20,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      originalText: "Outside all frames",
      lineHeight: 1.25,
    },
    {
      ...base(E2E_IDS.rectLogin, "rectangle", 60, 80, 140, 70),
      backgroundColor: "#b2f2bb",
      frameId: E2E_IDS.frameLogin,
    },
    {
      id: E2E_IDS.imageId,
      type: "image",
      x: 240,
      y: 100,
      width: 64,
      height: 64,
      angle: 0,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      version: 141,
      versionNonce: 2,
      isDeleted: false,
      seed: 2,
      groupIds: [],
      frameId: E2E_IDS.frameLogin,
      roundness: null,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
      status: "saved",
      fileId: E2E_IDS.imageId,
      scale: [1, 1],
    },
  ];

  const scene: ScenePayload = {
    elements: elements as ScenePayload["elements"],
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: 20,
    },
    files: {
      [E2E_IDS.imageId]: {
        mimeType: "image/png",
        id: E2E_IDS.imageId,
        dataURL: bytesToDataURL(iconBytes, "image/png"),
        created: Date.now(),
        lastRetrieved: Date.now(),
      },
    },
  };

  await writeScene(DOC, scene);
  return DOC;
}

if (import.meta.main) {
  const path = await createE2eExportFixture();
  console.log(path);
}
