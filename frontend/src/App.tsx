import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

interface ScenePayload {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

interface UiCommand {
  type: "status" | "new" | "open" | "save" | "quit";
  message?: string;
  forcePicker?: boolean;
  path?: string;
}

const AUTOSAVE_MS = 1500;
const POLL_MS = 200;

type PathDialogMode = "save" | "open";

interface PathDialogState {
  mode: PathDialogMode;
  title: string;
  value: string;
}

interface ConfirmDialogState {
  message: string;
  resolve: (ok: boolean) => void;
}

function basename(path: string): string {
  return path.split("/").pop() || path;
}

function ensureExt(path: string): string {
  return path.endsWith(".excalidraw") ? path : `${path}.excalidraw`;
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

function PathDialog(props: {
  state: PathDialogState;
  onCancel: () => void;
  onConfirm: (path: string) => void;
}) {
  const [value, setValue] = useState(props.state.value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(props.state.value);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [props.state]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onCancel();
        if (e.key === "Enter") props.onConfirm(value.trim());
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "1rem 1.25rem",
          minWidth: 420,
          maxWidth: "90vw",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
          {props.state.title}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "0.4rem 0.5rem",
            fontFamily: "monospace",
            fontSize: "0.9rem",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            marginTop: "0.85rem",
          }}
        >
          <button type="button" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => props.onConfirm(value.trim())}
            disabled={value.trim() === ""}
          >
            {props.state.mode === "open" ? "Open" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog(props: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "1rem 1.25rem",
          minWidth: 320,
          maxWidth: "90vw",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ marginBottom: "0.85rem" }}>{props.message}</div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <button type="button" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="button" onClick={props.onConfirm}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
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
  const pathDialogOpenRef = useRef(false);
  const updateTitleRef = useRef<
    (path: string | null, dirty: boolean) => Promise<void>
  >(async () => {});
  const pathDialogResolve = useRef<((path: string | null) => void) | null>(
    null,
  );

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
  const [pathDialog, setPathDialog] = useState<PathDialogState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(
    null,
  );

  const askPath = useCallback(
    (mode: PathDialogMode, title: string, suggested: string) => {
      return new Promise<string | null>((resolve) => {
        pathDialogResolve.current = resolve;
        pathDialogOpenRef.current = true;
        setPathDialog({ mode, title, value: suggested });
        void apiLog("info", `path dialog open mode=${mode}`);
      });
    },
    [],
  );

  const askConfirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmDialog({ message, resolve });
      void apiLog("info", `confirm dialog: ${message}`);
    });
  }, []);

  const updateTitle = useCallback(async (path: string | null, dirty: boolean) => {
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
        pathDialogOpenRef.current
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

  const runNew = useCallback(async () => {
    await apiLog("info", "runNew start");
    if (dirtyRef.current) {
      const ok = await askConfirm("Discard unsaved changes?");
      if (!ok) {
        await apiLog("info", "runNew cancelled");
        return;
      }
    }
    pathRef.current = null;
    dirtyRef.current = false;
    sceneRef.current = { elements: [], appState: {}, files: {} };
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
    await updateTitleRef.current(null, false);
    setStatus("New drawing");
    await apiLog("info", "runNew done");
  }, [askConfirm]);

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

  const runSave = useCallback(async (
    forcePicker: boolean,
    presetPath?: string,
  ): Promise<boolean> => {
    await apiLog(
      "info",
      `runSave start forcePicker=${forcePicker} busy=${busyRef.current} path=${pathRef.current} preset=${presetPath ?? ""}`,
    );
    if (busyRef.current) {
      await apiLog("info", "runSave skipped: busy");
      return false;
    }

    let path = presetPath?.trim() || pathRef.current;
    if (forcePicker || !path) {
      const suggested = path ?? `${homeRef.current}/drawing.excalidraw`;
      const entered = await askPath(
        "save",
        "Save Excalidraw file — enter full path:",
        suggested,
      );
      if (entered === null || entered === "") {
        setStatus("Save cancelled");
        await apiLog("info", "runSave cancelled at path dialog");
        return false;
      }
      path = ensureExt(entered);
      await apiLog("info", `runSave path chosen: ${path}`);
    }

    return await writeSceneToPath(path);
  }, [askPath, writeSceneToPath]);

  const runQuit = useCallback(async () => {
    await apiLog("info", `runQuit start dirty=${dirtyRef.current} busy=${busyRef.current}`);
    if (quittingRef.current || busyRef.current) {
      await apiLog("info", "runQuit skipped: busy or already quitting");
      if (busyRef.current && !quittingRef.current) {
        notifyQuitAborted();
      }
      return;
    }
    quittingRef.current = true;
    try {
      if (dirtyRef.current) {
        const saved = await runSave(false);
        if (!saved) {
          await apiLog("info", "runQuit aborted: save cancelled or failed");
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
  }, [runSave]);

  const runOpen = useCallback(async (presetPath?: string) => {
    await apiLog(
      "info",
      `runOpen start busy=${busyRef.current} preset=${presetPath ?? ""}`,
    );
    if (busyRef.current) {
      await apiLog("info", "runOpen skipped: busy");
      return;
    }
    if (dirtyRef.current) {
      const ok = await askConfirm("Discard unsaved changes?");
      if (!ok) {
        await apiLog("info", "runOpen cancelled at confirm");
        return;
      }
    }

    let path = presetPath?.trim() ?? "";
    if (!path) {
      const suggested = `${homeRef.current}/drawing.excalidraw`;
      const entered = await askPath(
        "open",
        "Open Excalidraw file — enter full path:",
        suggested,
      );
      if (entered === null || entered === "") {
        setStatus("Open cancelled");
        await apiLog("info", "runOpen cancelled at path dialog");
        return;
      }
      path = entered;
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
      await updateTitleRef.current(doc.path, false);
      setStatus(`Opened ${doc.path}`);
      await apiLog("info", `runOpen done ${doc.path}`);
    } catch (err) {
      await apiLog("error", `open failed: ${String(err)}`);
      setStatus(`Open failed: ${String(err)}`);
    } finally {
      busyRef.current = false;
    }
  }, [askConfirm, askPath]);

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
  }, []);

  // Poll menu command queue over HTTP.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled || busyRef.current) return;
      if (pathDialog || confirmDialog) return;
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
  }, [runNew, runOpen, runSave, runQuit, pathDialog, confirmDialog]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current !== null) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  return (
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
      {pathDialog && (
        <PathDialog
          state={pathDialog}
          onCancel={() => {
            setPathDialog(null);
            pathDialogOpenRef.current = false;
            pathDialogResolve.current?.(null);
            pathDialogResolve.current = null;
            void apiLog("info", "path dialog cancel");
          }}
          onConfirm={(path) => {
            setPathDialog(null);
            pathDialogOpenRef.current = false;
            pathDialogResolve.current?.(path);
            pathDialogResolve.current = null;
            void apiLog("info", `path dialog confirm: ${path}`);
          }}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onCancel={() => {
            confirmDialog.resolve(false);
            setConfirmDialog(null);
            void apiLog("info", "confirm cancel");
          }}
          onConfirm={() => {
            confirmDialog.resolve(true);
            setConfirmDialog(null);
            void apiLog("info", "confirm ok");
          }}
        />
      )}
    </div>
  );
}
