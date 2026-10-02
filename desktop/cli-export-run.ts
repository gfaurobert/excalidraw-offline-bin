/**
 * Headless PNG export via a hidden webview running exportToBlob (same as the GUI).
 * Does not register with the single-instance handoff registry.
 */
/// <reference path="./desktop-types.d.ts" />
import { join } from "./path.ts";
import type { ParsedExportCli } from "./export-cli-args.ts";
import { readScene } from "./file-format.ts";
import {
  decodePngBase64,
  pickUniqueExportFilename,
  resolveExportOutputLocation,
} from "./export-png.ts";
import {
  resolveExportJobs,
  type BoundableExportElement,
} from "./export-selectors.ts";
import type { ScenePayload } from "./types.ts";

const EXPORT_TIMEOUT_MS = 120_000;

interface CliExportJobPayload {
  jobId: string;
  selectedElementIds: Record<string, true>;
  exportingFrameId?: string;
  frameNameSanitized?: string;
  scale: number;
}

interface CliExportState {
  documentPath: string;
  scene: ScenePayload;
  jobs: CliExportJobPayload[];
  nowIso: string;
  jobCount: number;
  outOverride?: string;
  json: boolean;
  received: Map<string, { preferredFilename: string; pngBase64: string }>;
  resolve: (paths: string[]) => void;
  reject: (err: Error) => void;
}

let cliState: CliExportState | null = null;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function saveCliExportPng(
  state: CliExportState,
  jobId: string,
  preferredFilename: string,
  pngBase64: string,
): Promise<string> {
  const loc = resolveExportOutputLocation({
    documentPath: state.documentPath,
    preferredFilename,
    outOverride: state.outOverride,
    jobCount: state.jobCount,
  });
  if (!loc.ok) throw new Error(loc.error);

  const pngBytes = decodePngBase64(pngBase64);
  await Deno.mkdir(loc.directory, { recursive: true });

  const picked = await pickUniqueExportFilename(
    loc.directory,
    loc.filename,
    async (absolutePath) => {
      try {
        await Deno.stat(absolutePath);
        return true;
      } catch {
        return false;
      }
    },
  );
  await Deno.writeFile(picked.absolutePath, pngBytes);
  console.error(`[cli-export] wrote ${picked.absolutePath} (${pngBytes.length} bytes)`);
  return picked.absolutePath;
}

export async function handleCliExportApi(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  if (!cliState) return null;

  const method = req.method.toUpperCase();

  if (pathname === "/api/cli-export/session" && method === "GET") {
    return json({
      documentPath: cliState.documentPath,
      scene: cliState.scene,
      jobs: cliState.jobs,
      nowIso: cliState.nowIso,
    });
  }

  if (pathname === "/api/cli-export/png" && method === "POST") {
    const body = await req.json() as {
      jobId?: string;
      preferredFilename?: string;
      pngBase64?: string;
    };
    if (!body.jobId || !body.preferredFilename || !body.pngBase64) {
      return json({ ok: false, error: "missing png payload" }, 400);
    }
    try {
      cliState.received.set(body.jobId, {
        preferredFilename: body.preferredFilename,
        pngBase64: body.pngBase64,
      });
      return json({ ok: true });
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  if (pathname === "/api/cli-export/finish" && method === "POST") {
    try {
      const paths: string[] = [];
      for (const job of cliState.jobs) {
        const payload = cliState.received.get(job.jobId);
        if (!payload) {
          throw new Error(`Missing PNG for job ${job.jobId}`);
        }
        const path = await saveCliExportPng(
          cliState,
          job.jobId,
          payload.preferredFilename,
          payload.pngBase64,
        );
        paths.push(path);
      }
      cliState.resolve(paths);
      return json({ ok: true, paths });
    } catch (err) {
      cliState.reject(err instanceof Error ? err : new Error(String(err)));
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  if (pathname === "/api/cli-export/fail" && method === "POST") {
    const body = await req.json() as { error?: string };
    cliState.reject(new Error(body.error ?? "CLI export failed in webview"));
    return json({ ok: true });
  }

  return null;
}

export async function runCliExport(options: {
  command: ParsedExportCli;
  distDir: string;
}): Promise<number> {
  const { command, distDir } = options;
  let scene: ScenePayload;
  try {
    scene = await readScene(command.documentPath);
  } catch (err) {
    console.error(`Export failed: cannot read ${command.documentPath}: ${String(err)}`);
    return 1;
  }

  const elements = (scene.elements ?? []) as BoundableExportElement[];
  const resolved = resolveExportJobs(elements, {
    frames: command.frames,
    allFrames: command.allFrames,
    elementIds: command.elementIds,
    bbox: command.bbox,
  });
  if (!resolved.ok) {
    console.error(`Export failed: ${resolved.error}`);
    return 1;
  }

  if (command.out && command.out.toLowerCase().endsWith(".png") &&
    resolved.jobs.length !== 1) {
    console.error(
      "Export failed: --out <file.png> requires exactly one export job",
    );
    return 1;
  }

  const now = new Date();
  const jobs: CliExportJobPayload[] = resolved.jobs.map((job) => ({
    jobId: job.jobId,
    selectedElementIds: job.selectedElementIds,
    exportingFrameId: job.exportingFrameId,
    frameNameSanitized: job.frameNameSanitized,
    scale: command.scale,
  }));

  const pathsPromise = new Promise<string[]>((resolve, reject) => {
    cliState = {
      documentPath: command.documentPath,
      scene,
      jobs,
      nowIso: now.toISOString(),
      jobCount: jobs.length,
      outOverride: command.out,
      json: command.json,
      received: new Map(),
      resolve,
      reject,
    };
  });

  const timeout = setTimeout(() => {
    cliState?.reject(new Error("CLI export timed out waiting for webview"));
  }, EXPORT_TIMEOUT_MS);

  const server = Deno.serve({ hostname: "127.0.0.1", port: 0 }, async (req) => {
    const url = new URL(req.url);
    const api = await handleCliExportApi(req, url.pathname);
    if (api) return api;

    let pathname = url.pathname;
    if (pathname === "/") pathname = "/export-cli.html";
    const filePath = join(distDir, pathname.replace(/^\//, ""));
    if (!filePath.startsWith(distDir)) {
      return new Response("Forbidden", { status: 403 });
    }
    try {
      const data = await Deno.readFile(filePath);
      const ext = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
      const types: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript",
        ".css": "text/css",
      };
      return new Response(data, {
        headers: {
          "content-type": types[ext] ?? "application/octet-stream",
          "cache-control": "no-cache",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  const addr = server.addr;
  if (!("port" in addr)) {
    console.error("Export failed: could not bind HTTP server");
    return 1;
  }
  const appUrl = `http://127.0.0.1:${addr.port}/export-cli.html`;

  const win = new Deno.BrowserWindow({
    title: "Excalidraw CLI Export",
    width: 640,
    height: 480,
    noActivate: true,
  });

  let exitCode = 0;
  try {
    console.error(`[cli-export] loading ${appUrl}`);
    win.navigate(appUrl);
    const paths = await pathsPromise;
    if (command.json) {
      console.log(JSON.stringify({ paths }));
    } else {
      for (const p of paths) console.log(p);
    }
  } catch (err) {
    console.error(`Export failed: ${String(err)}`);
    exitCode = 1;
  } finally {
    clearTimeout(timeout);
    cliState = null;
    try {
      win.close();
    } catch {
      // ignore
    }
    server.shutdown();
  }

  return exitCode;
}
