import {
  extensionFromExportFilename,
  suggestedImageExportPath,
} from "./export-image-save.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

Deno.test("extensionFromExportFilename", () => {
  assertEquals(extensionFromExportFilename("a.png"), "png");
  assertEquals(extensionFromExportFilename("a.excalidraw.png"), "excalidraw.png");
  assertEquals(extensionFromExportFilename("a.svg"), "svg");
});

Deno.test("suggestedImageExportPath uses export/ beside drawing", () => {
  assertEquals(
    suggestedImageExportPath({
      documentPath: "/proj/sketch.excalidraw",
      homeDir: "/home/u",
      filename: "sketch-2026.png",
    }),
    "/proj/export/sketch-2026.png",
  );
  assertEquals(
    suggestedImageExportPath({
      documentPath: null,
      homeDir: "/home/u",
      filename: "untitled.png",
    }),
    "/home/u/export/untitled.png",
  );
});
