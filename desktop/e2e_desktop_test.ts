import { handleE2eApi } from "./e2e-desktop.ts";

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

Deno.test("handleE2eApi returns 404 for /api/e2e/* when EXCALIDRAW_E2E is unset", async () => {
  const prev = Deno.env.get("EXCALIDRAW_E2E");
  try {
    Deno.env.delete("EXCALIDRAW_E2E");
    const req = new Request("http://127.0.0.1/api/e2e/inspect", { method: "GET" });
    const res = await handleE2eApi(req, "/api/e2e/inspect", null);
    assert(res !== null, "expected a Response");
    assert(res!.status === 404, `expected 404, got ${res!.status}`);
    const body = await res!.json() as { error?: string };
    assert(body.error === "not found", `unexpected body: ${JSON.stringify(body)}`);
  } finally {
    if (prev !== undefined) Deno.env.set("EXCALIDRAW_E2E", prev);
    else Deno.env.delete("EXCALIDRAW_E2E");
  }
});
