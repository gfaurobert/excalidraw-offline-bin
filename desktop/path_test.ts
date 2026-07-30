import { basename, dirname, fromFileUrl, join } from "./path.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

Deno.test("join and dirname", () => {
  assertEquals(join("/home/user", "docs", "a.excalidraw"), "/home/user/docs/a.excalidraw");
  assertEquals(dirname("/home/user/docs/a.excalidraw"), "/home/user/docs");
  assertEquals(basename("/home/user/docs/a.excalidraw"), "a.excalidraw");
});

Deno.test("fromFileUrl", () => {
  assertEquals(fromFileUrl("file:///tmp/demo.ts"), "/tmp/demo.ts");
});
