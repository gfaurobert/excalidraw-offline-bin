import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { StartScreen } from "./StartScreen";

interface ScenePayload {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

interface UiCommand {
  type: "status" | "new" | "open" | "save" | "close" | "quit";
  message?: string;
  forcePicker?: boolean;
  path?: string;
}

type AppMode = "start" | "canvas";
type DirtyGateResult = "proceed" | "abort";

type PickPathResult =
  | { ok: true; path: string }
  | { ok: false; reason: "cancelled" | "failed"; message?: string };

const AUTOSAVE_MS = 1500;
const POLL_MS = 200;

function basename(path: string): string {
  return path.split("/").pop() || path;
}

async function apiLog(
  level: "info" | "error",
  message: string,
): Promise<void> {
  console[level === "error" ? "error" : "log"](message);
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ level, message }),
    });
  } catch {
    // ignore
  }
}

async function apiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json() as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(
      (data as { error?: string }).error ?? `${res.status} ${res.statusText}`,
    );
  }
  return data;
}

function notifyQuitAborted(): void {
  void fetch("/api/quit-aborted", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }).catch(() => {});
}

async function notifyMode(next: AppMode): Promise<void> {
  try {
    await apiJson("/api/set-mode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
  } catch {
    // non-fatal
  }
}

function toScenePayload(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
): ScenePayload {
  const cleanFiles: BinaryFiles = {};
  for (const [id, file] of Object.entries(files)) {
    if (!file) continue;
    cleanFiles[id] = {
      id: file.id,
      mimeType: file.mimeType,
      dataURL: file.dataURL as DataURL,
      created: file.created,
      lastRetrieved: file.lastRetrieved,
    };
  }

  return {
    elements: elements.filter((el) => !el.isDeleted),
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      gridSize: appState.gridSize,
      theme: appState.theme,
      name: appState.name,
    },
    files: cleanFiles,
  };
}

