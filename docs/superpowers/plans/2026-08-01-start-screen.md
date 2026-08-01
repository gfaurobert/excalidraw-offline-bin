# Start Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch into a tldraw-style start screen (New / Open / Recent); open the Excalidraw canvas only after a choice; Close returns home; replace in-app path/discard dialogs with native Zenity/KDialog.

**Architecture:** Frontend owns `mode: "start" | "canvas"`. Desktop adds HTTP endpoints for recent list, open/save pickers, and unsaved Cancel/Save/Discard (same pattern as `/api/pick-image`). Menu keeps accelerators; Close enqueues `{ type: "close" }`. Typed-path React overlays are removed.

**Tech Stack:** Deno Desktop, React/Vite frontend, zenity/kdialog via `desktop/dialogs.ts`, existing `recentStore`.

**Spec:** `docs/superpowers/specs/2026-08-01-start-screen-design.md`

## Global Constraints

- Layout A: bare white start screen; brand + New/Open + Recent; **no** help `?`
- Cold start always shows start screen (no auto-reopen)
- Close / Ctrl+W → start screen; Quit → exit process
- File → New on canvas → blank Untitled on canvas (not start)
- Dirty + path → silent flush; Dirty + Untitled → native Cancel / Save / Discard
- No typed-path fallback when Zenity/KDialog unavailable (status error only)
- Reuse existing `recentStore` / `recent.json`
- Empty recent → muted “No recent files”

## File map

| File | Role |
|------|------|
| `desktop/dialogs.ts` | `buildUnsavedChangesDialogArgs`, `unsavedChangesDialog` |
| `desktop/dialogs_test.ts` | Unit tests for unsaved args builders |
| `desktop/main.ts` | `/api/recent`, `/api/pick-open`, `/api/pick-save`, `/api/unsaved`, `/api/set-mode`; Close menu; drop typed-path menu fallbacks; Save enablement |
| `frontend/public/icon.png` | Brand mark for start screen (copy from `icons/icon.png`) |
| `frontend/src/StartScreen.tsx` | Start screen UI |
| `frontend/src/App.tsx` | Mode switch; wire New/Open/Close/Quit dirty gate; remove PathDialog/ConfirmDialog |
| `use-cases.md` / `README.md` | Document start screen + Close + native dialogs |

---

### Task 1: Native unsaved Cancel / Save / Discard dialog

**Files:**
- Modify: `desktop/dialogs.ts`
- Modify: `desktop/dialogs_test.ts`

**Interfaces:**
- Produces:
  - `export type UnsavedChoice = "save" | "discard" | "cancel"`
  - `export type UnsavedDialogResult = { ok: true; choice: UnsavedChoice } | { ok: false; reason: "unavailable" | "error"; detail?: string }`
  - `buildUnsavedChangesDialogArgs(backend: "zenity" | "kdialog", title: string, text: string): string[]`
  - `unsavedChangesDialog(title?: string, text?: string): Promise<UnsavedDialogResult>`
- Consumes: existing `commandExists`, `runDialog`-style process helpers in `dialogs.ts`

- [ ] **Step 1: Write the failing tests**

Append to `desktop/dialogs_test.ts`:

```ts
import {
  buildUnsavedChangesDialogArgs,
} from "./dialogs.ts";

Deno.test("buildUnsavedChangesDialogArgs zenity", () => {
  assertEquals(
    buildUnsavedChangesDialogArgs(
      "zenity",
      "Unsaved changes",
      "Save this drawing before continuing?",
    ),
    [
      "zenity",
      "--question",
      "--title=Unsaved changes",
      "--text=Save this drawing before continuing?",
      "--ok-label=Save",
      "--cancel-label=Cancel",
      "--extra-button=Discard",
    ],
  );
});

Deno.test("buildUnsavedChangesDialogArgs kdialog", () => {
  assertEquals(
    buildUnsavedChangesDialogArgs(
      "kdialog",
      "Unsaved changes",
      "Save this drawing before continuing?",
    ),
    [
      "kdialog",
      "--title",
      "Unsaved changes",
      "--yesnocancel",
      "Save this drawing before continuing?",
      "--yes-label",
      "Save",
      "--no-label",
      "Discard",
      "--cancel-label",
      "Cancel",
    ],
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test -A desktop/dialogs_test.ts`

