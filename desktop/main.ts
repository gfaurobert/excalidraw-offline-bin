/**
 * Deno Desktop entry: filesystem + File menu command queue.
 *
 * UI talks over local HTTP (bindings hang). Native zenity/kdialog run only
 * from the Deno menu handler; the UI then writes via POST /api/write.
 */
/// <reference path="./desktop-types.d.ts" />
import { join, fromFileUrl } from "./path.ts";
import {
  choiceDialog,
  confirmDialog,
  describeDialogBackend,
  infoDialog,
  openDirectoryDialog,
  openExcalidrawDialog,
  openImageDialog,
  saveExcalidrawDialog,
} from "./dialogs.ts";
import {
  bytesToDataURL,
  mimeFromExtension,
  readScene,
  writeScene,
} from "./file-format.ts";
import type { ScenePayload } from "./types.ts";
import { createCloseGuard } from "./close-guard.ts";
import {
  CLEAR_RECENT_ID,
  createRecentFilesStore,
  defaultRecentFilePath,
  pathFromRecentMenuId,
  recentDisplayLabels,
  recentMenuId,
} from "./recent-files.ts";
import {
  getAppRepoUrl,
  getAppVersion,
  getExcalidrawRepoUrl,
  getExcalidrawVersion,
} from "./versions.ts";
import {
  installSkillTo,
  pathExists,
  resolveInstallTarget,
  SKILL_ID,
  type InstallMode,
} from "./install-skill.ts";

const ROOT = join(fromFileUrl(import.meta.url), "..", "..");
const DIST = join(ROOT, "frontend", "dist");
const BUNDLED_SKILL = join(ROOT, "skills", SKILL_ID);

const INSTALL_SKILL_OPTIONS = [
  { id: "global", label: "Global (user) — ~/.agents/skills" },
  { id: "project", label: "Project — <folder>/.agents/skills" },
  { id: "custom", label: "Custom — pick any folder" },
];

function readDevUrl(): string | undefined {
  try {
    return Deno.env.get("EXCALIDRAW_DEV_URL") ?? undefined;
  } catch {
    return undefined;
  }
}

function homeDir(): string {
  try {
    return Deno.env.get("HOME") ?? ".";
  } catch {
    return ".";
  }
}

const DEV_URL = readDevUrl();

let currentPath: string | null = null;
let win: Deno.BrowserWindow;
const closeGuard = createCloseGuard();
const recentStore = createRecentFilesStore({
  filePath: defaultRecentFilePath(),
});
let dialogBackend = "detecting";
let appVersion = "unknown";
let excalidrawVersion = "unknown";

type UiCommand =
  | { type: "status"; message: string }
  | { type: "new" }
  | { type: "open"; path?: string }
  | { type: "save"; forcePicker: boolean; path?: string }
  | { type: "quit" };

const uiQueue: UiCommand[] = [];
let quitPending = false;

