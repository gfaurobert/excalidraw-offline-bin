import { assertEquals } from "jsr:@std/assert@1";
import { join } from "./path.ts";
import {
  CLEAR_RECENT_ID,
  RECENT_MAX,
  createRecentFilesStore,
  pathFromRecentMenuId,
  recentDisplayLabels,
  recentMenuId,
} from "./recent-files.ts";

Deno.test("recentMenuId / pathFromRecentMenuId round-trip", () => {
  const path = "/home/u/sketches/demo.excalidraw";
  assertEquals(recentMenuId(path), `recent:${path}`);
  assertEquals(pathFromRecentMenuId(recentMenuId(path)), path);
  assertEquals(pathFromRecentMenuId("clear-recent"), null);
  assertEquals(pathFromRecentMenuId("open"), null);
  assertEquals(CLEAR_RECENT_ID, "clear-recent");
});

Deno.test("recentDisplayLabels uses basename; disambiguates collisions", () => {
  assertEquals(
    recentDisplayLabels(["/a/one.excalidraw", "/b/two.excalidraw"]),
    ["one.excalidraw", "two.excalidraw"],
  );
  assertEquals(
    recentDisplayLabels([
      "/projects/alpha/drawing.excalidraw",
      "/projects/beta/drawing.excalidraw",
    ]),
    ["drawing.excalidraw — alpha", "drawing.excalidraw — beta"],
  );
});

Deno.test("touch bumps, dedupes, and caps at RECENT_MAX", async () => {
  const dir = await Deno.makeTempDir();
  const filePath = join(dir, "recent.json");
  const store = createRecentFilesStore({ filePath, max: RECENT_MAX });

  assertEquals(store.list(), []);

  await store.touch("/tmp/a.excalidraw");
  await store.touch("/tmp/b.excalidraw");
  await store.touch("/tmp/a.excalidraw");
  assertEquals(store.list(), ["/tmp/a.excalidraw", "/tmp/b.excalidraw"]);

  for (let i = 0; i < 12; i++) {
    await store.touch(`/tmp/f${i}.excalidraw`);
  }
  const list = store.list();
  assertEquals(list.length, 10);
  assertEquals(list[0], "/tmp/f11.excalidraw");
  assertEquals(list.includes("/tmp/f0.excalidraw"), false);
  assertEquals(list.includes("/tmp/f1.excalidraw"), false);

  await Deno.remove(dir, { recursive: true });
});

Deno.test("remove and clear persist", async () => {
  const dir = await Deno.makeTempDir();
  const filePath = join(dir, "recent.json");
  const store = createRecentFilesStore({ filePath });

  await store.touch("/tmp/a.excalidraw");
  await store.touch("/tmp/b.excalidraw");
  await store.remove("/tmp/a.excalidraw");
  assertEquals(store.list(), ["/tmp/b.excalidraw"]);

  await store.clear();
  assertEquals(store.list(), []);

  const reloaded = createRecentFilesStore({ filePath });
  assertEquals(reloaded.list(), []);

  await Deno.remove(dir, { recursive: true });
});

Deno.test("load missing or corrupt file yields empty list", async () => {
  const dir = await Deno.makeTempDir();
  const missing = createRecentFilesStore({
    filePath: join(dir, "nope.json"),
  });
  assertEquals(missing.list(), []);

  const corruptPath = join(dir, "bad.json");
  await Deno.writeTextFile(corruptPath, "{not-json");
  const corrupt = createRecentFilesStore({ filePath: corruptPath });
  assertEquals(corrupt.list(), []);

  await storeTouchAndReload(dir);
  await Deno.remove(dir, { recursive: true });
});

async function storeTouchAndReload(dir: string): Promise<void> {
  const filePath = join(dir, "ok.json");
  const store = createRecentFilesStore({ filePath });
  await store.touch("/tmp/z.excalidraw");
  const again = createRecentFilesStore({ filePath });
  assertEquals(again.list(), ["/tmp/z.excalidraw"]);
}