export default function App() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const pathRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const sceneRef = useRef<ScenePayload>({
    elements: [],
    appState: {},
    files: {},
  });
  const homeRef = useRef<string>(".");
  const busyRef = useRef(false);
  const quittingRef = useRef(false);
  const autosaveTimer = useRef<number | null>(null);
  const lastTitleRef = useRef<string>("");
  const savedSceneKeyRef = useRef<string>("");
  const nativeDialogBusyRef = useRef(false);
  const modeRef = useRef<AppMode>("start");
  const updateTitleRef = useRef<
    (path: string | null, dirty: boolean) => Promise<void>
  >(async () => {});

  const [mode, setMode] = useState<AppMode>("start");
  const [recent, setRecent] = useState<{ path: string; label: string }[]>([]);
  const [docKey, setDocKey] = useState(0);
  const [initialData, setInitialData] = useState<{
    elements: ExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  }>({
    elements: [],
    appState: { currentItemFontFamily: 1 },
    files: {},
  });
  const [pathLabel, setPathLabel] = useState<string>("Untitled");
  const [status, setStatus] = useState<string>("Starting…");

  modeRef.current = mode;

  const enterCanvas = useCallback(() => {
    modeRef.current = "canvas";
    setMode("canvas");
    void notifyMode("canvas");
  }, []);

  const returnToStart = useCallback(async () => {
    modeRef.current = "start";
    setMode("start");
    await notifyMode("start");
  }, []);

  const refreshRecent = useCallback(async (): Promise<void> => {
    try {
      const data = await apiJson<{
        paths: string[];
        labels: string[];
      }>("/api/recent");
      setRecent(
        data.paths.map((path, i) => ({
          path,
          label: data.labels[i] ?? path.split("/").pop() ?? path,
        })),
      );
    } catch (err) {
      await apiLog("error", `recent refresh failed: ${String(err)}`);
    }
  }, []);

  const updateTitle = useCallback(async (path: string | null, dirty: boolean) => {
    if (modeRef.current === "start") {
      setPathLabel("Untitled");
      const title = "Excalidraw Offline";
      if (lastTitleRef.current === title) return;
      lastTitleRef.current = title;
      try {
        await apiJson("/api/set-title", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title }),
        });
      } catch {
        // non-fatal
      }
      return;
    }

    const base = path ? basename(path) : "Untitled";
    const label = dirty ? `${base} *` : base;
    setPathLabel((prev) => (prev === label ? prev : label));

    const full = path ?? "Untitled";
    const title = `Excalidraw Offline — ${dirty ? `${full} *` : full}`;
    if (lastTitleRef.current === title) return;
    lastTitleRef.current = title;
    try {
      await apiJson("/api/set-title", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {
      // non-fatal
    }
  }, []);
  updateTitleRef.current = updateTitle;

  const scheduleAutosave = useCallback(() => {
    if (!pathRef.current) return;
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = window.setTimeout(async () => {
      if (
        !pathRef.current ||
        !dirtyRef.current ||
        busyRef.current ||
        nativeDialogBusyRef.current
      ) {
        return;
      }
      try {
        setStatus("Autosaving…");
        await apiLog("info", `autosave ${pathRef.current}`);
        await apiJson("/api/write", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            path: pathRef.current,
            scene: JSON.stringify(sceneRef.current),
          }),
        });
        dirtyRef.current = false;
        savedSceneKeyRef.current = JSON.stringify(sceneRef.current);
        await updateTitle(pathRef.current, false);
        setStatus(`Autosaved ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        await apiLog("error", `autosave failed: ${String(err)}`);
        setStatus(`Autosave failed: ${String(err)}`);
      }
    }, AUTOSAVE_MS);
  }, [updateTitle]);

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const next = toScenePayload(elements, appState, files);
      sceneRef.current = next;
      const key = JSON.stringify(next);
      if (key === savedSceneKeyRef.current) {
        dirtyRef.current = false;
        void updateTitle(pathRef.current, false);
        return;
      }
      dirtyRef.current = true;
      void updateTitle(pathRef.current, true);
      scheduleAutosave();
    },
    [scheduleAutosave, updateTitle],
  );

  const writeSceneToPath = useCallback(async (path: string): Promise<boolean> => {
    busyRef.current = true;
    try {
      const sceneJson = JSON.stringify(sceneRef.current);
      setStatus(`Saving… (${sceneJson.length} bytes)`);
      await apiLog("info", `save: write ${path} (${sceneJson.length} bytes)`);
      await apiJson("/api/write", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path, scene: sceneJson }),
      });
      pathRef.current = path;
      dirtyRef.current = false;
      savedSceneKeyRef.current = sceneJson;
      await updateTitleRef.current(path, false);
      setStatus(`Saved ${path}`);
      await apiLog("info", `save: done ${path}`);
      return true;
    } catch (err) {
      await apiLog("error", `save failed: ${String(err)}`);
      setStatus(`Save failed: ${String(err)}`);
      return false;
    } finally {
      busyRef.current = false;
    }
  }, []);

  const flushIfPathed = useCallback(async (): Promise<boolean> => {
    if (!pathRef.current || !dirtyRef.current) return true;
    return await writeSceneToPath(pathRef.current);
  }, [writeSceneToPath]);

  const pickSavePath = useCallback(async (suggested?: string): Promise<PickPathResult> => {
    nativeDialogBusyRef.current = true;
    try {
      const data = await apiJson<{
        path?: string;
        cancelled?: boolean;
      }>("/api/pick-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          suggested: suggested ?? `${homeRef.current}/drawing.excalidraw`,
        }),
      });
      if (data.cancelled) return { ok: false, reason: "cancelled" };
      if (!data.path) {
        const message = "Save failed: no path returned";
        setStatus(message);
        return { ok: false, reason: "failed", message };
      }
      return { ok: true, path: data.path };
    } catch (err) {
      const message = `Save failed: ${String(err)}`;
      setStatus(message);
      await apiLog("error", `pick-save failed: ${String(err)}`);
      return { ok: false, reason: "failed", message };
    } finally {
      nativeDialogBusyRef.current = false;
    }
  }, []);

  const pickOpenPath = useCallback(async (): Promise<PickPathResult> => {
    nativeDialogBusyRef.current = true;
    try {
      const data = await apiJson<{
        path?: string;
        cancelled?: boolean;
      }>("/api/pick-open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (data.cancelled) return { ok: false, reason: "cancelled" };
      if (!data.path) {
        const message = "Open failed: no path returned";
        setStatus(message);
        return { ok: false, reason: "failed", message };
      }
      return { ok: true, path: data.path };
    } catch (err) {
      const message = `Open failed: ${String(err)}`;
      setStatus(message);
      await apiLog("error", `pick-open failed: ${String(err)}`);
      return { ok: false, reason: "failed", message };
    } finally {
      nativeDialogBusyRef.current = false;
    }
  }, []);

  const ensureCleanForNavigation = useCallback(async (): Promise<DirtyGateResult> => {
    if (!dirtyRef.current) return "proceed";

    // Has path: silent flush
    if (pathRef.current) {
      const ok = await flushIfPathed();
      return ok ? "proceed" : "abort";
    }

    // Untitled dirty: Cancel / Save / Discard
    let choice: "save" | "discard" | "cancel";
    nativeDialogBusyRef.current = true;
    try {
      const result = await apiJson<{ choice: "save" | "discard" | "cancel" }>(
        "/api/unsaved",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      choice = result.choice;
    } catch (err) {
      setStatus(`Unsaved dialog failed: ${String(err)}`);
      await apiLog("error", `unsaved dialog failed: ${String(err)}`);
      return "abort";
    } finally {
      nativeDialogBusyRef.current = false;
    }

    if (choice === "cancel") return "abort";
    if (choice === "discard") return "proceed";

    const picked = await pickSavePath();
    if (!picked.ok) {
      if (picked.reason === "cancelled") setStatus("Save cancelled");
      return "abort";
    }
    const saved = await writeSceneToPath(picked.path);
    return saved ? "proceed" : "abort";
  }, [flushIfPathed, pickSavePath, writeSceneToPath]);

  const runNew = useCallback(async () => {
    await apiLog("info", "runNew start");
    if (modeRef.current === "canvas") {
      const gate = await ensureCleanForNavigation();
      if (gate === "abort") {
        await apiLog("info", "runNew cancelled");
        return;
      }
    }
    pathRef.current = null;
    dirtyRef.current = false;
    sceneRef.current = { elements: [], appState: {}, files: {} };
    savedSceneKeyRef.current = JSON.stringify(sceneRef.current);
    setInitialData({
      elements: [],
      appState: { currentItemFontFamily: 1 },
      files: {},
    });
    setDocKey((k) => k + 1);
    try {
      await apiJson("/api/set-path", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: null }),
      });
    } catch {
      // ignore
    }
    enterCanvas();
    await updateTitleRef.current(null, false);
    setStatus("New drawing");
    await apiLog("info", "runNew done");
  }, [ensureCleanForNavigation, enterCanvas]);

  const runSave = useCallback(async (
    forcePicker: boolean,
    presetPath?: string,
  ): Promise<boolean> => {
    await apiLog(
      "info",
      `runSave start forcePicker=${forcePicker} busy=${busyRef.current} path=${pathRef.current} preset=${presetPath ?? ""}`,
    );
    if (modeRef.current !== "canvas") {
      await apiLog("info", "runSave skipped: not on canvas");
      return false;
    }
    if (busyRef.current) {
      await apiLog("info", "runSave skipped: busy");
      return false;
    }

    let path = presetPath?.trim() || pathRef.current;
    if (forcePicker || !path) {
      const chosen = await pickSavePath(
        path ?? `${homeRef.current}/drawing.excalidraw`,
      );
      if (!chosen.ok) {
        if (chosen.reason === "cancelled") {
          setStatus("Save cancelled");
          await apiLog("info", "runSave cancelled at pick-save");
        }
        return false;
      }
      path = chosen.path;
      await apiLog("info", `runSave path chosen: ${path}`);
    }

    return await writeSceneToPath(path);
  }, [pickSavePath, writeSceneToPath]);

  const runOpen = useCallback(async (presetPath?: string) => {
    await apiLog(
      "info",
      `runOpen start busy=${busyRef.current} preset=${presetPath ?? ""} mode=${modeRef.current}`,
    );
    if (busyRef.current) {
      await apiLog("info", "runOpen skipped: busy");
      return;
    }
    if (modeRef.current === "canvas") {
      const gate = await ensureCleanForNavigation();
      if (gate === "abort") {
        await apiLog("info", "runOpen cancelled at dirty gate");
        return;
      }
    }

    let path = presetPath?.trim() ?? "";
    if (!path) {
      const picked = await pickOpenPath();
      if (!picked.ok) {
        if (picked.reason === "cancelled") {
          setStatus("Open cancelled");
          await apiLog("info", "runOpen cancelled at pick-open");
        }
        return;
      }
      path = picked.path;
    }

    busyRef.current = true;
    try {
      setStatus("Opening…");
      await apiLog("info", `runOpen read ${path}`);
      const doc = await apiJson<{
        path: string;
        elements: ExcalidrawElement[];
        appState: Partial<AppState>;
        files: BinaryFiles;
      }>("/api/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      pathRef.current = doc.path;
      dirtyRef.current = false;
      sceneRef.current = {
        elements: doc.elements,
        appState: doc.appState,
        files: doc.files,
      };
      savedSceneKeyRef.current = JSON.stringify(sceneRef.current);
      setInitialData({
        elements: doc.elements,
        appState: doc.appState,
        files: doc.files,
      });
      setDocKey((k) => k + 1);
      enterCanvas();
      await refreshRecent();
      await updateTitleRef.current(doc.path, false);
      setStatus(`Opened ${doc.path}`);
      await apiLog("info", `runOpen done ${doc.path}`);
    } catch (err) {
      await apiLog("error", `open failed: ${String(err)}`);
      setStatus(`Open failed: ${String(err)}`);
      // /api/read drops missing paths from recentStore; refresh start-screen list.
      await refreshRecent();
      // stay on current mode (start or canvas)
    } finally {
      busyRef.current = false;
    }
  }, [ensureCleanForNavigation, enterCanvas, pickOpenPath, refreshRecent]);

  const runClose = useCallback(async () => {
    await apiLog("info", `runClose start mode=${modeRef.current}`);
    if (modeRef.current !== "canvas") return;

    const gate = await ensureCleanForNavigation();
    if (gate === "abort") {
      await apiLog("info", "runClose cancelled at dirty gate");
      return;
    }

    pathRef.current = null;
    dirtyRef.current = false;
    sceneRef.current = { elements: [], appState: {}, files: {} };
    savedSceneKeyRef.current = "";
    await returnToStart();
    try {
      await apiJson("/api/set-path", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: null }),
      });
    } catch {
      // ignore
    }
    await refreshRecent();
    await updateTitleRef.current(null, false);
    setStatus("");
    await apiLog("info", "runClose done");
  }, [ensureCleanForNavigation, refreshRecent, returnToStart]);

  const runQuit = useCallback(async () => {
    await apiLog(
      "info",
      `runQuit start dirty=${dirtyRef.current} busy=${busyRef.current} mode=${modeRef.current}`,
    );
    if (quittingRef.current || busyRef.current) {
      await apiLog("info", "runQuit skipped: busy or already quitting");
      if (busyRef.current && !quittingRef.current) {
        notifyQuitAborted();
      }
      return;
    }
    quittingRef.current = true;
    try {
      if (modeRef.current === "canvas") {
        const gate = await ensureCleanForNavigation();
        if (gate === "abort") {
          await apiLog("info", "runQuit aborted: dirty gate");
          setStatus((prev) =>
            prev.startsWith("Save failed") || prev === "Save cancelled"
              ? prev
              : "Quit cancelled"
          );
          notifyQuitAborted();
          return;
        }
      }
      setStatus("Quitting…");
      await apiLog("info", "runQuit POST /api/quit");
      await apiJson("/api/quit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch (err) {
      await apiLog("error", `runQuit failed: ${String(err)}`);
      setStatus(`Quit failed: ${String(err)}`);
      notifyQuitAborted();
    } finally {
      quittingRef.current = false;
    }
  }, [ensureCleanForNavigation]);

  // Prove HTTP desktop API is reachable (not Deno bindings).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 50; i++) {
        try {
          const info = await apiJson<{
            home: string;
            dialogBackend: string;
          }>("/api/info");
          if (cancelled) return;
          homeRef.current = info.home || ".";
          await apiLog("info", `api/info ok home=${homeRef.current}`);
          await refreshRecent();
          await notifyMode("start");
          await updateTitleRef.current(null, false);
          setStatus("");
          return;
        } catch (err) {
          if (i === 0 || i % 10 === 0) {
            console.error("api/info retry", err);
          }
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      if (!cancelled) {
        setStatus("HTTP API unavailable");
        await apiLog("error", "api/info failed after retries");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshRecent]);

  // Poll menu command queue over HTTP.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled || busyRef.current || nativeDialogBusyRef.current) return;
      try {
        for (let i = 0; i < 5; i++) {
          const { cmd } = await apiJson<{ cmd: UiCommand | null }>(
            "/api/poll",
          );
          if (!cmd || cancelled) break;
          void apiLog(
            "info",
            `poll got ${cmd.type} forcePicker=${String(cmd.forcePicker ?? "")}`,
          );
          switch (cmd.type) {
            case "status":
              if (cmd.message) setStatus(cmd.message);
              break;
            case "new":
              setTimeout(() => void runNew(), 0);
              break;
            case "open":
              setTimeout(() => void runOpen(cmd.path), 0);
              break;
            case "save": {
              const forcePicker = Boolean(cmd.forcePicker);
              setTimeout(() => void runSave(forcePicker, cmd.path), 0);
              break;
            }
            case "close":
              setTimeout(() => void runClose(), 0);
              break;
            case "quit":
              setTimeout(() => void runQuit(), 0);
              break;
          }
        }
      } catch (err) {
        console.error("poll failed", err);
      }
    };
    const id = window.setInterval(() => void tick(), POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [runNew, runOpen, runSave, runClose, runQuit]);

  // Webview steals focus from native menu accelerators — handle file shortcuts here.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      const key = e.key.toLowerCase();

      if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void runNew();
        return;
      }
      if (key === "o" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void runOpen();
        return;
      }
      if (modeRef.current !== "canvas") return;
      if (key === "w" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void runClose();
        return;
      }
      if (key === "s" && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void runSave(true);
        return;
      }
      if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void runSave(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [runNew, runOpen, runSave, runClose]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current !== null) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  return mode === "start" ? (
    <StartScreen
      recent={recent}
      status={status}
      onNew={() => void runNew()}
      onOpen={() => void runOpen()}
      onOpenRecent={(path) => void runOpen(path)}
    />
  ) : (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.35rem 0.75rem",
          borderBottom: "1px solid #ddd",
          background: "#f7f7f7",
          flexShrink: 0,
          fontSize: "0.85rem",
        }}
      >
        <strong>Excalidraw Offline</strong>
        <span style={{ opacity: 0.75 }}>{status}</span>
        <span style={{ marginLeft: "auto", opacity: 0.75 }}>{pathLabel}</span>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          key={docKey}
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          initialData={{
            elements: initialData.elements,
            appState: initialData.appState,
            files: initialData.files,
            scrollToContent: true,
          }}
          onChange={handleChange}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false,
              saveAsImage: false,
            },
          }}
        />
      </div>
    </div>
  );
}
