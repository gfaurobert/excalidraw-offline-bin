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
  dirty?: boolean;
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
  simulateRightClickPan: (dx: number, dy: number) => { ok: boolean };
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
  getDirty?: () => boolean;
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
        hasStickynoteTool: elements.some((el) =>
          (el.type as string) === "stickynote"
        ),
        dirty: deps.getDirty?.() ?? false,
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
      api.setActiveTool({ type: tool as "selection" });
      return { ok: true };
    },

    placeStickyNote(text: string) {
      const api = deps.getApi();
      if (!api) return { ok: false };
      if (!deps.excalidrawPackageVersion.includes("4ce38fb")) {
        return { ok: false };
      }
      try {
        api.setActiveTool({ type: "selection" });
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

    simulateRightClickPan(dx, dy) {
      const canvas = document.querySelector(
        ".excalidraw canvas",
      ) as HTMLCanvasElement | null;
      if (!canvas) return { ok: false };
      const rect = canvas.getBoundingClientRect();
      const x0 = rect.left + rect.width * 0.45;
      const y0 = rect.top + rect.height * 0.45;
      const x1 = x0 + dx;
      const y1 = y0 + dy;
      const mk = (type: string, x: number, y: number) =>
        new PointerEvent(type, {
          clientX: x,
          clientY: y,
          button: 2,
          buttons: type === "pointerup" ? 0 : 4,
          bubbles: true,
          cancelable: true,
          pointerType: "mouse",
          pointerId: 1,
          isPrimary: true,
        });
      canvas.dispatchEvent(mk("pointerdown", x0, y0));
      canvas.dispatchEvent(mk("pointermove", x1, y1));
      canvas.dispatchEvent(mk("pointerup", x1, y1));
      return { ok: true };
    },
  };

  window.__excalidrawOfflineE2e = bridge;
}