Expected: FAIL — `buildUnsavedChangesDialogArgs` not exported / not found

- [ ] **Step 3: Implement args builder + dialog runner**

In `desktop/dialogs.ts`, add (near confirm dialog helpers):

```ts
export type UnsavedChoice = "save" | "discard" | "cancel";

export type UnsavedDialogResult =
  | { ok: true; choice: UnsavedChoice }
  | { ok: false; reason: "unavailable" | "error"; detail?: string };

export function buildUnsavedChangesDialogArgs(
  backend: "zenity" | "kdialog",
  title: string,
  text: string,
): string[] {
  if (backend === "zenity") {
    return [
      "zenity",
      "--question",
      `--title=${title}`,
      `--text=${text}`,
      "--ok-label=Save",
      "--cancel-label=Cancel",
      "--extra-button=Discard",
    ];
  }
  return [
    "kdialog",
    "--title",
    title,
    "--yesnocancel",
    text,
    "--yes-label",
    "Save",
    "--no-label",
    "Discard",
    "--cancel-label",
    "Cancel",
  ];
}

async function runUnsavedCommand(
  backend: "zenity" | "kdialog",
  args: string[],
): Promise<UnsavedDialogResult> {
  try {
    const useSetsid = await commandExists("setsid");
    const cmd = new Deno.Command(useSetsid ? "setsid" : args[0]!, {
      args: useSetsid ? args : args.slice(1),
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout, stderr } = await cmd.output();
    const out = new TextDecoder().decode(stdout).trim();
    const err = new TextDecoder().decode(stderr).trim();

    if (backend === "zenity") {
      // 0 = Save; 1 + "Discard" = Discard; 1 + empty = Cancel
      if (code === 0) return { ok: true, choice: "save" };
      if (code === 1 && out === "Discard") {
        return { ok: true, choice: "discard" };
      }
      if (code === 1) return { ok: true, choice: "cancel" };
      return {
        ok: false,
        reason: "error",
        detail: err || `exit ${code}`,
      };
    }

    // kdialog: 0=Yes/Save, 1=No/Discard, 2=Cancel
    if (code === 0) return { ok: true, choice: "save" };
    if (code === 1) return { ok: true, choice: "discard" };
    if (code === 2) return { ok: true, choice: "cancel" };
    return { ok: false, reason: "error", detail: err || `exit ${code}` };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}

export async function unsavedChangesDialog(
  title = "Unsaved changes",
  text = "This drawing has no file path yet. Save, discard, or cancel?",
): Promise<UnsavedDialogResult> {
  if (await commandExists("zenity")) {
    return await runUnsavedCommand(
      "zenity",
      buildUnsavedChangesDialogArgs("zenity", title, text),
    );
  }
  if (await commandExists("kdialog")) {
    return await runUnsavedCommand(
      "kdialog",
      buildUnsavedChangesDialogArgs("kdialog", title, text),
    );
  }
  return { ok: false, reason: "unavailable", detail: "no zenity/kdialog" };
}
```

Also update the file header comment: remove “Fallback: UI path form” — unavailable is an error now, not a typed-path fallback.

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test -A desktop/dialogs_test.ts`

Expected: PASS (all existing + new unsaved args tests)

- [ ] **Step 5: Commit**

```bash
git add desktop/dialogs.ts desktop/dialogs_test.ts
git commit -m "$(cat <<'EOF'
feat: add native unsaved Cancel/Save/Discard dialog

EOF
)"
```

---

### Task 2: Desktop HTTP APIs, Close menu, drop typed-path fallbacks

**Files:**
- Modify: `desktop/main.ts`

**Interfaces:**
- Consumes: `openExcalidrawDialog`, `saveExcalidrawDialog`, `unsavedChangesDialog`, `recentStore`, `recentDisplayLabels`
- Produces HTTP:
  - `GET /api/recent` → `{ ok: true, paths: string[], labels: string[] }`
  - `POST /api/pick-open` → `{ ok: true, path: string } | { ok: true, cancelled: true } | { ok: false, error }`
  - `POST /api/pick-save` body `{ suggested?: string }` → same shape as pick-open
  - `POST /api/unsaved` → `{ ok: true, choice: "save"|"discard"|"cancel" } | { ok: false, error }`
  - `POST /api/set-mode` body `{ mode: "start"|"canvas" }` → rebuilds menu Save enablement
- Produces menu: `close` id with `CmdOrCtrl+W`; `UiCommand` includes `{ type: "close" }`
- Menu Open/Save/Save As: on picker unavailable → status error only (never enqueue pathless open/save)

- [ ] **Step 1: Extend UiCommand and uiMode state**

Near the top of `desktop/main.ts` (with other `UiCommand` / store declarations):

```ts
type UiCommand =
  | { type: "status"; message: string }
  | { type: "new" }
  | { type: "open"; path?: string }
  | { type: "save"; forcePicker: boolean; path?: string }
  | { type: "close" }
  | { type: "quit" };

