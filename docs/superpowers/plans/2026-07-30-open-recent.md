# Open Recent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Edit menu and add File → Open Recent (submenu, max 10, XDG-persisted) that reopens drawings via the existing open command path.

**Architecture:** A desktop-owned `recent-files` store persists MRU paths under XDG config. Successful `/api/read` and `/api/write` call `touch` and rebuild the application menu. Open Recent entries enqueue `{ type: "open", path }`; missing paths are dropped with a status message.

**Tech Stack:** Deno Desktop (`Deno.BrowserWindow.setApplicationMenu`), local HTTP command queue, existing React open flow in `frontend/src/App.tsx` (unchanged).

**Spec:** `docs/superpowers/specs/2026-07-30-open-recent-design.md`

## Global Constraints

- Edit menu removed entirely (keyboard shortcuts stay with Excalidraw)
- Open Recent submenu: max 10, most-recent first
- Record only after successful `/api/read` and `/api/write` (not cancelled pickers, failed writes, or `/api/set-path` alone)
- Missing recent path on click → status error, remove entry, rebuild menu; do not enqueue open
- Clear Recent at bottom of submenu (disabled when empty)
- Open Recent reuses `{ type: "open", path }` (same dirty-save flow as File → Open)
- Persist at `$XDG_CONFIG_HOME/excalidraw-offline/recent.json` (fallback `~/.config/excalidraw-offline/recent.json`)
- No frontend changes required

## File map

| File | Role |
|------|------|
| `desktop/recent-files.ts` | Persist MRU list; touch/remove/clear/list; menu id helpers; display labels |
| `desktop/recent-files_test.ts` | Unit tests (temp file + pure helpers) |
| `desktop/main.ts` | Drop Edit; Open Recent submenu; rebuild on change; touch after read/write; menu handlers |
| `deno.json` | Include `recent-files_test.ts` in test task |
| `use-cases.md` | Add Open Recent; remove from non-goals |
| `README.md` | Mention Open Recent in features |

---

### Task 1: Recent files store (unit-tested)

**Files:**
- Create: `desktop/recent-files.ts`
- Create: `desktop/recent-files_test.ts`
- Modify: `deno.json` (test task include list)

**Interfaces:**
- Produces:
  - `RECENT_MAX = 10`
  - `RECENT_MENU_PREFIX = "recent:"`
  - `CLEAR_RECENT_ID = "clear-recent"`
  - `defaultRecentFilePath(): string`
  - `createRecentFilesStore(options: { filePath: string; max?: number }): { list(): string[]; touch(path: string): Promise<string[]>; remove(path: string): Promise<string[]>; clear(): Promise<string[]> }`
  - `recentMenuId(path: string): string`
  - `pathFromRecentMenuId(id: string): string | null`
  - `recentDisplayLabels(paths: readonly string[]): string[]`

- [ ] **Step 1: Write the failing tests**

Create `desktop/recent-files_test.ts`:

