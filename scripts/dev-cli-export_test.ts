import {
  devExportLauncherArgs,
  normalizeDevExportUserArgs,
} from "./dev-cli-export.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

Deno.test("normalizeDevExportUserArgs drops forwarded --", () => {
  assertEquals(
    normalizeDevExportUserArgs(["--", "/tmp/a.excalidraw", "--json"]),
    ["/tmp/a.excalidraw", "--json"],
  );
});

Deno.test("devExportLauncherArgs prefixes export subcommand", () => {
  assertEquals(
    devExportLauncherArgs(["sketches/demo.excalidraw", "--json"]),
    ["export", "sketches/demo.excalidraw", "--json"],
  );
});