type UiMode = "start" | "canvas";
let uiMode: UiMode = "start";
```

Import `unsavedChangesDialog` from `./dialogs.ts`.

- [ ] **Step 2: Update `applyMenu` for Close + Save enablement**

Change signature to `function applyMenu(recentPaths: string[]): void` and use `uiMode`:

File items order:

```ts
// New, Open…, Open Recent, Close (CmdOrCtrl+W), separator,
// Save (enabled: uiMode === "canvas"), Save As… (enabled: uiMode === "canvas"),
// separator, Quit
```

Close item:

```ts
{
  item: {
    label: "Close",
    id: "close",
    accelerator: "CmdOrCtrl+W",
    enabled: true,
  },
},
```

Save / Save As: `enabled: uiMode === "canvas"`.

- [ ] **Step 3: Add API handlers in `handleApi`**

After `/api/info` (or near other API routes), add:

```ts
if (pathname === "/api/recent" && method === "GET") {
  const paths = recentStore.list();
  return json({
    ok: true,
    paths,
    labels: recentDisplayLabels(paths),
  });
}

if (pathname === "/api/set-mode" && method === "POST") {
  const body = await readJson<{ mode?: string }>(req);
  if (body.mode !== "start" && body.mode !== "canvas") {
    return json({ ok: false, error: "invalid mode" }, 400);
  }
  uiMode = body.mode;
  applyMenu(recentStore.list());
  return json({ ok: true, mode: uiMode });
}

if (pathname === "/api/pick-open" && method === "POST") {
  const picked = await openExcalidrawDialog();
  if (picked.ok) return json({ ok: true, path: picked.path });
  if (picked.reason === "cancelled") {
    return json({ ok: true, cancelled: true });
  }
  if (picked.reason === "unavailable") {
    return json({ ok: false, error: "no file picker available" }, 501);
  }
  return json({ ok: false, error: picked.detail ?? picked.reason }, 500);
}

if (pathname === "/api/pick-save" && method === "POST") {
  const body = await readJson<{ suggested?: string }>(req);
  const suggested = body.suggested?.trim() || "drawing.excalidraw";
  const picked = await saveExcalidrawDialog(suggested);
  if (picked.ok) return json({ ok: true, path: picked.path });
  if (picked.reason === "cancelled") {
    return json({ ok: true, cancelled: true });
  }
  if (picked.reason === "unavailable") {
    return json({ ok: false, error: "no file picker available" }, 501);
  }
  return json({ ok: false, error: picked.detail ?? picked.reason }, 500);
}

if (pathname === "/api/unsaved" && method === "POST") {
  const result = await unsavedChangesDialog();
  if (result.ok) return json({ ok: true, choice: result.choice });
  if (result.reason === "unavailable") {
    return json({ ok: false, error: "no dialog available" }, 501);
  }
  return json({ ok: false, error: result.detail ?? result.reason }, 500);
}
```

- [ ] **Step 4: Fix menu Open/Save/Save As fallbacks + handle Close**

In `menuclick` for `open` / `save` / `save-as`, replace the unavailable branches that currently do `enqueueUi({ type: "open" })` or `forcePicker: true` with:

```ts
enqueueUi({
  type: "status",
  message: "File picker unavailable (install zenity or kdialog)",
});
```

Add case:

```ts
case "close":
  enqueueUi({ type: "close" });
  break;
