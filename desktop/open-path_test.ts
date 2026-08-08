import {
  emptyScene,
  ensureExcalidrawFile,
  isExcalidrawPath,
} from "./open-path.ts";
import { readScene } from "./file-format.ts";
import { join } from "./path.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

Deno.test("isExcalidrawPath", () => {
  assertEquals(isExcalidrawPath("/a/b.excalidraw"), true);
  assertEquals(isExcalidrawPath("/a/b.EXCALIDRAW"), true);
  assertEquals(isExcalidrawPath("/a/b.json"), false);
});

Deno.test("ensureExcalidrawFile creates blank then reports exists", async () => {
  const root = await Deno.makeTempDir({ prefix: "exo-open-path-" });
  try {
    const path = join(root, "nested", "new.excalidraw");
    assertEquals(await ensureExcalidrawFile(path), "created");
    const scene = await readScene(path);
    assertEquals(scene.elements, []);
    assertEquals(await ensureExcalidrawFile(path), "exists");
    // second ensure must not wipe content
    await Deno.writeTextFile(path, `${JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "test",
      elements: [{ id: "keep" }],
      appState: {},
      files: {},
    }, null, 2)}\n`);
    assertEquals(await ensureExcalidrawFile(path), "exists");
    const again = JSON.parse(await Deno.readTextFile(path));
    assertEquals(again.elements[0].id, "keep");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("ensureExcalidrawFile rejects non-excalidraw", async () => {
  let threw = false;
  try {
    await ensureExcalidrawFile("/tmp/nope.json");
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("emptyScene shape", () => {
  const s = emptyScene();
  assertEquals(Array.isArray(s.elements), true);
  assertEquals(s.elements.length, 0);
  assertEquals(typeof s.appState, "object");
  assertEquals(typeof s.files, "object");
});
