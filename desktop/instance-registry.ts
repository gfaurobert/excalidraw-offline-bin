/** XDG runtime registry for single-instance file-open handoff. */
import { join } from "./path.ts";
import {
  defaultRegistryDir as registryDirFromPlatform,
  isProcessAlive,
} from "./platform.ts";

export type InstanceState = "start" | "untitled" | "pathed";

export interface InstanceRecord {
  pid: number;
  port: number;
  state: InstanceState;
  path: string | null;
  lastFocusedAt: number;
}

export function defaultRegistryDir(): string {
  return registryDirFromPlatform();
}

export function instanceFilePath(dir: string, pid: number): string {
  return join(dir, `${pid}.json`);
}

export function deriveInstanceState(
  uiMode: "start" | "canvas",
  currentPath: string | null,
): InstanceState {
  if (uiMode === "start") return "start";
  if (currentPath) return "pathed";
  return "untitled";
}

export { isProcessAlive };

function readRecord(filePath: string): InstanceRecord | null {
  try {
    const raw = Deno.readTextFileSync(filePath);
    const parsed = JSON.parse(raw) as Partial<InstanceRecord>;
    if (
      typeof parsed.pid !== "number" ||
      typeof parsed.port !== "number" ||
      (parsed.state !== "start" &&
        parsed.state !== "untitled" &&
        parsed.state !== "pathed") ||
      typeof parsed.lastFocusedAt !== "number"
    ) {
      return null;
    }
    const path = parsed.path === undefined
      ? null
      : parsed.path === null || typeof parsed.path === "string"
      ? parsed.path
      : null;
    return {
      pid: parsed.pid,
      port: parsed.port,
      state: parsed.state,
      path,
      lastFocusedAt: parsed.lastFocusedAt,
    };
  } catch {
    return null;
  }
}

export async function writeInstanceRecord(
  dir: string,
  record: InstanceRecord,
): Promise<void> {
  await Deno.mkdir(dir, { recursive: true });
  const filePath = instanceFilePath(dir, record.pid);
  await Deno.writeTextFile(
    filePath,
    `${JSON.stringify(record, null, 2)}\n`,
  );
}

export async function removeInstanceRecord(
  dir: string,
  pid: number,
): Promise<void> {
  try {
    await Deno.remove(instanceFilePath(dir, pid));
  } catch {
    // ignore missing
  }
}

export function listInstanceRecords(
  dir: string,
  options?: { isAlive?: (pid: number) => boolean },
): InstanceRecord[] {
  const isAlive = options?.isAlive ?? isProcessAlive;
  let names: string[];
  try {
    names = [];
    for (const entry of Deno.readDirSync(dir)) {
      if (entry.isFile && entry.name.endsWith(".json")) names.push(entry.name);
    }
  } catch {
    return [];
  }
  const out: InstanceRecord[] = [];
  for (const name of names) {
    const rec = readRecord(join(dir, name));
    if (!rec) continue;
    if (!isAlive(rec.pid)) {
      try {
        Deno.removeSync(join(dir, name));
      } catch {
        // ignore
      }
      continue;
    }
    out.push(rec);
  }
  return out;
}

/**
 * Prefer most recently focused instance that can accept an external open
 * (`start` or `pathed`). Untitled instances are never chosen.
 */
export function pickHandoffTarget(
  records: readonly InstanceRecord[],
  excludePid?: number,
): InstanceRecord | null {
  const eligible = records.filter((r) =>
    r.pid !== excludePid && (r.state === "start" || r.state === "pathed")
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => b.lastFocusedAt - a.lastFocusedAt);
  return eligible[0] ?? null;
}

export function createInstanceRegistry(options?: {
  dir?: string;
  isAlive?: (pid: number) => boolean;
}) {
  const dir = options?.dir ?? defaultRegistryDir();
  const isAlive = options?.isAlive;

  return {
    dir,
    async write(record: InstanceRecord): Promise<void> {
      await writeInstanceRecord(dir, record);
    },
    async remove(pid: number): Promise<void> {
      await removeInstanceRecord(dir, pid);
    },
    list(): InstanceRecord[] {
      return listInstanceRecords(dir, { isAlive });
    },
    pickHandoffTarget(excludePid?: number): InstanceRecord | null {
      return pickHandoffTarget(this.list(), excludePid);
    },
  };
}