```

- [ ] **Step 5: Smoke-check types**

Run: `deno check desktop/main.ts` (or `deno test -A desktop/dialogs_test.ts desktop/recent-files_test.ts` if `deno check` complains about desktop types)

Expected: no errors related to new imports / UiCommand

- [ ] **Step 6: Commit**

```bash
git add desktop/main.ts
git commit -m "$(cat <<'EOF'
feat: add start-screen desktop APIs and Close menu

EOF
)"
```

---

### Task 3: StartScreen component

**Files:**
- Create: `frontend/src/StartScreen.tsx`
- Create: `frontend/public/icon.png` (copy from `icons/icon.png`)

**Interfaces:**
- Produces:
  ```ts
  export interface StartScreenProps {
    recent: { path: string; label: string }[];
    onNew: () => void;
    onOpen: () => void;
    onOpenRecent: (path: string) => void;
  }
  export function StartScreen(props: StartScreenProps): JSX.Element
  ```
- Consumes: none (pure presentational + click handlers)

- [ ] **Step 1: Copy brand icon into frontend public assets**

```bash
cp icons/icon.png frontend/public/icon.png
```

Vite will serve it as `/icon.png`.

- [ ] **Step 2: Create `StartScreen.tsx`**

```tsx
export interface StartScreenProps {
  recent: { path: string; label: string }[];
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: 280,
  padding: "0.55rem 0",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: "1rem",
  color: "#1e1e1e",
  fontFamily: "system-ui, sans-serif",
};

const shortcutStyle: React.CSSProperties = {
  color: "#868e96",
  fontSize: "0.95rem",
};

