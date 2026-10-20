import { Excalidraw, useHandleLibrary } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useMemo, useState } from "react";
import {
  createLibraryMigrationAdapter,
  createLibraryPersistenceAdapter,
} from "./lib/library-persistence.ts";

interface ExcalidrawCanvasProps {
  docKey: number;
  initialData: {
    elements: ExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  };
  onExcalidrawAPI: (api: ExcalidrawImperativeAPI) => void;
  onChange: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => void;
  apiJson: <T>(path: string, init?: RequestInit) => Promise<T>;
}

export function ExcalidrawCanvas({
  docKey,
  initialData,
  onExcalidrawAPI,
  onChange,
  apiJson,
}: ExcalidrawCanvasProps) {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);

  const libraryAdapter = useMemo(
    () => createLibraryPersistenceAdapter(apiJson),
    [apiJson],
  );
  const libraryMigrationAdapter = useMemo(
    () => createLibraryMigrationAdapter(),
    [],
  );

  useHandleLibrary({
    excalidrawAPI,
    adapter: libraryAdapter,
    migrationAdapter: libraryMigrationAdapter,
  });

  const libraryReturnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : undefined;

  return (
    <Excalidraw
      key={docKey}
      onExcalidrawAPI={(api) => {
        if (!api) return;
        setExcalidrawAPI(api);
        onExcalidrawAPI(api);
      }}
      initialData={{
        elements: initialData.elements,
        appState: initialData.appState,
        files: initialData.files,
        scrollToContent: true,
      }}
      onChange={onChange}
      libraryReturnUrl={libraryReturnUrl}
      UIOptions={{
        canvasActions: {
          loadScene: false,
          saveToActiveFile: false,
          export: false,
          saveAsImage: true,
        },
      }}
    />
  );
}