```ts
import { assertEquals } from "jsr:@std/assert@1";
import { join } from "./path.ts";
import {
  CLEAR_RECENT_ID,
  RECENT_MAX,
  createRecentFilesStore,
  pathFromRecentMenuId,
  recentDisplayLabels,
  recentMenuId,
} from "./recent-files.ts";

Deno.test("recentMenuId / pathFromRecentMenuId round-trip", () => {
  const path = "/home/u/sketches/demo.excalidraw";
  assertEquals(recentMenuId(path), `recent:${path}`);
  assertEquals(pathFromRecentMenuId(recentMenuId(path)), path);
  assertEquals(pathFromRecentMenuId("clear-recent"), null);
  assertEquals(pathFromRecentMenuId("open"), null);
  assertEquals(CLEAR_RECENT_ID, "clear-recent");
});

Deno.test("recentDisplayLabels uses basename; disambiguates collisions", () => {
  assertEquals(
    recentDisplayLabels(["/a/one.excalidraw", "/b/two.excalidraw"]),
    ["one.excalidraw", "two.excalidraw"],
  );
  assertEquals(
    recentDisplayLabels([
      "/projects/alpha/drawing.excalidraw",
      "/projects/beta/drawing.excalidraw",
    ]),
    ["drawing.excalidraw — alpha", "drawing.excalidraw — beta"],
  );
});

Deno.test("touch bumps, dedupes, and caps at RECENT_MAX", async () => {
  const dir = await Deno.makeTempDir();
  const filePath = join(dir, "recent.json");
  const store = createRecentFilesStore({ filePath, max: RECENT_MAX });

  assertEquals(store.list(), []);

  await store.touch("/tmp/a.excalidraw");
  await store.touch("/tmp/b.excalidraw");
  await store.touch("/tmp/a.excalidraw");
  assertEquals(store.list(), ["/tmp/a.excalidraw", "/tmp/b.excalidraw"]);

  for (let i = 0; i < 12; i++) {
    await store.touch(`/tmp/f${i}.excalidraw`);
  }
  const list = store.list();
  assertEquals(list.length, 10);
  assertEquals(list[0], "/tmp/f11.excalidraw");
  assertEquals(list.includes("/tmp/f0.excalidraw"), false);
  assertEquals(list.includes("/tmp/f1.excalidraw"), false);

  await Deno.remove(dir, { recursive: true });
});

Deno.test("remove and clear persist", async () => {
  const dir = await Deno.makeTempDir();
  const filePath = join(dir, "recent.json");
  const store = createRecentFilesStore({ filePath });

  await store.touch("/tmp/a.excalidraw");
  await store.touch("/tmp/b.excalidraw");
  await store.remove("/tmp/a.excalidraw");
  assertEquals(store.list(), ["/tmp/b.excalidraw"]);

  await store.clear();
  assertEquals(store.list(), []);

  const reloaded = createRecentFilesStore({ filePath });
  assertEquals(reloaded.list(), []);

  await Deno.remove(dir, { recursive: true });
});

Deno.test("load missing or corrupt file yields empty list", async () => {
  const dir = await Deno.makeTempDir();
  const missing = createRecentFilesStore({
    filePath: join(dir, "nope.json"),
  });
  assertEquals(missing.list(), []);

  const corruptPath = join(dir, "bad.json");
  await Deno.writeTextFile(corruptPath, "{not-json");
  const corrupt = createRecentFilesStore({ filePath: corruptPath });
  assertEquals(corrupt.list(), []);

  await storeTouchAndReload(dir);
  await Deno.remove(dir, { recursive: true });
});

async function storeTouchAndReload(dir: string): Promise<void> {
  const filePath = join(dir, "ok.json");
  const store = createRecentFilesStore({ filePath });
  await store.touch("/tmp/z.excalidraw");
  const again = createRecentFilesStore({ filePath });
  assertEquals(again.list(), ["/tmp/z.excalidraw"]);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test -A desktop/recent-files_test.ts`

Expected: FAIL (module `./recent-files.ts` not found)

- [ ] **Step 3: Write minimal implementation**

Create `desktop/recent-files.ts`:

```ts
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
```

Note: `emptyDoc` may be unused — omit it if the linter complains; keep load/save as above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test -A desktop/recent-files_test.ts`

Expected: PASS (all tests in the file)

- [ ] **Step 5: Wire into deno test task**

In `deno.json`, change `test:file-format` to:

```json
"test:file-format": "deno test -A desktop/file-format_test.ts desktop/path_test.ts desktop/dialogs_test.ts desktop/close-guard_test.ts desktop/recent-files_test.ts"
```

Run: `deno task test:file-format`

Expected: all existing tests + recent-files PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/recent-files.ts desktop/recent-files_test.ts deno.json
git commit -m "$(cat <<'EOF'
feat: add recent files store for Open Recent

EOF
)"
```

---

### Task 2: File menu — remove Edit, add Open Recent, wire handlers

**Files:**
- Modify: `desktop/main.ts`

**Interfaces:**
- Consumes: `createRecentFilesStore`, `defaultRecentFilePath`, `recentMenuId`, `pathFromRecentMenuId`, `recentDisplayLabels`, `CLEAR_RECENT_ID` from `./recent-files.ts`
- Produces: `applyMenu(paths: string[]): void` (local); menu ids `recent:<path>` and `clear-recent`; on missing path → status + remove + rebuild; on ok → `enqueueUi({ type: "open", path })`

