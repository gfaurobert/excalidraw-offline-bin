/**
 * macOS native dialogs via /usr/bin/osascript (AppleScript).
 *
 * Same rule as zenity: run from the Deno menu/HTTP handler, never inside a
 * webview binding call.
 */
import { homeDir } from "./platform.ts";

type DialogResult =
  | { ok: true; path: string }
  | {
    ok: false;
    reason: "cancelled" | "unavailable" | "error";
    detail?: string;
  };

type InfoDialogResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "error"; detail?: string };

type ChoiceDialogResult =
  | { ok: true; id: string }
  | {
    ok: false;
    reason: "cancelled" | "unavailable" | "error";
    detail?: string;
  };

type ConfirmDialogResult =
  | { ok: true; confirmed: boolean }
  | { ok: false; reason: "unavailable" | "error"; detail?: string };

type UnsavedChoice = "save" | "discard" | "cancel";

type UnsavedDialogResult =
  | { ok: true; choice: UnsavedChoice }
  | { ok: false; reason: "unavailable" | "error"; detail?: string };

interface ChoiceOption {
  id: string;
  label: string;
}

function ensureExcalidrawExt(path: string): string {
  return path.endsWith(".excalidraw") ? path : `${path}.excalidraw`;
}

/** Quote a JS string as an AppleScript string literal. */
export function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function posixFileLiteral(path: string): string {
  return `POSIX file ${appleScriptString(path)}`;
}

function splitDefaultPath(defaultNameOrPath: string): { dir: string; name: string } {
  const slash = defaultNameOrPath.replace(/\\/g, "/");
  const last = slash.lastIndexOf("/");
  if (last < 0) {
    return { dir: homeDir(), name: slash || "drawing.excalidraw" };
  }
  return {
    dir: slash.slice(0, last) || "/",
    name: slash.slice(last + 1) || "drawing.excalidraw",
  };
}

export function buildMacOpenFileScript(
  title: string,
  startDir: string,
  ofType: string[],
): string {
  const types = ofType.map((t) => appleScriptString(t)).join(", ");
  const typeClause = ofType.length > 0 ? ` of type {${types}}` : "";
  return `try
  set theFile to choose file with prompt ${appleScriptString(title)}${typeClause} default location ${posixFileLiteral(startDir)}
  return POSIX path of theFile
on error number -128
  error number 1
end try
`;
}

export function buildMacSaveFileScript(
  title: string,
  defaultPath: string,
): string {
  const { dir, name } = splitDefaultPath(defaultPath);
  return `try
  set theFile to choose file name with prompt ${appleScriptString(title)} default name ${appleScriptString(name)} default location ${posixFileLiteral(dir)}
  return POSIX path of theFile
on error number -128
  error number 1
end try
`;
}

export function buildMacFolderScript(title: string, startDir: string): string {
  return `try
  set theFolder to choose folder with prompt ${appleScriptString(title)} default location ${posixFileLiteral(startDir)}
  return POSIX path of theFolder
on error number -128
  error number 1
end try
`;
}

export function buildMacInfoScript(title: string, text: string): string {
  return `display dialog ${appleScriptString(text)} with title ${appleScriptString(title)} buttons {"OK"} default button "OK"
`;
}

export function buildMacConfirmScript(title: string, text: string): string {
  return `set r to button returned of (display dialog ${appleScriptString(text)} with title ${appleScriptString(title)} buttons {"No", "Yes"} default button "Yes")
if r is "Yes" then
  return "yes"
else
  return "no"
end if
`;
}

export function buildMacUnsavedScript(title: string, text: string): string {
  return `try
  set r to button returned of (display dialog ${appleScriptString(text)} with title ${appleScriptString(title)} buttons {"Cancel", "Discard", "Save"} default button "Save")
  return r
on error number -128
  return "Cancel"
end try
`;
}

export function buildMacChoiceScript(
  title: string,
  text: string,
  options: ChoiceOption[],
  defaultId?: string,
): string {
  const labels = options.map((o) => appleScriptString(o.label)).join(", ");
  const defaultOpt = options.find((o) => o.id === defaultId) ?? options[0];
  const defaultClause = defaultOpt
    ? ` default items {${appleScriptString(defaultOpt.label)}}`
    : "";
  const mapLines = options.map((o) =>
    `  if chosen is ${appleScriptString(o.label)} then\n    return ${appleScriptString(o.id)}\n  end if`
  ).join("\n");
  return `set theChoice to choose from list {${labels}} with title ${appleScriptString(title)} with prompt ${appleScriptString(text)}${defaultClause}
if theChoice is false then
  error number 1
end if
set chosen to item 1 of theChoice
${mapLines}
error "unknown choice"
`;
}

export function parseMacUnsavedOutcome(stdout: string): UnsavedChoice | null {
  const out = stdout.trim().toLowerCase();
  if (out === "save" || out === "discard" || out === "cancel") return out;
  return null;
}

export const MAC_EXCALIDRAW_TYPES = ["public.json", "public.data", "excalidraw"];
export const MAC_IMAGE_TYPES = [
  "public.png",
  "public.jpeg",
  "public.gif",
  "public.image",
  "public.svg-image",
  "public.webp",
];

