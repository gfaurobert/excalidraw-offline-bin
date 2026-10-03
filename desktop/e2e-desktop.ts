/// <reference path="./desktop-types.d.ts" />

import { completeE2ePick } from "./e2e-pick.ts";

export function isE2eMode(): boolean {
  try {
    return Deno.env.get("EXCALIDRAW_E2E") === "1";
  } catch {
    return false;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readJson<T>(req: Request): Promise<T> {
  return await req.json() as T;
}

async function runInPage<T>(
  win: Deno.BrowserWindow,
  expression: string,
): Promise<T> {
  if (win.isClosed()) throw new Error("browser window closed");
  const raw = await win.executeJs(expression);
  if (raw && typeof raw === "object" && "value" in raw) {
    return (raw as { value: T }).value;
  }
  return raw as T;
}

export async function handleE2eApi(
  req: Request,
  pathname: string,
  win: Deno.BrowserWindow | null,
): Promise<Response | null> {
  if (!isE2eMode()) return null;
  if (!pathname.startsWith("/api/e2e/")) return null;
  if (!win || win.isClosed()) {
    return json({ ok: false, error: "no browser window" }, 503);
  }

  const method = req.method.toUpperCase();

  if (pathname === "/api/e2e/inspect" && method === "GET") {
    const state = await runInPage<unknown>(
      win,
      `(() => globalThis.__excalidrawOfflineE2e?.getInspect?.() ?? { ok: false, error: "no bridge" })()`,
    );
    return json({ ok: true, state });
  }

  if (pathname === "/api/e2e/shortcut" && method === "POST") {
    const body = await readJson<{
      key?: string;
      ctrlKey?: boolean;
      shiftKey?: boolean;
      altKey?: boolean;
      metaKey?: boolean;
    }>(req);
    if (!body.key?.trim()) return json({ ok: false, error: "missing key" }, 400);
    const payload = JSON.stringify(body);
    const result = await runInPage<unknown>(
      win,
      `(() => globalThis.__excalidrawOfflineE2e?.dispatchShortcut?.(${payload}) ?? { dispatched: false })()`,
    );
    return json({ ok: true, result });
  }

  if (pathname === "/api/e2e/focus-canvas" && method === "POST") {
    await runInPage(
      win,
      `(() => { globalThis.__excalidrawOfflineE2e?.focusCanvas?.(); return { ok: true }; })()`,
    );
    return json({ ok: true });
  }

  if (pathname === "/api/e2e/edit-marker" && method === "POST") {
    const body = await readJson<{ marker?: string }>(req);
    const marker = body.marker?.trim() || "E2E_EDIT_MARKER";
    const result = await runInPage<unknown>(
      win,
      `(() => globalThis.__excalidrawOfflineE2e?.addEditMarker?.(${JSON.stringify(marker)}) ?? { added: false })()`,
    );
    return json({ ok: true, result });
  }

  if (pathname === "/api/e2e/export/confirm" && method === "POST") {
    const result = await runInPage<unknown>(
      win,
      `(() => globalThis.__excalidrawOfflineE2e?.confirmImageExport?.() ?? { clicked: false })()`,
    );
    return json({ ok: true, result });
  }

  if (pathname === "/api/e2e/toggle-dark" && method === "POST") {
    const result = await runInPage<unknown>(
      win,
      `(() => globalThis.__excalidrawOfflineE2e?.toggleDarkModeViaMenu?.() ?? { theme: "unknown" })()`,
    );
    return json({ ok: true, result });
  }

  if (pathname === "/api/e2e/complete-pick" && method === "POST") {
    const body = await readJson<{ path?: string; cancelled?: boolean }>(req);
    const completed = completeE2ePick(
      body.path ?? null,
      body.cancelled === true,
    );
    return json({ ok: true, completed });
  }

  if (pathname === "/api/e2e/rclick-pan" && method === "POST") {
    const body = await readJson<{ dx?: number; dy?: number }>(req);
    const dx = body.dx ?? 120;
    const dy = body.dy ?? 70;
    const result = await runInPage<unknown>(
      win,
      `(() => globalThis.__excalidrawOfflineE2e?.simulateRightClickPan?.(${dx}, ${dy}) ?? { ok: false })()`,
    );
    return json({ ok: true, result });
  }

  if (pathname === "/api/e2e/sticky-note" && method === "POST") {
    const body = await readJson<{ text?: string }>(req);
    const text = body.text?.trim() || "E2E_STICKY_NOTE";
    const result = await runInPage<unknown>(
      win,
      `(() => globalThis.__excalidrawOfflineE2e?.placeStickyNote?.(${JSON.stringify(text)}) ?? { ok: false })()`,
    );
    return json({ ok: true, result });
  }

  return json({ ok: false, error: "unknown e2e route" }, 404);
}
