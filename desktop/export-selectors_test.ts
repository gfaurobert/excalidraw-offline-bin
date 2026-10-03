import {
  elementIdsInBBox,
  findFramesByName,
  resolveExportJobs,
} from "./export-selectors.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

const elements = [
  { id: "f1", type: "frame", name: "Login", x: 0, y: 0, width: 100, height: 100 },
  { id: "r1", type: "rectangle", x: 10, y: 10, width: 20, height: 20 },
  { id: "r2", type: "rectangle", x: 200, y: 200, width: 30, height: 30 },
];

Deno.test("findFramesByName exact trimmed match", () => {
  assertEquals(findFramesByName(elements, "Login").map((e) => e.id), ["f1"]);
  assertEquals(findFramesByName(elements, "Missing").length, 0);
});

Deno.test("resolveExportJobs default whole scene", () => {
  const r = resolveExportJobs(elements, {});
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.jobs.length, 1);
  assertEquals(r.jobs[0]!.jobId, "whole-scene");
});

Deno.test("resolveExportJobs frame not found", () => {
  const r = resolveExportJobs(elements, { frames: ["Nope"] });
  assertEquals(r, { ok: false, error: "Frame not found: Nope" });
});

Deno.test("resolveExportJobs rejects mixed selectors", () => {
  const r = resolveExportJobs(elements, {
    frames: ["Login"],
    elementIds: ["r1"],
  });
  assertEquals(r.ok, false);
});

Deno.test("elementIdsInBBox", () => {
  assertEquals(
    elementIdsInBBox(elements, { x: 0, y: 0, w: 50, h: 50 }).sort(),
    ["f1", "r1"],
  );
});
