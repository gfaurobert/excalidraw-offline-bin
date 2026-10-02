import { parseExportCliCommand, stripLeadingDesktopArgv } from "./export-cli-args.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

Deno.test("stripLeadingDesktopArgv skips flags and main.ts", () => {
  assertEquals(
    stripLeadingDesktopArgv(["-A", "./desktop/main.ts", "export", "a.excalidraw"]),
    ["export", "a.excalidraw"],
  );
});

Deno.test("parseExportCliCommand whole scene defaults", () => {
  const parsed = parseExportCliCommand(
    ["export", "sketches/demo.excalidraw"],
    "/work",
  );
  assertEquals(parsed.kind, "export");
  if (parsed.kind !== "export") return;
  assertEquals(parsed.command.documentPath, "/work/sketches/demo.excalidraw");
  assertEquals(parsed.command.scale, 2);
  assertEquals(parsed.command.json, false);
  assertEquals(parsed.command.allFrames, false);
});

Deno.test("parseExportCliCommand flags", () => {
  const parsed = parseExportCliCommand([
    "export",
    "/tmp/x.excalidraw",
    "--frame",
    "Login",
    "--element",
    "abc123",
    "--scale",
    "3",
    "--json",
    "--out",
    "/tmp/out",
  ], "/work");
  assertEquals(parsed.kind, "export");
  if (parsed.kind !== "export") return;
  assertEquals(parsed.command.frames, ["Login"]);
  assertEquals(parsed.command.elementIds, ["abc123"]);
  assertEquals(parsed.command.scale, 3);
  assertEquals(parsed.command.json, true);
  assertEquals(parsed.command.out, "/tmp/out");
});

Deno.test("parseExportCliCommand errors on missing file", () => {
  assertEquals(parseExportCliCommand(["export"], "/work").kind, "error");
});
