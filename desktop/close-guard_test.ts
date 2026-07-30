import { assertEquals } from "jsr:@std/assert@1";
import { createCloseGuard } from "./close-guard.ts";

Deno.test("close guard defers until grantClose", () => {
  const guard = createCloseGuard();
  assertEquals(guard.shouldDeferClose(), true);
  guard.grantClose();
  assertEquals(guard.shouldDeferClose(), false);
});

Deno.test("close guard stays allowed after grantClose", () => {
  const guard = createCloseGuard();
  guard.grantClose();
  assertEquals(guard.shouldDeferClose(), false);
  assertEquals(guard.shouldDeferClose(), false);
});
