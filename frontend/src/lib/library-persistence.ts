import type {
  LibraryMigrationAdapter,
  LibraryPersistenceAdapter,
} from "@excalidraw/excalidraw/data/library";
import type { LibraryItems } from "@excalidraw/excalidraw/types";

const LEGACY_LIBRARY_LS_KEYS = [
  "excalidraw-library",
  "library",
  "excalidraw-library-items",
] as const;

const SAVE_DEBOUNCE_MS = 400;

type ApiJson = <T>(path: string, init?: RequestInit) => Promise<T>;

function readLegacyLibraryFromLocalStorage(): LibraryItems | null {
  for (const key of LEGACY_LIBRARY_LS_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as LibraryItems;
      }
      if (
        parsed &&
        typeof parsed === "object" &&
        "libraryItems" in parsed &&
        Array.isArray((parsed as { libraryItems: unknown }).libraryItems)
      ) {
        const items = (parsed as { libraryItems: LibraryItems }).libraryItems;
        if (items.length > 0) return items;
      }
      if (
        parsed &&
        typeof parsed === "object" &&
        "library" in parsed &&
        Array.isArray((parsed as { library: unknown }).library)
      ) {
        const items = (parsed as { library: LibraryItems }).library;
        if (items.length > 0) return items;
      }
    } catch {
      // ignore malformed legacy entries
    }
  }
  return null;
}

export function createLibraryMigrationAdapter(): LibraryMigrationAdapter {
  return {
    async load() {
      const libraryItems = readLegacyLibraryFromLocalStorage();
      if (!libraryItems) return null;
      return { libraryItems };
    },
    async clear() {
      for (const key of LEGACY_LIBRARY_LS_KEYS) {
        window.localStorage.removeItem(key);
      }
    },
  };
}

export function createLibraryPersistenceAdapter(
  apiJson: ApiJson,
): LibraryPersistenceAdapter {
  let saveTimer: number | null = null;
  let pendingSave: LibraryItems | null = null;
  let inFlight: Promise<void> | null = null;

  const flushSave = async (): Promise<void> => {
    const items = pendingSave;
    pendingSave = null;
    if (!items) return;
    await apiJson("/api/library", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ libraryItems: items }),
    });
  };

  const scheduleSave = (libraryItems: LibraryItems): Promise<void> => {
    pendingSave = libraryItems;
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
    }
    return new Promise((resolve, reject) => {
      saveTimer = window.setTimeout(() => {
        saveTimer = null;
        inFlight = flushSave()
          .then(() => {
            inFlight = null;
            resolve();
          })
          .catch((err) => {
            inFlight = null;
            reject(err);
          });
      }, SAVE_DEBOUNCE_MS);
    });
  };

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
        void flushSave();
      }
    });
  }

  return {
    async load() {
      const data = await apiJson<{
        libraryItems?: LibraryItems;
        ok?: boolean;
        error?: string;
      }>("/api/library");
      const items = data.libraryItems ?? [];
      if (items.length === 0) return null;
      return { libraryItems: items };
    },
    async save({ libraryItems }) {
      if (inFlight) {
        await inFlight.catch(() => {});
      }
      await scheduleSave(libraryItems);
    },
  };
}
