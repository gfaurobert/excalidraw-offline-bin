/**
 * Intercept Excalidraw's anchor-download fallback (browser-fs-access fileSave)
 * and route PNG/SVG exports through the desktop native save dialog.
 */

export interface OfflineExportSaveHandlers {
  saveExportBlob: (input: {
    filename: string;
    blob: Blob;
  }) => Promise<{ ok: true; path: string } | { ok: false; cancelled: boolean; message?: string }>;
  onSaved?: (path: string) => void;
  onError?: (message: string) => void;
}

let handlers: OfflineExportSaveHandlers | null = null;
let installed = false;

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function isExportLikeDownload(anchor: HTMLAnchorElement): boolean {
  const name = anchor.download?.trim() ?? "";
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower.endsWith(".png") || lower.endsWith(".svg") ||
    lower.endsWith(".excalidraw.png") || lower.endsWith(".excalidraw.svg");
}

export function installOfflineExportDownloadHook(
  next: OfflineExportSaveHandlers,
): void {
  handlers = next;
  if (installed) return;
  installed = true;

  try {
    delete (window as Window & { showSaveFilePicker?: unknown })
      .showSaveFilePicker;
  } catch {
    // ignore
  }

  const origCreate = document.createElement.bind(document);
  document.createElement = (
    tagName: string,
    options?: ElementCreationOptions,
  ) => {
    const el = origCreate(tagName, options);
    if (tagName.toLowerCase() !== "a" || !handlers) return el;

    const anchor = el as HTMLAnchorElement;
    const origClick = anchor.click.bind(anchor);
    anchor.click = () => {
      if (
        isExportLikeDownload(anchor) &&
        anchor.href.startsWith("blob:")
      ) {
        void (async () => {
          const h = handlers;
          if (!h) {
            origClick();
            return;
          }
          try {
            const res = await fetch(anchor.href);
            const blob = await res.blob();
            const result = await h.saveExportBlob({
              filename: anchor.download,
              blob,
            });
            URL.revokeObjectURL(anchor.href);
            if (result.ok) {
              h.onSaved?.(result.path);
            } else if (!result.cancelled && result.message) {
              h.onError?.(result.message);
            }
          } catch (err) {
            h.onError?.(String(err));
          }
        })();
        return;
      }
      origClick();
    };
    return el;
  };
}

export async function saveExportBlobViaApi(
  input: { filename: string; blob: Blob },
  apiJson: <T>(path: string, init?: RequestInit) => Promise<T>,
): Promise<
  { ok: true; path: string } | { ok: false; cancelled: boolean; message?: string }
> {
  const base64 = await blobToBase64(input.blob);
  const pick = await apiJson<{
    path?: string;
    cancelled?: boolean;
    ok?: boolean;
    error?: string;
  }>("/api/pick-save-image-export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: input.filename }),
  });
  if (pick.cancelled) return { ok: false, cancelled: true };
  if (!pick.path) {
    return {
      ok: false,
      cancelled: false,
      message: pick.error ?? "Save cancelled",
    };
  }
  await apiJson("/api/write-binary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: pick.path, dataBase64: base64 }),
  });
  return { ok: true, path: pick.path };
}