- [ ] **Step 1: Import recent-files and create the store**

Near the top of `desktop/main.ts` (with other imports), add:

```ts
import {
  CLEAR_RECENT_ID,
  createRecentFilesStore,
  defaultRecentFilePath,
  pathFromRecentMenuId,
  recentDisplayLabels,
  recentMenuId,
} from "./recent-files.ts";
```

After `const closeGuard = createCloseGuard();`, add:

```ts
const recentStore = createRecentFilesStore({
  filePath: defaultRecentFilePath(),
});
```

- [ ] **Step 2: Replace static `setApplicationMenu` with `applyMenu`**

Remove the Edit submenu block entirely. Replace the single `win.setApplicationMenu([...])` call with a function that rebuilds File (including Open Recent) and apply it on startup:

```ts
function applyMenu(recentPaths: string[]): void {
  const labels = recentDisplayLabels(recentPaths);
  const recentItems: Deno.MenuItem[] = recentPaths.length === 0
    ? [{
      item: {
        label: "(No recent files)",
        id: "recent-empty",
        enabled: false,
      },
    }]
    : recentPaths.map((path, i) => ({
      item: {
        label: labels[i]!,
        id: recentMenuId(path),
        enabled: true,
      },
    }));

  recentItems.push("separator");
  recentItems.push({
    item: {
      label: "Clear Recent",
      id: CLEAR_RECENT_ID,
      enabled: recentPaths.length > 0,
    },
  });

  win.setApplicationMenu([
    {
      submenu: {
        label: "File",
        items: [
          {
            item: {
              label: "New",
              id: "new",
              accelerator: "CmdOrCtrl+N",
              enabled: true,
            },
          },
          {
            item: {
              label: "Open…",
              id: "open",
              accelerator: "CmdOrCtrl+O",
              enabled: true,
            },
          },
          {
            submenu: {
              label: "Open Recent",
              items: recentItems,
            },
          },
          "separator",
          {
            item: {
              label: "Save",
              id: "save",
              accelerator: "CmdOrCtrl+S",
              enabled: true,
            },
          },
          {
            item: {
              label: "Save As…",
              id: "save-as",
              accelerator: "CmdOrCtrl+Shift+S",
              enabled: true,
            },
          },
          "separator",
          {
            item: {
              label: "Quit",
              id: "quit",
              accelerator: "CmdOrCtrl+Q",
              enabled: true,
            },
          },
        ],
      },
    },
  ]);
}

applyMenu(recentStore.list());
```

Place `applyMenu` + the initial `applyMenu(recentStore.list())` where the old `win.setApplicationMenu([...])` lived (after `win` exists, before or after the `menuclick` listener — both fine as long as menu is set before user interaction).

- [ ] **Step 3: Handle Open Recent and Clear Recent in `menuclick`**

In the `menuclick` switch, before `default`, add:

```ts
      case CLEAR_RECENT_ID:
        await recentStore.clear();
        applyMenu(recentStore.list());
        enqueueUi({ type: "status", message: "Recent files cleared" });
        break;
```

Also before `default`, handle recent ids (not a single `case` — use a prefix check). Structure the switch like this for the new branches — either extend the switch with a fall-through pattern or handle before the switch:

Preferred: at the start of the async IIFE, before `switch (id)`:

```ts
    const recentPath = pathFromRecentMenuId(id);
    if (recentPath) {
      try {
        await Deno.stat(recentPath);
        enqueueUi({ type: "open", path: recentPath });
      } catch {
        enqueueUi({
          type: "status",
          message: `Recent file missing: ${recentPath}`,
        });
        await recentStore.remove(recentPath);
        applyMenu(recentStore.list());
      }
      return;
    }
```

Keep `case CLEAR_RECENT_ID` inside the switch as shown above.

- [ ] **Step 4: Smoke-check TypeScript / run unit tests**

Run: `deno check desktop/main.ts` (or `deno test -A desktop/recent-files_test.ts` if `deno check` is awkward under desktop types)

