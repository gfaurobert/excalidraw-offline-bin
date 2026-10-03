import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { AppState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export interface E2eShortcutInput {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

export interface E2eInspectState {
  ok: boolean;
  theme?: string;
  scrollX?: number;
  scrollY?: number;
  openDialog?: string | null;
  elementTypes?: string[];
  elementTexts?: string[];
  pathLabel?: string;
  excalidrawVersion?: string;
  hasStickynoteTool?: boolean;
}

export interface ExcalidrawOfflineE2eBridge {
  dispatchShortcut: (input: E2eShortcutInput) => { dispatched: boolean };
  getInspect: () => E2eInspectState;
  focusCanvas: () => void;
  addEditMarker: (marker: string) => { added: boolean; elementId?: string };
  confirmImageExport: () => { clicked: boolean };
  setActiveTool: (tool: string) => { ok: boolean };
  placeStickyNote: (text: string) => { ok: boolean; elementId?: string };
  toggleDarkModeViaMenu: () => { theme: string };
}

declare global {
  interface Window {
    __excalidrawOfflineE2e?: ExcalidrawOfflineE2eBridge;
  }
}

function keyCodeFor(key: string): string {
  const k = key.length === 1 ? key.toUpperCase() : key;
  if (k.length === 1) return `Key${k}`;
  return key;
}

export function installExcalidrawOfflineE2eBridge(deps: {
  getApi: () => ExcalidrawImperativeAPI | null;
  getPathLabel: () => string;
  excalidrawPackageVersion: string;
}): void {
  const bridge: ExcalidrawOfflineE2eBridge = {
    dispatchShortcut(input) {
      const opts: KeyboardEventInit = {
        key: input.key,
        code: keyCodeFor(input.key),
        ctrlKey: Boolean(input.ctrlKey),
        shiftKey: Boolean(input.shiftKey),
        altKey: Boolean(input.altKey),
        metaKey: Boolean(input.metaKey),
        bubbles: true,
        cancelable: true,
        composed: true,
      };
      window.dispatchEvent(new KeyboardEvent("keydown", opts));
      window.dispatchEvent(new KeyboardEvent("keyup", opts));
      return { dispatched: true };
    },

    getInspect() {
      const api = deps.getApi();
      if (!api) return { ok: false };
      const appState = api.getAppState() as AppState;
      const elements = api.getSceneElements() as ExcalidrawElement[];
      const openDialog = appState.openDialog;
      return {
        ok: true,
        theme: appState.theme ?? "light",
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        openDialog: openDialog && typeof openDialog === "object"
          ? openDialog.name ?? null
          : null,
        elementTypes: elements.filter((el) => !el.isDeleted).map((el) => el.type),
        elementTexts: elements
          .filter((el) => !el.isDeleted && el.type === "text")
          .map((el) => (el as ExcalidrawElement & { text?: string }).text ?? "")
          .filter(Boolean),
        pathLabel: deps.getPathLabel(),
        excalidrawVersion: deps.excalidrawPackageVersion,
        hasStickynoteTool: elements.some((el) => el.type === "stickynote") ||
          typeof (appState as AppState & { activeTool?: { type?: string } })
              .activeTool?.type === "string",
      };
    },

    focusCanvas() {
      const canvas = document.querySelector(
        ".excalidraw canvas",
      ) as HTMLCanvasElement | null;
      canvas?.focus();
      canvas?.click();
    },

    addEditMarker(marker: string) {
      const api = deps.getApi();
      if (!api) return { added: false };
      const id = `e2e-marker-${Date.now()}`;
      const elements = api.getSceneElements() as ExcalidrawElement[];
      const textEl = {
        type: "text",
        id,
        x: 120,
        y: 200,
        width: 280,
        height: 40,
        angle: 0,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        version: 1,
        versionNonce: Math.floor(Math.random() * 1e9),
        isDeleted: false,
        seed: 1,
        groupIds: [],
        frameId: null,
        roundness: null,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        text: marker,
        fontSize: 24,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        originalText: marker,
        lineHeight: 1.25,
      } as unknown as ExcalidrawElement;
      api.updateScene({ elements: [...elements, textEl] });
      return { added: true, elementId: id };
    },

    confirmImageExport() {
      const buttons = [...document.querySelectorAll("button")];
      const exportBtn = buttons.find((btn) => {
        const label = btn.textContent?.trim().toLowerCase() ?? "";
        return label === "export" || label.includes("export to png");
      });
      if (!exportBtn) return { clicked: false };
      exportBtn.click();
      return { clicked: true };
    },

    setActiveTool(tool: string) {
      const api = deps.getApi();
      if (!api) return { ok: false };
      api.setActiveTool({ type: tool as "stickynote" });
      return { ok: true };
    },

    placeStickyNote(text: string) {
      const api = deps.getApi();
      if (!api) return { ok: false };
      if (!deps.excalidrawPackageVersion.includes("4ce38fb")) {
        return { ok: false };
      }
      try {
        api.setActiveTool({ type: "stickynote" as "selection" });
      } catch {
        return { ok: false };
      }
      const elements = api.getSceneElements() as ExcalidrawElement[];
      const id = `e2e-sticky-${Date.now()}`;
      const note = {
        type: "stickynote",
        id,
        x: 380,
        y: 260,
        width: 200,
        height: 180,
        angle: 0,
        strokeColor: "#1e1e1e",
        backgroundColor: "#fff3bf",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        version: 1,
        versionNonce: Math.floor(Math.random() * 1e9),
        isDeleted: false,
        seed: 1,
        groupIds: [],
        frameId: null,
        roundness: null,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
      } as unknown as ExcalidrawElement;
      api.updateScene({ elements: [...elements, note] });
      if (text) {
        api.updateScene({
          appState: { selectedElementIds: { [id]: true } },
        });
      }
      return { ok: true, elementId: id };
    },

    toggleDarkModeViaMenu() {
      const api = deps.getApi();
      if (!api) return { theme: "light" };
      const appState = api.getAppState() as AppState;
      const next = appState.theme === "dark" ? "light" : "dark";
      api.updateScene({ appState: { theme: next } });
      return { theme: next };
    },
  };

  window.__excalidrawOfflineE2e = bridge;
}