async function runOsascript(
  script: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const cmd = new Deno.Command("osascript", {
    args: [],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(script));
  await writer.close();
  const { code, stdout, stderr } = await child.output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

function isUserCancel(code: number, stderr: string): boolean {
  if (code === 1 && stderr.trim().length === 0) return true;
  return /(-128)\b/.test(stderr);
}

function mapPathResult(
  code: number,
  stdout: string,
  stderr: string,
): DialogResult {
  const text = stdout.trim();
  if (code === 0 && text.length > 0) return { ok: true, path: text };
  if (isUserCancel(code, stderr) && text.length === 0) {
    return { ok: false, reason: "cancelled" };
  }
  if (code === 1 && text.length === 0) return { ok: false, reason: "cancelled" };
  return {
    ok: false,
    reason: "error",
    detail: stderr.trim() || `osascript exited with code ${code}`,
  };
}

export async function macOpenExcalidrawDialog(): Promise<DialogResult> {
  try {
    const { code, stdout, stderr } = await runOsascript(
      buildMacOpenFileScript(
        "Open Excalidraw file",
        homeDir(),
        MAC_EXCALIDRAW_TYPES,
      ),
    );
    return mapPathResult(code, stdout, stderr);
  } catch (err) {
    return { ok: false, reason: "unavailable", detail: String(err) };
  }
}

export async function macSaveExcalidrawDialog(
  defaultNameOrPath = "drawing.excalidraw",
): Promise<DialogResult> {
  try {
    const forced = Deno.env.get("EXCALIDRAW_FORCE_SAVE_PATH");
    if (forced && forced.trim()) {
      return { ok: true, path: ensureExcalidrawExt(forced.trim()) };
    }
  } catch {
    // ignore
  }
  const defaultPath = defaultNameOrPath.includes("/")
    ? defaultNameOrPath
    : `${homeDir()}/${defaultNameOrPath}`;
  try {
    const { code, stdout, stderr } = await runOsascript(
      buildMacSaveFileScript("Save Excalidraw file", defaultPath),
    );
    const result = mapPathResult(code, stdout, stderr);
    if (result.ok) return { ok: true, path: ensureExcalidrawExt(result.path) };
    return result;
  } catch (err) {
    return { ok: false, reason: "unavailable", detail: String(err) };
  }
}

export async function macSaveImageExportDialog(
  defaultPath: string,
): Promise<DialogResult> {
  try {
    const { code, stdout, stderr } = await runOsascript(
      buildMacSaveFileScript("Export image", defaultPath),
    );
    return mapPathResult(code, stdout, stderr);
  } catch (err) {
    return { ok: false, reason: "unavailable", detail: String(err) };
  }
}

export async function macOpenImageDialog(): Promise<DialogResult> {
  try {
    const { code, stdout, stderr } = await runOsascript(
      buildMacOpenFileScript("Import image", homeDir(), MAC_IMAGE_TYPES),
    );
    return mapPathResult(code, stdout, stderr);
  } catch (err) {
    return { ok: false, reason: "unavailable", detail: String(err) };
  }
}

export async function macOpenDirectoryDialog(
  title: string,
  startDir: string,
): Promise<DialogResult> {
  try {
    const { code, stdout, stderr } = await runOsascript(
      buildMacFolderScript(title, startDir),
    );
    return mapPathResult(code, stdout, stderr);
  } catch (err) {
    return { ok: false, reason: "unavailable", detail: String(err) };
  }
}

export async function macInfoDialog(
  title: string,
  text: string,
): Promise<InfoDialogResult> {
  try {
    const { code, stderr } = await runOsascript(buildMacInfoScript(title, text));
    if (code === 0) return { ok: true };
    return {
      ok: false,
      reason: "error",
      detail: stderr.trim() || `exit ${code}`,
    };
  } catch (err) {
    return { ok: false, reason: "unavailable", detail: String(err) };
  }
}

export async function macConfirmDialog(
  title: string,
  text: string,
): Promise<ConfirmDialogResult> {
  try {
    const { code, stdout, stderr } = await runOsascript(
      buildMacConfirmScript(title, text),
    );
    const out = stdout.trim().toLowerCase();
    if (code === 0 && out === "yes") return { ok: true, confirmed: true };
    if (code === 0 && out === "no") return { ok: true, confirmed: false };
    if (isUserCancel(code, stderr)) return { ok: true, confirmed: false };
    return {
      ok: false,
      reason: "error",
      detail: stderr.trim() || `exit ${code}`,
    };
  } catch (err) {
    return { ok: false, reason: "unavailable", detail: String(err) };
  }
}

export async function macUnsavedChangesDialog(
  title: string,
  text: string,
): Promise<UnsavedDialogResult> {
  try {
    const { code, stdout, stderr } = await runOsascript(
      buildMacUnsavedScript(title, text),
    );
    const choice = parseMacUnsavedOutcome(stdout);
    if (code === 0 && choice) return { ok: true, choice };
    if (isUserCancel(code, stderr)) return { ok: true, choice: "cancel" };
    return {
      ok: false,
      reason: "error",
      detail: stderr.trim() || `exit ${code}`,
    };
  } catch (err) {
    return { ok: false, reason: "unavailable", detail: String(err) };
  }
}

export async function macChoiceDialog(
  title: string,
  text: string,
  options: ChoiceOption[],
  defaultId?: string,
): Promise<ChoiceDialogResult> {
  if (options.length === 0) {
    return { ok: false, reason: "error", detail: "no options" };
  }
  try {
    const { code, stdout, stderr } = await runOsascript(
      buildMacChoiceScript(title, text, options, defaultId),
    );
    const printed = stdout.trim();
    if (code === 0 && printed.length > 0) {
      const byId = options.find((o) => o.id === printed);
      if (byId) return { ok: true, id: byId.id };
      return { ok: false, reason: "error", detail: `unknown choice: ${printed}` };
    }
    if (isUserCancel(code, stderr) || code === 1) {
      return { ok: false, reason: "cancelled" };
    }
    return {
      ok: false,
      reason: "error",
      detail: stderr.trim() || `exit ${code}`,
    };
  } catch (err) {
    return { ok: false, reason: "unavailable", detail: String(err) };
  }
}

export async function describeMacosDialogBackend(): Promise<string> {
  return "osascript";
}
