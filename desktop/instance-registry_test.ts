import {
  createInstanceRegistry,
  deriveInstanceState,
  instanceFilePath,
  pickHandoffTarget,
  type InstanceRecord,
} from "./instance-registry.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

Deno.test("deriveInstanceState", () => {
  assertEquals(deriveInstanceState("start", null), "start");
  assertEquals(deriveInstanceState("start", "/a.excalidraw"), "start");
  assertEquals(deriveInstanceState("canvas", null), "untitled");
  assertEquals(deriveInstanceState("canvas", "/a.excalidraw"), "pathed");
});

Deno.test("pickHandoffTarget prefers recent start/pathed, skips untitled", () => {
  const records: InstanceRecord[] = [
    {
      pid: 1,
      port: 1001,
      state: "untitled",
      path: null,
      lastFocusedAt: 300,
    },
    {
      pid: 2,
      port: 1002,
      state: "pathed",
      path: "/a.excalidraw",
      lastFocusedAt: 100,
    },
    {
      pid: 3,
      port: 1003,
      state: "start",
      path: null,
      lastFocusedAt: 200,
    },
  ];
  const picked = pickHandoffTarget(records);
  assertEquals(picked?.pid, 3);
  assertEquals(pickHandoffTarget(records, 3)?.pid, 2);
  assertEquals(pickHandoffTarget(records.filter((r) => r.state === "untitled")), null);
});

Deno.test("registry write list remove with stale filter", async () => {
  const dir = await Deno.makeTempDir({ prefix: "exo-registry-" });
  try {
    const alive = new Set([10, 20]);
    const reg = createInstanceRegistry({
      dir,
      isAlive: (pid) => alive.has(pid),
    });
    await reg.write({
      pid: 10,
      port: 4000,
      state: "start",
      path: null,
      lastFocusedAt: 1,
    });
    await reg.write({
      pid: 20,
      port: 4001,
      state: "pathed",
      path: "/x.excalidraw",
      lastFocusedAt: 5,
    });
    await reg.write({
      pid: 99,
      port: 4002,
      state: "start",
      path: null,
      lastFocusedAt: 9,
    });
    const listed = reg.list();
    assertEquals(listed.map((r) => r.pid).sort(), [10, 20]);
    assertEquals(reg.pickHandoffTarget()?.pid, 20);
    await reg.remove(20);
    assertEquals(reg.list().map((r) => r.pid), [10]);
    try {
      Deno.statSync(instanceFilePath(dir, 20));
      throw new Error("expected removed");
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    }
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
