/** Shared document types for the offline Excalidraw wrapper. */

export interface BinaryFileData {
  mimeType: string;
  id: string;
  dataURL: string;
  created: number;
  lastRetrieved?: number;
}

/** On-disk file entry: binary lives under assets/, not as base64. */
export interface StoredFileRef {
  mimeType: string;
  id: string;
  /** Relative path from the .excalidraw file, e.g. assets/<id>.png */
  path: string;
  created: number;
  lastRetrieved?: number;
}

export interface OfflineExcalidrawDocument {
  type: "excalidraw";
  version: 2;
  source: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, StoredFileRef | BinaryFileData>;
}

export interface LoadedDocument {
  path: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, BinaryFileData>;
}

export interface ScenePayload {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, BinaryFileData>;
}

export interface Bindings {
  openDocument(): Promise<LoadedDocument | null>;
  saveDocument(path: string, scene: ScenePayload): Promise<{ path: string }>;
  saveDocumentAs(scene: ScenePayload): Promise<{ path: string } | null>;
  writeDocument(path: string, scene: ScenePayload): Promise<void>;
  setWindowTitle(title: string): Promise<void>;
  pickImageFile(): Promise<{ name: string; mimeType: string; dataURL: string } | null>;
}
