import {
  bytesToDataURL,
  dataURLToBytes,
  extensionForMime,
  readScene,
  writeScene,
} from "./file-format.ts";

function assertEquals(actual: unknown, expected: unknown, msg = ""): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`assertEquals failed${msg ? `: ${msg}` : ""}\n  actual:   ${a}\n  expected: ${e}`);
  }
}

Deno.test("extensionForMime maps common image types", () => {
  assertEquals(extensionForMime("image/png"), "png");
  assertEquals(extensionForMime("image/jpeg"), "jpg");
  assertEquals(extensionForMime("image/svg+xml"), "svg");
});

Deno.test("dataURL roundtrip", () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 255]);
  const dataURL = bytesToDataURL(bytes, "image/png");
  const back = dataURLToBytes(dataURL);
  assertEquals(Array.from(back), Array.from(bytes));
});

Deno.test("writeScene externalizes assets and readScene rehydrates", async () => {
  const root = await Deno.makeTempDir({ prefix: "excalidraw-offline-" });
  const docPath = `${root}/demo.excalidraw`;
  const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const dataURL = bytesToDataURL(pngBytes, "image/png");

  await writeScene(docPath, {
    elements: [{ id: "el1", type: "image", fileId: "file1" }],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {
      file1: {
        id: "file1",
        mimeType: "image/png",
        dataURL,
        created: 1,
      },
    },
  });

  const raw = JSON.parse(await Deno.readTextFile(docPath));
  assertEquals(raw.files.file1.path, "assets/file1.png");
  assertEquals("dataURL" in raw.files.file1, false);

  const asset = await Deno.readFile(`${root}/assets/file1.png`);
  assertEquals(Array.from(asset), Array.from(pngBytes));

  const loaded = await readScene(docPath);
  assertEquals(loaded.files.file1.dataURL, dataURL);
  assertEquals((loaded.elements[0] as { id: string }).id, "el1");

  await Deno.remove(root, { recursive: true });
});
