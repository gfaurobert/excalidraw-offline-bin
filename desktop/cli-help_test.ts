import {
  printExportHelp,
  printTopLevelHelp,
  wantsExportHelp,
  wantsTopLevelHelp,
} from "./cli-help.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

Deno.test("wantsTopLevelHelp without export subcommand", () => {
  assertEquals(wantsTopLevelHelp(["--help"]), true);
  assertEquals(wantsTopLevelHelp(["-h"]), true);
  assertEquals(wantsTopLevelHelp(["sketches/a.excalidraw", "--help"]), true);
  assertEquals(wantsTopLevelHelp(["export", "a.excalidraw", "--help"]), false);
});

Deno.test("wantsExportHelp after export subcommand", () => {
  assertEquals(wantsExportHelp(["export", "--help"]), true);
  assertEquals(wantsExportHelp(["export", "-h"]), true);
  assertEquals(
    wantsExportHelp(["export", "missing.excalidraw", "--help"]),
    true,
  );
  assertEquals(wantsExportHelp(["--help"]), false);
});

Deno.test("help printers write to stdout", () => {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    printTopLevelHelp();
    printExportHelp();
  } finally {
    console.log = orig;
  }
  assertEquals(lines.some((l) => l.includes("export --help")), true);
  assertEquals(lines.some((l) => l.includes("--all-frames")), true);
});
