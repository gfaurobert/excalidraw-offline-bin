/** MRU recent .excalidraw paths for File → Open Recent. */
import { basename, dirname, join } from "./path.ts";

export const RECENT_MAX = 10;
export const RECENT_MENU_PREFIX = "recent:";
export const CLEAR_RECENT_ID = "clear-recent";

interface RecentFile {
  version: 1;
  paths: string[];
}

export function defaultRecentFilePath(): string {
  let xdg: string | undefined;
  let home: string | undefined;
  try {
    xdg = Deno.env.get("XDG_CONFIG_HOME");
  } catch {
    xdg = undefined;
  }
  try {
    home = Deno.env.get("HOME");
  } catch {
    home = undefined;
  }
  const base = xdg && xdg.length > 0
    ? xdg
    : join(home && home.length > 0 ? home : ".", ".config");
  return join(base, "excalidraw-offline", "recent.json");
}

export function recentMenuId(path: string): string {
  return `${RECENT_MENU_PREFIX}${path}`;
}

export function pathFromRecentMenuId(id: string): string | null {
  if (!id.startsWith(RECENT_MENU_PREFIX)) return null;
  const path = id.slice(RECENT_MENU_PREFIX.length);
  return path.length > 0 ? path : null;
}

export function recentDisplayLabels(paths: readonly string[]): string[] {
  const bases = paths.map((p) => basename(p));
  const counts = new Map<string, number>();
  for (const b of bases) counts.set(b, (counts.get(b) ?? 0) + 1);
  return paths.map((p, i) => {
    const base = bases[i]!;
    if ((counts.get(base) ?? 0) <= 1) return base;
    return `${base} — ${basename(dirname(p))}`;
  });
}

function loadSync(filePath: string): string[] {
  try {
    const raw = Deno.readTextFileSync(filePath);
    const parsed = JSON.parse(raw) as Partial<RecentFile>;
    if (!Array.isArray(parsed.paths)) return [];
    return parsed.paths.filter((p): p is string =>
      typeof p === "string" && p.length > 0
    );
  } catch {
    return [];
  }
}

async function save(filePath: string, paths: string[]): Promise<void> {
  const dir = dirname(filePath);
  await Deno.mkdir(dir, { recursive: true });
  const doc: RecentFile = { version: 1, paths };
  await Deno.writeTextFile(filePath, `${JSON.stringify(doc, null, 2)}\n`);
}

function touchList(paths: string[], path: string, max: number): string[] {
  const next = [path, ...paths.filter((p) => p !== path)];
  return next.slice(0, max);
}

export function createRecentFilesStore(options: {
  filePath: string;
  max?: number;
}) {
  const max = options.max ?? RECENT_MAX;
  let paths = loadSync(options.filePath);

  return {
    list(): string[] {
      return [...paths];
    },
    async touch(path: string): Promise<string[]> {
      const trimmed = path.trim();
      if (!trimmed) return this.list();
      paths = touchList(paths, trimmed, max);
      await save(options.filePath, paths);
      return this.list();
    },
    async remove(path: string): Promise<string[]> {
      paths = paths.filter((p) => p !== path);
      await save(options.filePath, paths);
      return this.list();
    },
    async clear(): Promise<string[]> {
      paths = [];
      await save(options.filePath, paths);
      return this.list();
    },
  };
}
