import { assertEquals } from "jsr:@std/assert@1";
import { join } from "./path.ts";
import {
  readAppVersion,
  readExcalidrawVersion,
  readJsonVersion,
} from "./versions.ts";

Deno.test("readJsonVersion returns version field", async () => {
  const dir = await Deno.makeTempDir();
  const file = join(dir, "pkg.json");
  await Deno.writeTextFile(file, JSON.stringify({ name: "x", version: "1.2.3" }));
  assertEquals(await readJsonVersion(file), "1.2.3");
  await Deno.remove(dir, { recursive: true });
});

Deno.test("readJsonVersion returns unknown when missing or corrupt", async () => {
  const dir = await Deno.makeTempDir();
  const missing = join(dir, "nope.json");
  assertEquals(await readJsonVersion(missing), "unknown");

  const bad = join(dir, "bad.json");
  await Deno.writeTextFile(bad, "{not json");
  assertEquals(await readJsonVersion(bad), "unknown");

  const noVer = join(dir, "nover.json");
  await Deno.writeTextFile(noVer, JSON.stringify({ name: "x" }));
  assertEquals(await readJsonVersion(noVer), "unknown");

  await Deno.remove(dir, { recursive: true });
});

Deno.test("readAppVersion / readExcalidrawVersion delegate", async () => {
  const dir = await Deno.makeTempDir();
  const denoJson = join(dir, "deno.json");
  const pkg = join(dir, "package.json");
  await Deno.writeTextFile(denoJson, JSON.stringify({ version: "0.1.0" }));
  await Deno.writeTextFile(pkg, JSON.stringify({ version: "0.18.1" }));
  assertEquals(await readAppVersion(denoJson), "0.1.0");
  assertEquals(await readExcalidrawVersion(pkg), "0.18.1");
  await Deno.remove(dir, { recursive: true });
});
