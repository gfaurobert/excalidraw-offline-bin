import { dirname, join } from "./path.ts";
import type {
  BinaryFileData,
  OfflineExcalidrawDocument,
  ScenePayload,
  StoredFileRef,
} from "./types.ts";

export const SOURCE = "excalidraw-offline-bin";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/octet-stream": "bin",
};

export function extensionForMime(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? "bin";
}

export function mimeFromExtension(ext: string): string {
  const normalized = ext.toLowerCase().replace(/^\./, "");
  for (const [mime, e] of Object.entries(MIME_TO_EXT)) {
    if (e === normalized) return mime;
  }
  return "application/octet-stream";
}

export function dataURLToBytes(dataURL: string): Uint8Array {
  const match = dataURL.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToDataURL(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function isStoredRef(
  entry: StoredFileRef | BinaryFileData,
): entry is StoredFileRef {
  return "path" in entry && typeof entry.path === "string" && entry.path.length > 0;
}

function sanitizeAppState(
  appState: Record<string, unknown>,
): Record<string, unknown> {
  const {
    collaborators: _collaborators,
    ...rest
  } = appState;
  return rest;
}

/** Externalize in-memory BinaryFiles into assets/ and build on-disk JSON. */
export async function writeScene(
  documentPath: string,
  scene: ScenePayload,
): Promise<void> {
  const dir = dirname(documentPath);
  const assetsDir = join(dir, "assets");
  await Deno.mkdir(assetsDir, { recursive: true });

  const storedFiles: Record<string, StoredFileRef> = {};

  for (const [id, file] of Object.entries(scene.files ?? {})) {
    const ext = extensionForMime(file.mimeType);
    const relativePath = `assets/${id}.${ext}`;
    const absolutePath = join(dir, relativePath);

    if (file.dataURL) {
      const bytes = dataURLToBytes(file.dataURL);
      await Deno.writeFile(absolutePath, bytes);
    } else if (!(await exists(absolutePath))) {
      throw new Error(`Missing asset data for file id ${id}`);
    }

    storedFiles[id] = {
      mimeType: file.mimeType,
      id,
      path: relativePath,
      created: file.created ?? Date.now(),
      lastRetrieved: file.lastRetrieved,
    };
  }

  const document: OfflineExcalidrawDocument = {
    type: "excalidraw",
    version: 2,
    source: SOURCE,
    elements: scene.elements ?? [],
    appState: sanitizeAppState(scene.appState ?? {}),
    files: storedFiles,
  };

  await Deno.writeTextFile(
    documentPath,
    `${JSON.stringify(document, null, 2)}\n`,
  );
}

/** Load scene JSON and rehydrate BinaryFiles from assets/. */
export async function readScene(documentPath: string): Promise<ScenePayload> {
  const text = await Deno.readTextFile(documentPath);
  const parsed = JSON.parse(text) as OfflineExcalidrawDocument;
  const dir = dirname(documentPath);
  const files: Record<string, BinaryFileData> = {};

  for (const [id, entry] of Object.entries(parsed.files ?? {})) {
    if (isStoredRef(entry)) {
      const absolutePath = join(dir, entry.path);
      const bytes = await Deno.readFile(absolutePath);
      files[id] = {
        mimeType: entry.mimeType,
        id,
        dataURL: bytesToDataURL(bytes, entry.mimeType),
        created: entry.created,
        lastRetrieved: entry.lastRetrieved ?? Date.now(),
      };
      continue;
    }

    // Upstream-compatible embedded dataURL entries
    if (entry.dataURL) {
      files[id] = {
        mimeType: entry.mimeType,
        id: entry.id ?? id,
        dataURL: entry.dataURL,
        created: entry.created ?? Date.now(),
        lastRetrieved: entry.lastRetrieved ?? Date.now(),
      };
    }
  }

  return {
    elements: parsed.elements ?? [],
    appState: parsed.appState ?? {},
    files,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
