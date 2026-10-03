import {
  buildExportPngFilename,
  drawingBaseNameFromPath,
  drawingDirectoryForDocument,
  formatExportTimestamp,
  pickUniqueExportFilename,
  resolveExportOutputLocation,
  resolveExportPngTarget,
  sanitizeFrameNameForFilename,
  withExportCollisionSuffix,
} from "./export-png.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

Deno.test("formatExportTimestamp is local sortable without colons", () => {
  const d = new Date(2026, 9, 2, 17, 5, 12);
  assertEquals(formatExportTimestamp(d), "20261002-170512");
});

Deno.test("sanitizeFrameNameForFilename strips illegal and trailing dots", () => {
  assertEquals(sanitizeFrameNameForFilename('  UI "mock" / v2.  '), "UI _mock_ _ v2");
  assertEquals(sanitizeFrameNameForFilename("con"), "con");
  assertEquals(sanitizeFrameNameForFilename("   "), "");
});

Deno.test("drawingBaseNameFromPath drops .excalidraw", () => {
  assertEquals(
    drawingBaseNameFromPath("/proj/sketches/my diagram.excalidraw"),
    "my diagram",
  );
});

Deno.test("drawingDirectoryForDocument is parent of file", () => {
  assertEquals(
    drawingDirectoryForDocument("/proj/sketches/demo.excalidraw"),
    "/proj/sketches",
  );
});

Deno.test("buildExportPngFilename with optional frame segment", () => {
  assertEquals(
    buildExportPngFilename({
      drawingBase: "demo",
      timestamp: "20261002-170512",
    }),
    "demo_20261002-170512.png",
  );
  assertEquals(
    buildExportPngFilename({
      drawingBase: "demo",
      timestamp: "20261002-170512",
      frameNameSanitized: "Login_flow",
    }),
    "demo_Login_flow_20261002-170512.png",
  );
});

Deno.test("withExportCollisionSuffix", () => {
  assertEquals(
    withExportCollisionSuffix("a_20261002-170512.png", 0),
    "a_20261002-170512.png",
  );
  assertEquals(
    withExportCollisionSuffix("a_20261002-170512.png", 1),
    "a_20261002-170512-2.png",
  );
});

Deno.test("resolveExportPngTarget rules", () => {
  const elements = [
    { id: "f1", type: "frame", name: "Dashboard" },
    { id: "f2", type: "frame", name: "Other" },
    { id: "r1", type: "rectangle" },
  ];
  assertEquals(resolveExportPngTarget(elements, {}), { kind: "whole_scene" });
  assertEquals(
    resolveExportPngTarget(elements, { f1: true }),
    { kind: "named_frame", frameNameSanitized: "Dashboard" },
  );
  assertEquals(
    resolveExportPngTarget(elements, { f1: true, r1: true }),
    { kind: "selection" },
  );
  assertEquals(
    resolveExportPngTarget(elements, { f1: true, f2: true }),
    { kind: "selection" },
  );
  assertEquals(
    resolveExportPngTarget(
      [{ id: "f3", type: "frame", name: "  " }],
      { f3: true },
    ),
    { kind: "selection" },
  );
});

Deno.test("resolveExportOutputLocation uses drawing folder by default", () => {
  assertEquals(
    resolveExportOutputLocation({
      documentPath: "/proj/a.excalidraw",
      preferredFilename: "a_20261002-170512.png",
      jobCount: 1,
    }),
    { ok: true, directory: "/proj", filename: "a_20261002-170512.png" },
  );
  assertEquals(
    resolveExportOutputLocation({
      documentPath: "/proj/a.excalidraw",
      preferredFilename: "a_20261002-170512.png",
      outOverride: "/tmp/out",
      jobCount: 2,
    }),
    { ok: true, directory: "/tmp/out", filename: "a_20261002-170512.png" },
  );
});

Deno.test("pickUniqueExportFilename skips existing files", async () => {
  const taken = new Set([
    "/proj/sketches/x_20261002-170512.png",
    "/proj/sketches/x_20261002-170512-2.png",
  ]);
  const picked = await pickUniqueExportFilename(
    "/proj/sketches",
    "x_20261002-170512.png",
    async (p) => taken.has(p),
  );
  assertEquals(picked.filename, "x_20261002-170512-3.png");
  assertEquals(picked.absolutePath, "/proj/sketches/x_20261002-170512-3.png");
});
