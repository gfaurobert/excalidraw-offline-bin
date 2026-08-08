import {
  openPathFromArgs,
  parseOpenPathArg,
  resolveOpenPath,
} from "./cli-args.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

Deno.test("parseOpenPathArg skips flags", () => {
  assertEquals(parseOpenPathArg(["-A", "--backend=webview", "/tmp/a.excalidraw"]), "/tmp/a.excalidraw");
  assertEquals(parseOpenPathArg(["--", "-weird.excalidraw"]), "-weird.excalidraw");
  assertEquals(parseOpenPathArg(["-v"]), null);
  assertEquals(parseOpenPathArg([]), null);
});

Deno.test("parseOpenPathArg skips script and non-excalidraw", () => {
  assertEquals(
    parseOpenPathArg(["./desktop/main.ts", "sketches/a.excalidraw"]),
    "sketches/a.excalidraw",
  );
  assertEquals(parseOpenPathArg(["./desktop/main.ts"]), null);
  assertEquals(parseOpenPathArg(["readme.md"]), null);
});

Deno.test("parseOpenPathArg takes first non-flag", () => {
  assertEquals(
    parseOpenPathArg(["sketches/a.excalidraw", "sketches/b.excalidraw"]),
    "sketches/a.excalidraw",
  );
});

Deno.test("resolveOpenPath absolute and relative", () => {
  assertEquals(resolveOpenPath("/tmp/a.excalidraw", "/home/u"), "/tmp/a.excalidraw");
  assertEquals(
    resolveOpenPath("sketches/a.excalidraw", "/home/u/proj"),
    "/home/u/proj/sketches/a.excalidraw",
  );
  assertEquals(
    resolveOpenPath("./sketches/a.excalidraw", "/home/u/proj"),
    "/home/u/proj/sketches/a.excalidraw",
  );
});

Deno.test("openPathFromArgs combines parse and resolve", () => {
  assertEquals(
    openPathFromArgs(["-A", "foo.excalidraw"], "/work"),
    "/work/foo.excalidraw",
  );
  assertEquals(openPathFromArgs(["-A"], "/work"), null);
});