Expected: no type errors related to the new menu / imports; recent-files tests still PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/main.ts
git commit -m "$(cat <<'EOF'
feat: add Open Recent submenu and drop Edit menu

EOF
)"
```

---

### Task 3: Record recent paths on successful read/write

**Files:**
- Modify: `desktop/main.ts` (`/api/read` and `/api/write` success paths)

**Interfaces:**
- Consumes: `recentStore.touch`, `applyMenu`
- Produces: after successful write/read, MRU updated and menu rebuilt

- [ ] **Step 1: Touch after successful `/api/write`**

In the `/api/write` handler, inside the `try` after `await writeScene(path, payload);` and title update, before `return json({ ok: true, path })`:

```ts
      await recentStore.touch(path);
      applyMenu(recentStore.list());
```

Full success block should look like:

```ts
    try {
      await writeScene(path, payload);
      currentPath = path;
      win.setTitle(`Excalidraw Offline — ${path}`);
      console.log("[write] done", path);
      await recentStore.touch(path);
      applyMenu(recentStore.list());
      return json({ ok: true, path });
    } catch (err) {
```

- [ ] **Step 2: Touch after successful `/api/read`**

In the `/api/read` handler success path, after setting title / logging, before `return json(...)`:

```ts
      await recentStore.touch(path);
      applyMenu(recentStore.list());
```

Full success block should look like:

```ts
    try {
      const scene = await readScene(path);
      currentPath = path;
      win.setTitle(`Excalidraw Offline — ${path}`);
      console.log(
        "[read] done",
        path,
        "elements",
        scene.elements?.length ?? 0,
      );
      await recentStore.touch(path);
      applyMenu(recentStore.list());
      return json({ ok: true, path, ...scene });
    } catch (err) {
```

Do **not** call `touch` from `/api/set-path`.

- [ ] **Step 3: Run unit tests**

Run: `deno task test:file-format`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add desktop/main.ts
git commit -m "$(cat <<'EOF'
feat: record recent files after open and save

EOF
)"
```

---

### Task 4: Docs + manual acceptance

**Files:**
- Modify: `use-cases.md`
- Modify: `README.md`

- [ ] **Step 1: Update use-cases.md**

In `## Explicit non-goals for first version`, **remove** the line:

```md
- Recent files list
```

Under clarifications for open (section `### 2) Open a `.excalidraw` file`), append:

```md
- File → Open Recent lists up to 10 recently opened/saved paths (persisted under XDG config). Missing paths are removed from the list when selected.
```

- [ ] **Step 2: Update README.md**

In `## Features (MVP)`, add a bullet:

```md
- File → Open Recent (up to 10 paths, persisted locally)
```

- [ ] **Step 3: Manual acceptance (run the app)**

Run: `deno task start`

Checklist (from spec):

1. Edit menu gone; Ctrl+Z / clipboard still work in Excalidraw
2. Open a file → appears under Open Recent
3. Save As to a new path → that path is #1
4. Re-open an older recent → it moves to top
5. Delete a recent file on disk, pick it → error status, entry removed
6. Clear Recent → empty placeholder
7. Restart app → list persists
8. Open Recent with dirty canvas → same save prompt as File → Open

- [ ] **Step 4: Commit docs**

```bash
git add use-cases.md README.md
git commit -m "$(cat <<'EOF'
docs: document Open Recent in README and use-cases

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Remove Edit menu | Task 2 |
| Open Recent nested submenu | Task 2 |
| Cap 10, MRU | Task 1 + 3 |
| Record on read/write success | Task 3 |
| Missing path → error + remove + rebuild | Task 2 |
| Clear Recent | Task 2 |
| XDG recent.json | Task 1 |
| Startup load + menu | Task 2 |
| Reuse `{ type: "open", path }` | Task 2 |
| No `/api/set-path` recording | Task 3 (explicit non-call) |
| Unit tests | Task 1 |
| Docs / non-goals update | Task 4 |
| Manual acceptance | Task 4 |

No placeholders. Interface names consistent across tasks (`createRecentFilesStore`, `applyMenu`, `CLEAR_RECENT_ID`, `recentMenuId` / `pathFromRecentMenuId`).
