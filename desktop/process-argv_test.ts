import {
  findExportSubcommandIndex,
  isRuntimeArgvNoise,
  preferredExcalidrawDocumentArg,
  stripLeadingDesktopArgv,
} from "./process-argv.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

Deno.test("isRuntimeArgvNoise", () => {
  assertEquals(isRuntimeArgvNoise("/opt/excalidraw-offline.so"), true);
  assertEquals(isRuntimeArgvNoise("./dist/linux/excalidraw-offline/excalidraw-offline"), true);
  assertEquals(isRuntimeArgvNoise("export"), false);
  assertEquals(isRuntimeArgvNoise("/tmp/a.excalidraw"), false);
});

Deno.test("findExportSubcommandIndex with leading drawing path", () => {
  const path = "/home/u/sketches/wireframes.excalidraw";
  assertEquals(findExportSubcommandIndex(["export", path]), 0);
  assertEquals(findExportSubcommandIndex([path, "export", path]), 1);
});

Deno.test("preferredExcalidrawDocumentArg duplicate and basename", () => {
  const full = "/home/u/sketches/wireframes.excalidraw";
  assertEquals(
    preferredExcalidrawDocumentArg([full, full], "/work"),
    full,
  );
  assertEquals(
    preferredExcalidrawDocumentArg(["wireframes.excalidraw", full], "/work"),
    full,
  );
});
