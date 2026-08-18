import { basename, dirname, fromFileUrl, isAbsolutePath, join } from "./path.ts";

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

Deno.test("isAbsolutePath posix and windows", () => {
  assertEquals(isAbsolutePath("/tmp/a.excalidraw"), true);
  assertEquals(isAbsolutePath("sketches/a.excalidraw"), false);
  assertEquals(isAbsolutePath("C:/Users/u/a.excalidraw"), true);
  assertEquals(isAbsolutePath("C:\\Users\\u\\a.excalidraw"), true);
  assertEquals(isAbsolutePath("//server/share/a.excalidraw"), true);
  assertEquals(isAbsolutePath("\\\\server\\share\\a.excalidraw"), true);
});

Deno.test("join and dirname windows drive and unc", () => {
  assertEquals(
    join("C:/Users/u", "docs", "a.excalidraw"),
    "C:/Users/u/docs/a.excalidraw",
  );
  assertEquals(
    join("C:\\Users\\u", "docs"),
    "C:/Users/u/docs",
  );
  assertEquals(dirname("C:/Users/u/a.excalidraw"), "C:/Users/u");
  assertEquals(dirname("C:/foo.excalidraw"), "C:/");
  assertEquals(basename("C:/Users/u/a.excalidraw"), "a.excalidraw");
  assertEquals(
    join("//server/share", "docs", "a.excalidraw"),
    "//server/share/docs/a.excalidraw",
  );
});

Deno.test("fromFileUrl windows drive", () => {
  assertEquals(
    fromFileUrl("file:///C:/Users/u/demo.ts"),
    "C:/Users/u/demo.ts",
  );
});