function enqueueQuit(): void {
  if (quitPending) return;
  if (uiQueue.some((cmd) => cmd.type === "quit")) return;
  quitPending = true;
  enqueueUi({ type: "quit" });
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function contentType(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function enqueueUi(cmd: UiCommand): void {
  uiQueue.push(cmd);
  console.log(
    "[uiQueue] enqueue",
    cmd.type,
    "path" in cmd && cmd.path ? cmd.path : "",
    "forcePicker" in cmd ? cmd.forcePicker : "",
    "len",
    uiQueue.length,
  );
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function readJson<T>(req: Request): Promise<T> {
  return await req.json() as T;
}

function shouldLogHttp(method: string, pathname: string): boolean {
  if (pathname === "/api/poll" && method === "GET") return false;
  if (pathname === "/api/set-title" && method === "POST") return false;
  return true;
}

async function handleApi(req: Request, pathname: string): Promise<Response> {
  const method = req.method.toUpperCase();
  if (shouldLogHttp(method, pathname)) {
    console.log("[http]", method, pathname);
  }

  if (pathname === "/api/health" && method === "GET") {
    return json({ ok: true, path: currentPath, queue: uiQueue.length });
  }

  if (pathname === "/api/log" && method === "POST") {
    const body = await readJson<{ level?: string; message?: string }>(req);
    const level = body.level === "error" ? "error" : "info";
    const line = `[ui/${level}] ${body.message ?? ""}`;
    if (level === "error") console.error(line);
    else console.log(line);
    return json({ ok: true });
  }

  if (pathname === "/api/poll" && method === "GET") {
    const cmd = uiQueue.shift() ?? null;
    if (cmd) {
      console.log(
        "[poll] dequeue",
        cmd.type,
        "path" in cmd && cmd.path ? cmd.path : "",
        "forcePicker" in cmd ? cmd.forcePicker : "",
        "remaining",
        uiQueue.length,
      );
    }
    return json({ cmd });
  }

  if (pathname === "/api/info" && method === "GET") {
    return json({
      dialogBackend,
      bindings: false,
      path: currentPath,
      home: homeDir(),
    });
  }

  if (pathname === "/api/write" && method === "POST") {
    const body = await readJson<{ path?: string; scene?: unknown }>(req);
    const path = body.path?.trim();
    if (!path) return json({ ok: false, error: "missing path" }, 400);

    let payload: ScenePayload;
    try {
      if (typeof body.scene === "string") {
        payload = JSON.parse(body.scene) as ScenePayload;
      } else if (body.scene && typeof body.scene === "object") {
        payload = body.scene as ScenePayload;
      } else {
        return json({ ok: false, error: "missing scene" }, 400);
      }
    } catch (err) {
      console.error("[write] parse error", err);
      return json({ ok: false, error: `invalid scene JSON: ${String(err)}` }, 400);
    }

    const size = typeof body.scene === "string"
      ? body.scene.length
      : JSON.stringify(body.scene).length;
    console.log("[write] start", path, size, "bytes");
    try {
      await writeScene(path, payload);
      currentPath = path;
      win.setTitle(`Excalidraw Offline — ${path}`);
      console.log("[write] done", path);
      try {
        await recentStore.touch(path);
        applyMenu(recentStore.list());
      } catch (err) {
        console.error("[recent] touch failed", err);
      }
      return json({ ok: true, path });
    } catch (err) {
      console.error("[write] error", err);
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  if (pathname === "/api/read" && method === "POST") {
    const body = await readJson<{ path?: string }>(req);
    const path = body.path?.trim();
    if (!path) return json({ ok: false, error: "missing path" }, 400);
    console.log("[read] start", path);
    try {
      const scene = await readScene(path);
      currentPath = path;
      win.setTitle(`Excalidraw Offline — ${path}`);
      console.log(
        "[read] done",
        path,
        "elements",
        scene.elements?.length ?? 0,
      );
      try {
        await recentStore.touch(path);
        applyMenu(recentStore.list());
      } catch (err) {
        console.error("[recent] touch failed", err);
      }
      return json({ ok: true, path, ...scene });
    } catch (err) {
      console.error("[read] error", err);
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  if (pathname === "/api/set-title" && method === "POST") {
    const body = await readJson<{ title?: string }>(req);
    if (body.title) win.setTitle(body.title);
    return json({ ok: true });
  }

  if (pathname === "/api/set-path" && method === "POST") {
    const body = await readJson<{ path?: string | null }>(req);
    currentPath = body.path ?? null;
    win.setTitle(
      currentPath
        ? `Excalidraw Offline — ${currentPath}`
        : "Excalidraw Offline — Untitled",
    );
    return json({ ok: true });
  }

  if (pathname === "/api/pick-image" && method === "POST") {
    console.log("[pick-image]");
    const picked = await openImageDialog();
    if (!picked.ok) {
      if (picked.reason === "cancelled") return json({ ok: true, file: null });
      if (picked.reason === "unavailable") {
        return json({ ok: false, error: "no file picker available" }, 501);
      }
      return json({ ok: false, error: picked.detail ?? picked.reason }, 500);
    }
    const bytes = await Deno.readFile(picked.path);
    const name = picked.path.split("/").pop() ?? "image";
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    const mimeType = mimeFromExtension(ext);
    return json({
      ok: true,
      file: {
        name,
        mimeType,
        dataURL: bytesToDataURL(bytes, mimeType),
      },
    });
  }

  if (pathname === "/api/quit-aborted" && method === "POST") {
    quitPending = false;
    console.log("[quit] aborted — pending cleared");
    return json({ ok: true });
  }

  if (pathname === "/api/quit" && method === "POST") {
    quitPending = false;
    console.log("[quit] allow close + exit");
    closeGuard.grantClose();
    try {
      win.close();
    } catch (err) {
      console.error("[quit] win.close error", err);
    }
    // Deno.serve keeps the process alive without an explicit exit.
    Deno.exit(0);
  }

  return json({ ok: false, error: "not found" }, 404);
}

async function serveStatic(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    try {
      return await handleApi(req, pathname);
    } catch (err) {
      console.error("[http] api error", pathname, err);
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/index.html" || pathname.endsWith(".html")) {
    console.log("[http] static", pathname);
  }

  const filePath = join(DIST, pathname);
  if (!filePath.startsWith(DIST)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const data = await Deno.readFile(filePath);
    return new Response(data, {
      headers: {
        "content-type": contentType(filePath),
        "cache-control": "no-cache",
      },
    });
  } catch {
    if (!pathname.includes(".")) {
      const index = await Deno.readFile(join(DIST, "index.html"));
      return new Response(index, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  }
}

const server = Deno.serve({ hostname: "127.0.0.1", port: 0 }, (req) =>
  serveStatic(req)
);

const addr = server.addr;
if (!("port" in addr)) {
  throw new Error("expected TCP addr from Deno.serve");
}
const appUrl = `http://127.0.0.1:${addr.port}/`;
console.log("[desktop] app url", appUrl);
console.log("[desktop] dist", DIST);

win = new Deno.BrowserWindow({
  title: "Excalidraw Offline",
  width: 1280,
  height: 800,
});

function applyMenu(recentPaths: string[]): void {
  const labels = recentDisplayLabels(recentPaths);
  const recentItems: Deno.MenuItem[] = recentPaths.length === 0
    ? [{
      item: {
        label: "(No recent files)",
        id: "recent-empty",
        enabled: false,
      },
    }]
    : recentPaths.map((path, i) => ({
      item: {
        label: labels[i]!,
        id: recentMenuId(path),
        enabled: true,
      },
    }));

  recentItems.push("separator");
  recentItems.push({
    item: {
      label: "Clear Recent",
      id: CLEAR_RECENT_ID,
      enabled: recentPaths.length > 0,
    },
  });

  win.setApplicationMenu([
    {
      submenu: {
        label: "File",
        items: [
          {
            item: {
              label: "New",
              id: "new",
              accelerator: "CmdOrCtrl+N",
              enabled: true,
            },
          },
          {
            item: {
              label: "Open…",
              id: "open",
              accelerator: "CmdOrCtrl+O",
              enabled: true,
            },
          },
          {
            submenu: {
              label: "Open Recent",
              items: recentItems,
            },
          },
          "separator",
          {
            item: {
              label: "Save",
              id: "save",
              accelerator: "CmdOrCtrl+S",
              enabled: true,
            },
          },
          {
            item: {
              label: "Save As…",
              id: "save-as",
              accelerator: "CmdOrCtrl+Shift+S",
              enabled: true,
            },
          },
          "separator",
          {
            item: {
              label: "Quit",
              id: "quit",
              accelerator: "CmdOrCtrl+Q",
              enabled: true,
            },
          },
        ],
      },
    },
    {
      submenu: {
        label: "Skills",
        items: [
          {
            item: {
              label: "Install excalidraw-sketching skill",
              id: "skills-install-sketching",
              enabled: true,
            },
          },
        ],
      },
    },
    {
      submenu: {
        label: "Info",
        items: [
          { item: { label: "Runtime", id: "info-runtime", enabled: true } },
          { item: { label: "Assets", id: "info-assets", enabled: true } },
          {
            item: {
              label: "About Excalidraw Offline",
              id: "info-about-app",
              enabled: true,
            },
          },
          {
            item: {
              label: "About Excalidraw",
              id: "info-about-excalidraw",
              enabled: true,
            },
          },
        ],
      },
    },
  ]);
}

async function runInstallSketchingSkill(): Promise<void> {
  const choice = await choiceDialog(
    "Install skill",
    "Where should excalidraw-sketching be installed?",
    INSTALL_SKILL_OPTIONS,
    "global",
  );
  if (!choice.ok) {
    if (choice.reason === "cancelled") {
      enqueueUi({ type: "status", message: "Skill install cancelled" });
      return;
    }
    await infoDialog(
      "Install skill",
      `Cannot show install options: ${choice.detail ?? choice.reason}`,
    );
    return;
  }

  const mode = choice.id as InstallMode;
  let picked: string | undefined;

  if (mode === "project" || mode === "custom") {
    const title = mode === "project"
      ? "Select project folder"
      : "Select destination folder";
    const dir = await openDirectoryDialog(title, homeDir());
    if (!dir.ok) {
      if (dir.reason === "cancelled") {
        enqueueUi({ type: "status", message: "Skill install cancelled" });
        return;
      }
      await infoDialog(
        "Install skill",
        `Cannot pick folder: ${dir.detail ?? dir.reason}`,
      );
      return;
    }
    picked = dir.path;
  }

  let dest: string;
  try {
    dest = resolveInstallTarget(mode, homeDir(), picked);
  } catch (err) {
    await infoDialog("Install skill", String(err));
    return;
  }

  if (await pathExists(dest)) {
    const overwrite = await confirmDialog(
      "Overwrite skill?",
      `Skill already exists at:\n${dest}\n\nReplace it?`,
    );
    if (!overwrite.ok) {
      await infoDialog(
        "Install skill",
        `Cannot confirm overwrite: ${overwrite.detail ?? overwrite.reason}`,
      );
      return;
    }
    if (!overwrite.confirmed) {
      enqueueUi({ type: "status", message: "Skill install cancelled" });
      return;
    }
  }

  const result = await installSkillTo(BUNDLED_SKILL, dest);
  if (result.ok) {
    await infoDialog(
      "Install skill",
      `Installed ${SKILL_ID} to:\n${result.dest}`,
    );
    enqueueUi({ type: "status", message: `Skill installed: ${result.dest}` });
  } else {
    await infoDialog(
      "Install skill",
      `Install failed:\n${result.detail}`,
    );
    enqueueUi({ type: "status", message: "Skill install failed" });
  }
}

appVersion = getAppVersion();
excalidrawVersion = getExcalidrawVersion();
console.log(
  "[desktop] versions app=%s excalidraw=%s",
  appVersion,
  excalidrawVersion,
);
applyMenu(recentStore.list());

/**
 * Native pickers run here (Deno menu), then we enqueue a path for the UI.
 * UI writes over HTTP — never zenity inside a webview round-trip.
 */
win.addEventListener("menuclick", (e: Event) => {
  const id = (e as CustomEvent<{ id: string }>).detail.id;
  console.log("[menu]", id);
  void (async () => {
    const recentPath = pathFromRecentMenuId(id);
    if (recentPath) {
      try {
        const info = await Deno.stat(recentPath);
        if (!info.isFile) throw new Error("not a file");
        enqueueUi({ type: "open", path: recentPath });
      } catch {
        enqueueUi({
          type: "status",
          message: `Recent file missing: ${recentPath}`,
        });
        await recentStore.remove(recentPath);
        applyMenu(recentStore.list());
      }
      return;
    }

    switch (id) {
      case "new":
        enqueueUi({ type: "new" });
        break;
      case "open": {
        enqueueUi({ type: "status", message: "Choose file to open…" });
        const picked = await openExcalidrawDialog();
        if (picked.ok) {
          enqueueUi({ type: "open", path: picked.path });
        } else if (picked.reason === "cancelled") {
          enqueueUi({ type: "status", message: "Open cancelled" });
        } else {
          console.warn("[menu] open picker fallback", picked);
          enqueueUi({ type: "open" });
        }
        break;
      }
      case "save": {
        if (currentPath) {
          enqueueUi({ type: "save", forcePicker: false, path: currentPath });
          break;
        }
        enqueueUi({ type: "status", message: "Choose save location…" });
        const picked = await saveExcalidrawDialog(
          currentPath ?? "drawing.excalidraw",
        );
        if (picked.ok) {
          enqueueUi({ type: "save", forcePicker: false, path: picked.path });
        } else if (picked.reason === "cancelled") {
          enqueueUi({ type: "status", message: "Save cancelled" });
        } else {
          console.warn("[menu] save picker fallback", picked);
          enqueueUi({ type: "save", forcePicker: true });
        }
        break;
      }
      case "save-as": {
        enqueueUi({ type: "status", message: "Choose save location…" });
        const suggested = currentPath ?? "drawing.excalidraw";
        const picked = await saveExcalidrawDialog(suggested);
        if (picked.ok) {
          enqueueUi({ type: "save", forcePicker: false, path: picked.path });
        } else if (picked.reason === "cancelled") {
          enqueueUi({ type: "status", message: "Save cancelled" });
        } else {
          console.warn("[menu] save-as picker fallback", picked);
          enqueueUi({ type: "save", forcePicker: true });
        }
        break;
      }
      case "quit":
        enqueueQuit();
        break;
      case CLEAR_RECENT_ID:
        await recentStore.clear();
        applyMenu(recentStore.list());
        enqueueUi({ type: "status", message: "Recent files cleared" });
        break;
      case "skills-install-sketching":
        await runInstallSketchingSkill();
        break;
      case "info-runtime": {
        const text = `Ready · dialog: ${dialogBackend}+http`;
        const result = await infoDialog("Runtime", text);
        if (!result.ok) {
          console.warn("[menu] info-runtime", result);
          enqueueUi({
            type: "status",
            message: `Info dialog unavailable: ${result.detail ?? result.reason}`,
          });
        }
        break;
      }
      case "info-assets": {
        const result = await infoDialog(
          "Assets",
          "Images save into assets/ next to the .excalidraw file.",
        );
        if (!result.ok) {
          console.warn("[menu] info-assets", result);
          enqueueUi({
            type: "status",
            message: `Info dialog unavailable: ${result.detail ?? result.reason}`,
          });
        }
        break;
      }
      case "info-about-app": {
        const text =
          `Excalidraw Offline\nVersion: ${appVersion}\n\n` +
          "A Deno Desktop wrapper around @excalidraw/excalidraw for offline local files.";
        const result = await infoDialog(
          "About Excalidraw Offline",
          text,
          getAppRepoUrl(),
        );
        if (!result.ok) {
          console.warn("[menu] info-about-app", result);
          enqueueUi({
            type: "status",
            message: `Info dialog unavailable: ${result.detail ?? result.reason}`,
          });
        }
        break;
      }
      case "info-about-excalidraw": {
        const text =
          `Excalidraw\nRelease: ${excalidrawVersion}\n\n` +
          "Upstream @excalidraw/excalidraw packaged by this app.";
        const result = await infoDialog(
          "About Excalidraw",
          text,
          getExcalidrawRepoUrl(),
        );
        if (!result.ok) {
          console.warn("[menu] info-about-excalidraw", result);
          enqueueUi({
            type: "status",
            message: `Info dialog unavailable: ${result.detail ?? result.reason}`,
          });
        }
        break;
      }
      default:
        break;
    }
  })();
});

win.addEventListener("close", (e: Event) => {
  if (closeGuard.shouldDeferClose()) {
    e.preventDefault();
    console.log("[close] deferred → enqueue quit");
    enqueueQuit();
  } else {
    console.log("[close] allowed");
  }
});

dialogBackend = await describeDialogBackend();
console.log("[desktop] http api ready; dialog backend:", dialogBackend);

const target = DEV_URL ?? appUrl;
console.log("[desktop] navigate", target);
win.navigate(target);
