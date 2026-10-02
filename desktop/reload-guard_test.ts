import { assertEquals } from "jsr:@std/assert";
import {
  planReload,
  reloadActionAfterUnsavedChoice,
} from "./reload-guard.ts";

Deno.test("planReload: start screen is noop", () => {
  assertEquals(
    planReload({ mode: "start", path: "/a.excalidraw", dirty: false }),
    { kind: "noop" },
  );
});

Deno.test("planReload: untitled canvas is noop", () => {
  assertEquals(
    planReload({ mode: "canvas", path: null, dirty: true }),
    { kind: "noop" },
  );
});

Deno.test("planReload: clean saved drawing reloads", () => {
  assertEquals(
    planReload({ mode: "canvas", path: "/a.excalidraw", dirty: false }),
    { kind: "reload" },
  );
});

Deno.test("planReload: dirty saved drawing prompts", () => {
  assertEquals(
    planReload({ mode: "canvas", path: "/a.excalidraw", dirty: true }),
    { kind: "prompt_unsaved" },
  );
});

Deno.test("reloadActionAfterUnsavedChoice maps choices", () => {
  assertEquals(reloadActionAfterUnsavedChoice("cancel"), { kind: "abort" });
  assertEquals(reloadActionAfterUnsavedChoice("save"), {
    kind: "save_then_reload",
  });
  assertEquals(reloadActionAfterUnsavedChoice("discard"), { kind: "reload" });
});
