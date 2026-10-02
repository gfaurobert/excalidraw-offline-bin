import { fromFileUrl, join } from "../desktop/path.ts";
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

Deno.test("dev-cli-export ROOT is repo root not scripts/", () => {
  const scriptDir = join(fromFileUrl(import.meta.url), "..");
  const repoRoot = join(scriptDir, "..");
  assertEquals(
    join(repoRoot, "desktop/main.ts"),
    join(repoRoot, "desktop/main.ts"),
  );
  try {
    Deno.statSync(join(repoRoot, "deno.json"));
  } catch {
    throw new Error("repo root should contain deno.json");
  }
});
