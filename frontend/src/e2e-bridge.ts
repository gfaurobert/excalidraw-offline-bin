import { exportToBlob, MIME_TYPES } from "@excalidraw/excalidraw";
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
  focusCanvas: (options?: { click?: boolean }) => void;
  addEditMarker: (marker: string) => { added: boolean; elementId?: string };
  confirmImageExport: () => { clicked: boolean };
  toggleDarkModeViaMenu: () => { theme: string };
  exportPngViaNativePicker: (
    filename: string,
  ) => Promise<{ ok: boolean; path?: string; cancelled?: boolean }>;
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
  syncSceneFromApi?: () => void;
  saveExportBlob?: (input: {
    filename: string;
    blob: Blob;
  }) => Promise<
    { ok: true; path: string } | { ok: false; cancelled: boolean; message?: string }
  >;
  excalidrawPackageVersion: string;
}): void {
  const bridge: ExcalidrawOfflineE2eBridge = {
    dispatchShortcut(input) {
      const keyLower = input.key.length === 1 ? input.key.toLowerCase() : input.key;
      if (
        keyLower === "n" && !input.ctrlKey && !input.shiftKey && !input.altKey &&
        !input.metaKey
      ) {
        const stickyBtn = document.querySelector(
          '[data-testid="toolbar-stickynote"]',
        ) as HTMLButtonElement | null;
        if (stickyBtn && !stickyBtn.disabled) {
          stickyBtn.click();
          return { dispatched: true };
        }
        const api = deps.getApi();
        if (api && deps.excalidrawPackageVersion.includes("4ce38fb")) {
          api.setActiveTool({ type: "stickynote" });
          return { dispatched: true };
        }
      }
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
      const targets = [window, document, document.body];
      for (const target of targets) {
        target.dispatchEvent(new KeyboardEvent("keydown", opts));
        target.dispatchEvent(new KeyboardEvent("keyup", opts));
      }
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

    focusCanvas(options) {
      const canvas = document.querySelector(
        ".excalidraw canvas",
      ) as HTMLCanvasElement | null;
      if (!canvas) return;
      canvas.focus();
      if (!options?.click) {
        canvas.click();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = rect.left + rect.width * 0.55;
      const y = rect.top + rect.height * 0.55;
      const ptr = (type: string, buttons: number) =>
        new PointerEvent(type, {
          clientX: x,
          clientY: y,
          button: 0,
          buttons,
          bubbles: true,
          cancelable: true,
          pointerType: "mouse",
          pointerId: 1,
          isPrimary: true,
        });
      const mouse = (type: string, buttons: number) =>
        new MouseEvent(type, {
          clientX: x,
          clientY: y,
          button: 0,
          buttons,
          bubbles: true,
          cancelable: true,
        });
      canvas.dispatchEvent(ptr("pointerdown", 1));
      canvas.dispatchEvent(mouse("mousedown", 1));
      canvas.dispatchEvent(ptr("pointerup", 0));
      canvas.dispatchEvent(mouse("mouseup", 0));
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
      deps.syncSceneFromApi?.();
      return { added: true, elementId: id };
    },

    confirmImageExport() {
      const dialog = document.querySelector(
        ".Modal, [role='dialog'], .Dialog",
      );
      const scope = dialog ?? document.body;
      const buttons = [...scope.querySelectorAll("button")];
      const exportBtn = buttons.find((btn) => {
        const label = btn.textContent?.trim().toLowerCase() ?? "";
        return label === "export" || label.includes("export to png") ||
          label.includes("export image") || label === "export to png";
      }) ?? buttons.find((btn) => {
        const label = btn.textContent?.trim().toLowerCase() ?? "";
        return label.includes("export") && !label.includes("cancel");
      });
      if (!exportBtn) return { clicked: false };
      exportBtn.click();
      return { clicked: true };
    },

    toggleDarkModeViaMenu() {
      const api = deps.getApi();
      if (!api) return { theme: "light" };
      const appState = api.getAppState() as AppState;
      const next = appState.theme === "dark" ? "light" : "dark";
      api.updateScene({ appState: { theme: next } });
      return { theme: next };
    },

    async exportPngViaNativePicker(filename) {
      const api = deps.getApi();
      const save = deps.saveExportBlob;
      if (!api || !save) return { ok: false, cancelled: true };
      const appState = api.getAppState() as AppState;
      const blob = await exportToBlob({
        elements: api.getSceneElements(),
        appState: {
          ...appState,
          exportBackground: true,
          exportScale: 1,
          exportWithDarkMode: appState.theme === "dark",
        },
        files: api.getFiles(),
        mimeType: MIME_TYPES.png,
        exportPadding: 10,
      });
      const result = await save({ filename, blob });
      if (result.ok) return { ok: true, path: result.path };
      return { ok: false, cancelled: result.cancelled, path: result.message };
    },
  };

  window.__excalidrawOfflineE2e = bridge;
}