export function StartScreen(props: StartScreenProps) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "0.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1.75rem",
          }}
        >
          <img
            src="/icon.png"
            alt=""
            width={40}
            height={40}
            style={{ borderRadius: 8 }}
          />
          <div style={{ fontSize: "1.35rem", color: "#1e1e1e" }}>
            <strong>Excalidraw</strong>{" "}
            <em style={{ fontStyle: "italic", fontWeight: 400 }}>offline</em>
          </div>
        </div>

        <button type="button" style={rowStyle} onClick={props.onNew}>
          <span>New file</span>
          <span style={shortcutStyle}>Ctrl N</span>
        </button>
        <button type="button" style={rowStyle} onClick={props.onOpen}>
          <span>Open file</span>
          <span style={shortcutStyle}>Ctrl O</span>
        </button>

        <div
          style={{
            width: 280,
            height: 1,
            background: "#dee2e6",
            margin: "1rem 0 0.75rem",
          }}
        />

        <div
          style={{
            color: "#868e96",
            fontSize: "0.85rem",
            marginBottom: "0.35rem",
          }}
        >
          Recent files
        </div>

        {props.recent.length === 0 ? (
          <div style={{ color: "#adb5bd", fontSize: "0.95rem", padding: "0.35rem 0" }}>
            No recent files
          </div>
        ) : (
          props.recent.map((item) => (
            <button
              key={item.path}
              type="button"
              style={rowStyle}
              onClick={() => props.onOpenRecent(item.path)}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 240,
                  textAlign: "left",
                }}
              >
                {item.label}
              </span>
              <span style={shortcutStyle}>{">"}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck frontend**

Run: `cd frontend && deno task build`

Expected: may still fail if `App.tsx` does not import `StartScreen` yet — if so, only confirm `StartScreen.tsx` has no local type errors by temporarily importing it in `App.tsx` in Task 4. Alternatively run `deno task build` after Task 4. For this task, ensure the file is saved and icon exists:

```bash
test -f frontend/public/icon.png && test -f frontend/src/StartScreen.tsx
```

Expected: both exist

- [ ] **Step 4: Commit**

```bash
git add frontend/src/StartScreen.tsx frontend/public/icon.png
git commit -m "$(cat <<'EOF'
feat: add StartScreen UI component

EOF
)"
```

---

### Task 4: Wire App mode, dirty gate, remove in-app dialogs

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `StartScreen`, `/api/recent`, `/api/pick-open`, `/api/pick-save`, `/api/unsaved`, `/api/set-mode`, `/api/read`, `/api/write`, `/api/set-path`, `/api/set-title`, `/api/quit`
- Produces: `mode` state; handlers `enterCanvas`, `returnToStart`, `ensureSavedOrDiscarded`, `runClose`; poll handles `close`
- Removes: `PathDialog`, `ConfirmDialog`, `askPath`, `askConfirm`, `PathDialogState`, `ConfirmDialogState`

- [ ] **Step 1: Add mode + recent state; notify desktop**

At top of `App` component state:

```ts
type AppMode = "start" | "canvas";
const [mode, setMode] = useState<AppMode>("start");
const [recent, setRecent] = useState<{ path: string; label: string }[]>([]);
```

Helpers:

```ts
async function notifyMode(next: AppMode): Promise<void> {
  try {
    await apiJson("/api/set-mode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
  } catch {
    // non-fatal
  }
}

async function refreshRecent(): Promise<void> {
  try {
    const data = await apiJson<{
      paths: string[];
      labels: string[];
    }>("/api/recent");
    setRecent(
      data.paths.map((path, i) => ({
        path,
        label: data.labels[i] ?? path.split("/").pop() ?? path,
      })),
    );
  } catch (err) {
    await apiLog("error", `recent refresh failed: ${String(err)}`);
  }
}
```

On mount (after `/api/info` succeeds), call `refreshRecent()` and `notifyMode("start")`.

When `mode` changes via `setMode`, always call `void notifyMode(next)`.

- [ ] **Step 2: Implement dirty gate using native `/api/unsaved` + pick-save**

Replace discard confirm + path dialogs with:

```ts
type DirtyGateResult = "proceed" | "abort";

async function flushIfPathed(): Promise<boolean> {
  if (!pathRef.current || !dirtyRef.current) return true;
  return await writeSceneToPath(pathRef.current);
}

async function pickSavePath(suggested?: string): Promise<string | null> {
  const data = await apiJson<{
    path?: string;
    cancelled?: boolean;
  }>("/api/pick-save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      suggested: suggested ?? `${homeRef.current}/drawing.excalidraw`,
    }),
  });
  if (data.cancelled || !data.path) return null;
  return data.path;
}

async function ensureCleanForNavigation(): Promise<DirtyGateResult> {
  if (!dirtyRef.current) return "proceed";

  // Has path: silent flush
  if (pathRef.current) {
    const ok = await flushIfPathed();
    return ok ? "proceed" : "abort";
  }

  // Untitled dirty: Cancel / Save / Discard
  const result = await apiJson<{ choice: "save" | "discard" | "cancel" }>(
    "/api/unsaved",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  if (result.choice === "cancel") return "abort";
  if (result.choice === "discard") return "proceed";

  const path = await pickSavePath();
  if (!path) {
    setStatus("Save cancelled");
    return "abort";
  }
  const saved = await writeSceneToPath(path);
  return saved ? "proceed" : "abort";
}
```

Wrap `apiJson` error handling so unavailable dialogs set status and return `"abort"` (try/catch around `/api/unsaved` and pick helpers).

- [ ] **Step 3: Rewrite runNew / runOpen / runSave / runQuit / add runClose**

**`runNew`:**
1. If `mode === "canvas"`: `ensureCleanForNavigation()`; abort if needed
2. Reset path/scene/docKey as today
3. `setMode("canvas")`; `notifyMode("canvas")`
4. Status “New drawing”

**`runOpen(presetPath?)`:**
1. If `mode === "canvas"`: dirty gate; abort if needed
2. Resolve path: if `presetPath` use it; else `POST /api/pick-open` (cancel → return)
3. `/api/read` as today; on success `setMode("canvas")`, `notifyMode("canvas")`, `refreshRecent()`
4. On failure from start: stay on start; from canvas: stay on canvas

**`runSave(forcePicker, presetPath?)`:**
1. If `mode !== "canvas"`: return false
2. Never call typed path dialog. If need picker (`forcePicker` or no path and no preset): `pickSavePath()`; cancel → false
3. `writeSceneToPath` as today

**`runClose`:**
1. If `mode !== "canvas"`: return
2. Dirty gate; abort if needed
3. Clear path/scene refs; `POST /api/set-path` null; reset initialData/docKey lightly or leave unmounted
4. `setMode("start")`; `notifyMode("start")`; `refreshRecent()`; `updateTitle(null, false)`; status “”

**`runQuit`:**
1. If `mode === "start"`: can quit immediately via `/api/quit` (nothing dirty)
2. If canvas: dirty gate (same as above — path flush or unsaved dialog); abort → `notifyQuitAborted`
3. Then `/api/quit` as today

- [ ] **Step 4: Poll `close`; remove PathDialog / ConfirmDialog**

Extend `UiCommand`:

```ts
interface UiCommand {
  type: "status" | "new" | "open" | "save" | "close" | "quit";
  message?: string;
  forcePicker?: boolean;
  path?: string;
}
```

In poll switch, add `case "close": setTimeout(() => void runClose(), 0);`

Delete `PathDialog`, `ConfirmDialog`, `askPath`, `askConfirm`, and related state/refs (`pathDialog`, `confirmDialog`, `pathDialogResolve`, `pathDialogOpenRef`). Update poll effect deps (drop dialog guards that only existed for those overlays; keep `busyRef`).

For autosave skip condition, remove `pathDialogOpenRef` check (or replace with a `nativeDialogBusyRef` set true while awaiting `/api/unsaved` or pick endpoints).

- [ ] **Step 5: Render by mode**

```tsx
if (mode === "start") {
  return (
    <StartScreen
      recent={recent}
      onNew={() => void runNew()}
      onOpen={() => void runOpen()}
      onOpenRecent={(path) => void runOpen(path)}
    />
  );
}

// existing canvas layout (header + Excalidraw), without PathDialog/ConfirmDialog
```

Keep the poll `useEffect` mounted in both modes (move hooks above the early return — **do not** conditionally call hooks). Structure:

```tsx
// all hooks first
return mode === "start" ? (
  <StartScreen ... />
) : (
  <div>...header + Excalidraw...</div>
);
```

- [ ] **Step 6: Build frontend**

Run:

```bash
cd frontend && deno task build
```

Expected: `tsc -b && vite build` succeeds

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "$(cat <<'EOF'
feat: wire start/canvas mode and native dirty dialogs

EOF
)"
```

---

### Task 5: Docs + manual verification

**Files:**
- Modify: `use-cases.md`
- Modify: `README.md`

**Interfaces:**
- None (documentation only)

- [ ] **Step 1: Update `use-cases.md` launch section**

Under “### 1) Launch Excalidraw App”, add:

```markdown
- Cold start shows a start screen (New file / Open file / Recent files). Excalidraw canvas mounts only after the user chooses an action.
- File → Close (Ctrl+W) returns to the start screen. Quit exits the app.
- Unsaved Untitled drawings use a native Cancel / Save / Discard dialog (zenity/kdialog). Open/Save path prompts are native file pickers only.
```

- [ ] **Step 2: Update `README.md` features**

Add bullets under Features (MVP):

```markdown
- Start screen on launch (New / Open / Recent); canvas opens after a choice
- File → Close returns to the start screen; Quit exits
- Native zenity/kdialog for open/save and unsaved Cancel/Save/Discard
```

- [ ] **Step 3: Manual acceptance checklist**

Run the app:

```bash
cd frontend && deno task build && cd ..
deno task start
```

Verify:

1. Launch → start screen only (no Excalidraw chrome)
2. New → blank canvas; Close → start; recent refreshes after save
3. Open via button and File menu → Zenity → canvas
4. Recent row opens; deleted path → error + removed
5. Untitled dirty Close → Cancel / Discard / Save behaviors
6. Pathed dirty Close → silent save → start
7. Quit exits process
8. No React path/discard overlays

- [ ] **Step 4: Commit**

```bash
git add use-cases.md README.md
git commit -m "$(cat <<'EOF'
docs: document start screen and native dialogs

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Layout A, no help `?` | Task 3 |
| Cold start → start screen | Task 4 |
| Close → start; Quit → exit | Tasks 2, 4 |
| New on canvas stays on canvas | Task 4 |
| Full menus on start | Task 2 (Save disabled on start) |
| Dirty path flush / Untitled unsaved dialog | Tasks 1, 4 |
| Native pickers; no typed-path | Tasks 2, 4 |
| `/api/recent`, pick-open/save, unsaved | Task 2 |
| Recent from `recentStore` | Task 2 |
| Empty recent message | Task 3 |
| Unit tests for unsaved args | Task 1 |
| Docs | Task 5 |

No TBD/TODO placeholders. Names consistent: `unsavedChangesDialog`, `UnsavedChoice`, `/api/set-mode`, `runClose`, `StartScreen`.
