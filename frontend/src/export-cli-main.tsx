import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import { renderSceneExportPng } from "./export-scene-png.ts";

interface CliExportJob {
  jobId: string;
  selectedElementIds: Record<string, true>;
  exportingFrameId?: string;
  frameNameSanitized?: string;
  scale: number;
}

interface CliExportSession {
  documentPath: string;
  scene: {
    elements: ExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  };
  jobs: CliExportJob[];
  nowIso: string;
}

async function runCliExport(): Promise<void> {
  const sessionRes = await fetch("/api/cli-export/session");
  if (!sessionRes.ok) {
    const err = await sessionRes.text();
    throw new Error(err || `session HTTP ${sessionRes.status}`);
  }
  const session = await sessionRes.json() as CliExportSession;
  const now = new Date(session.nowIso);

  for (const job of session.jobs) {
    const rendered = await renderSceneExportPng({
      scene: session.scene,
      documentPath: session.documentPath,
      selectedElementIds: job.selectedElementIds,
      exportingFrameId: job.exportingFrameId,
      frameNameSanitized: job.frameNameSanitized,
      scale: job.scale,
      now,
    });
    const post = await fetch("/api/cli-export/png", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId: job.jobId,
        preferredFilename: rendered.preferredFilename,
        pngBase64: rendered.pngBase64,
      }),
    });
    if (!post.ok) {
      const err = await post.text();
      throw new Error(err || `png POST HTTP ${post.status}`);
    }
  }

  const finish = await fetch("/api/cli-export/finish", { method: "POST" });
  if (!finish.ok) {
    const err = await finish.text();
    throw new Error(err || `finish HTTP ${finish.status}`);
  }
}

runCliExport().catch(async (err) => {
  console.error("[cli-export]", err);
  try {
    await fetch("/api/cli-export/fail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: String(err) }),
    });
  } catch {
    // ignore
  }
});
