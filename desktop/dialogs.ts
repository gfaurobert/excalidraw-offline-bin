/**
 * Native file dialogs via zenity/kdialog (Linux) or PowerShell WinForms (Windows).
 *
 * Safe when run from the Deno menu handler while the UI talks over HTTP.
 * Do NOT run these inside a webview binding call — that freezes laufey_webview.
 */
import { commandExists, homeDir } from "./platform.ts";
import {
  describeWindowsDialogBackend,
  winChoiceDialog,
  winConfirmDialog,
  winInfoDialog,
  winOpenDirectoryDialog,
  winOpenExcalidrawDialog,
  winOpenImageDialog,
  winSaveExcalidrawDialog,
  winUnsavedChangesDialog,
} from "./dialogs-win.ts";

export type DialogResult =
  | { ok: true; path: string }
  | {
    ok: false;
    reason: "cancelled" | "unavailable" | "error";
    detail?: string;
  };

export type InfoDialogResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "error"; detail?: string };

export type ChoiceDialogResult =
  | { ok: true; id: string }
  | {
    ok: false;
    reason: "cancelled" | "unavailable" | "error";
    detail?: string;
  };

export type ConfirmDialogResult =
  | { ok: true; confirmed: boolean }
  | { ok: false; reason: "unavailable" | "error"; detail?: string };

export type UnsavedChoice = "save" | "discard" | "cancel";

export type UnsavedDialogResult =
  | { ok: true; choice: UnsavedChoice }
  | { ok: false; reason: "unavailable" | "error"; detail?: string };

export interface ChoiceOption {
  id: string;
  label: string;
}

function isWindows(): boolean {
  return Deno.build.os === "windows";
}

export function pickerUnavailableMessage(): string {
  return isWindows()
    ? "File picker unavailable (PowerShell WinForms failed)"
    : "File picker unavailable (install zenity or kdialog)";
}

/** Append .excalidraw when the user omits the extension. */
export function ensureExcalidrawExt(path: string): string {
  return path.endsWith(".excalidraw") ? path : `${path}.excalidraw`;
}

/** Append a URL; zenity gets a clickable Pango link, kdialog gets plain text. */
export function formatLinkedInfoText(
  backend: "zenity" | "kdialog",
  body: string,
  url: string,
): string {
  if (backend === "zenity") {
    return `${body}\n\n<a href="${url}">${url}</a>`;
  }
  return `${body}\n\n${url}`;
}

export function buildInfoDialogArgs(
  backend: "zenity" | "kdialog",
  title: string,
  text: string,
): string[] {
  if (backend === "zenity") {
    return ["zenity", "--info", `--title=${title}`, `--text=${text}`];
  }
  return ["kdialog", "--title", title, "--msgbox", text];
}

async function runInfoCommand(args: string[]): Promise<InfoDialogResult> {
  try {
    const useSetsid = await commandExists("setsid");
    const cmd = new Deno.Command(useSetsid ? "setsid" : args[0]!, {
      args: useSetsid ? args : args.slice(1),
      stdout: "null",
      stderr: "piped",
    });
    const { success, code, stderr } = await cmd.output();
    if (success || code === 0) return { ok: true };
    const detail = new TextDecoder().decode(stderr).trim();
    return { ok: false, reason: "error", detail: detail || `exit ${code}` };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}

export async function infoDialog(
  title: string,
  text: string,
  linkUrl?: string,
): Promise<InfoDialogResult> {
  if (isWindows()) {
    const body = linkUrl ? `${text}\n\n${linkUrl}` : text;
    return await winInfoDialog(title, body);
  }
  if (await commandExists("zenity")) {
    const body = linkUrl
      ? formatLinkedInfoText("zenity", text, linkUrl)
      : text;
    return await runInfoCommand(buildInfoDialogArgs("zenity", title, body));
  }
  if (await commandExists("kdialog")) {
    const body = linkUrl
      ? formatLinkedInfoText("kdialog", text, linkUrl)
      : text;
    return await runInfoCommand(buildInfoDialogArgs("kdialog", title, body));
  }
  return { ok: false, reason: "unavailable", detail: "no zenity/kdialog" };
}

async function runDialog(args: string[]): Promise<DialogResult> {
  try {
    const useSetsid = await commandExists("setsid");
    const cmd = new Deno.Command(useSetsid ? "setsid" : args[0], {
      args: useSetsid ? args : args.slice(1),
      stdout: "piped",
      stderr: "piped",
    });
    const { success, code, stdout, stderr } = await cmd.output();
    const text = new TextDecoder().decode(stdout).trim();
    const errText = new TextDecoder().decode(stderr).trim();

    if (success && text.length > 0) {
      return { ok: true, path: text };
    }
    if (code === 1 && text.length === 0) {
      return { ok: false, reason: "cancelled" };
    }
    return {
      ok: false,
      reason: "error",
      detail: errText || `${args[0]} exited with code ${code}`,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      detail: `Failed to spawn ${args[0]}: ${String(err)}`,
    };
  }
}

export async function openExcalidrawDialog(): Promise<DialogResult> {
  if (isWindows()) return await winOpenExcalidrawDialog();
  if (await commandExists("zenity")) {
    return await runDialog([
      "zenity",
      "--file-selection",
      "--title=Open Excalidraw file",
      "--file-filter=Excalidraw | *.excalidraw",
      "--file-filter=All files | *",
    ]);
  }

  if (await commandExists("kdialog")) {
    return await runDialog([
      "kdialog",
      "--getopenfilename",
      homeDir(),
      "*.excalidraw",
    ]);
  }

  return { ok: false, reason: "unavailable", detail: "no zenity/kdialog" };
}

export async function saveExcalidrawDialog(
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

  if (isWindows()) return await winSaveExcalidrawDialog(defaultNameOrPath);

  const defaultPath = defaultNameOrPath.includes("/")
    ? defaultNameOrPath
    : `${homeDir()}/${defaultNameOrPath}`;

  if (await commandExists("zenity")) {
    const result = await runDialog([
      "zenity",
      "--file-selection",
      "--save",
      "--confirm-overwrite",
      "--title=Save Excalidraw file",
      `--filename=${defaultPath}`,
      "--file-filter=Excalidraw | *.excalidraw",
      "--file-filter=All files | *",
    ]);
    if (result.ok) return { ok: true, path: ensureExcalidrawExt(result.path) };
    return result;
  }

  if (await commandExists("kdialog")) {
    const result = await runDialog([
      "kdialog",
      "--getsavefilename",
      defaultPath,
      "*.excalidraw",
    ]);
    if (result.ok) return { ok: true, path: ensureExcalidrawExt(result.path) };
    return result;
  }

  return { ok: false, reason: "unavailable", detail: "no zenity/kdialog" };
}

export async function openImageDialog(): Promise<DialogResult> {
  if (isWindows()) return await winOpenImageDialog();
  if (await commandExists("zenity")) {
    return await runDialog([
      "zenity",
      "--file-selection",
      "--title=Import image",
      "--file-filter=Images | *.png *.jpg *.jpeg *.gif *.webp *.svg",
      "--file-filter=All files | *",
    ]);
  }

  if (await commandExists("kdialog")) {
    return await runDialog([
      "kdialog",
      "--getopenfilename",
      homeDir(),
      "*.png *.jpg *.jpeg *.gif *.webp *.svg",
    ]);
  }

  return { ok: false, reason: "unavailable", detail: "no zenity/kdialog" };
}

export async function describeDialogBackend(): Promise<string> {
  if (isWindows()) return await describeWindowsDialogBackend();
  const parts: string[] = [];
  if (await commandExists("zenity")) parts.push("zenity");
  if (await commandExists("kdialog")) parts.push("kdialog");
  if (parts.length === 0) parts.push("in-webview");
  return parts.join("+");
}

/** Pure args builder for radiolist choice dialogs (testable). */
export function buildChoiceDialogArgs(
  backend: "zenity" | "kdialog",
  title: string,
  text: string,
  options: ChoiceOption[],
  defaultId?: string,
): string[] {
  if (backend === "zenity") {
    const args = [
      "zenity",
      "--list",
      "--radiolist",
      `--title=${title}`,
      `--text=${text}`,
      "--column=Select",
      "--column=Option",
      "--hide-header",
      "--print-column=2",
    ];
    for (const opt of options) {
      args.push(opt.id === defaultId ? "TRUE" : "FALSE", opt.label);
    }
    return args;
  }

  const args = ["kdialog", "--title", title, "--radiolist", text];
  for (const opt of options) {
    args.push(opt.id, opt.label, opt.id === defaultId ? "on" : "off");
  }
  return args;
}

function labelToChoiceId(
  options: ChoiceOption[],
  printed: string,
): string | undefined {
  const trimmed = printed.trim();
  const byId = options.find((o) => o.id === trimmed);
  if (byId) return byId.id;
  const byLabel = options.find((o) => o.label === trimmed);
  return byLabel?.id;
}

export async function choiceDialog(
  title: string,
  text: string,
  options: ChoiceOption[],
  defaultId?: string,
): Promise<ChoiceDialogResult> {
  if (options.length === 0) {
    return { ok: false, reason: "error", detail: "no options" };
  }

  if (isWindows()) {
    return await winChoiceDialog(title, text, options, defaultId);
  }

  if (await commandExists("zenity")) {
    const result = await runDialog(
      buildChoiceDialogArgs("zenity", title, text, options, defaultId),
    );
    if (!result.ok) return result;
    const id = labelToChoiceId(options, result.path);
    if (!id) {
      return {
        ok: false,
        reason: "error",
        detail: `unknown choice: ${result.path}`,
      };
    }
    return { ok: true, id };
  }

  if (await commandExists("kdialog")) {
    const result = await runDialog(
      buildChoiceDialogArgs("kdialog", title, text, options, defaultId),
    );
    if (!result.ok) return result;
    const id = labelToChoiceId(options, result.path);
    if (!id) {
      return {
        ok: false,
        reason: "error",
        detail: `unknown choice: ${result.path}`,
      };
    }
    return { ok: true, id };
  }

  return { ok: false, reason: "unavailable", detail: "no zenity/kdialog" };
}

export function buildDirectoryDialogArgs(
  backend: "zenity" | "kdialog",
  title: string,
  startDir: string,
): string[] {
  if (backend === "zenity") {
    return [
      "zenity",
      "--file-selection",
      "--directory",
      `--title=${title}`,
      `--filename=${startDir}/`,
    ];
  }
  return ["kdialog", "--title", title, "--getexistingdirectory", startDir];
}

export async function openDirectoryDialog(
  title = "Select folder",
  startDir?: string,
): Promise<DialogResult> {
  const start = startDir ?? homeDir();
  if (isWindows()) return await winOpenDirectoryDialog(title, start);
  if (await commandExists("zenity")) {
    return await runDialog(buildDirectoryDialogArgs("zenity", title, start));
  }
  if (await commandExists("kdialog")) {
    return await runDialog(buildDirectoryDialogArgs("kdialog", title, start));
  }
  return { ok: false, reason: "unavailable", detail: "no zenity/kdialog" };
}

export function buildConfirmDialogArgs(
  backend: "zenity" | "kdialog",
  title: string,
  text: string,
): string[] {
  if (backend === "zenity") {
    return ["zenity", "--question", `--title=${title}`, `--text=${text}`];
  }
  return ["kdialog", "--title", title, "--yesno", text];
}

async function runConfirmCommand(args: string[]): Promise<ConfirmDialogResult> {
  try {
    const useSetsid = await commandExists("setsid");
    const cmd = new Deno.Command(useSetsid ? "setsid" : args[0]!, {
      args: useSetsid ? args : args.slice(1),
      stdout: "null",
      stderr: "piped",
    });
    const { success, code, stderr } = await cmd.output();
    // zenity/kdialog: 0 = Yes, 1 = No/Cancel
    if (success || code === 0) return { ok: true, confirmed: true };
    if (code === 1) return { ok: true, confirmed: false };
    const detail = new TextDecoder().decode(stderr).trim();
    return { ok: false, reason: "error", detail: detail || `exit ${code}` };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}

export async function confirmDialog(
  title: string,
  text: string,
): Promise<ConfirmDialogResult> {
  if (isWindows()) return await winConfirmDialog(title, text);
  if (await commandExists("zenity")) {
    return await runConfirmCommand(
      buildConfirmDialogArgs("zenity", title, text),
    );
  }
  if (await commandExists("kdialog")) {
    return await runConfirmCommand(
      buildConfirmDialogArgs("kdialog", title, text),
    );
  }
  return { ok: false, reason: "unavailable", detail: "no zenity/kdialog" };
}

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

/**
 * Map zenity/kdialog exit code + stdout to Save/Discard/Cancel.
 * Returns null for unrecognized outcomes (caller treats as error).
 *
 * zenity: 0 → save; 1 + "Discard" → discard; 1 + empty → cancel
 * kdialog: 0 → save; 1 → discard; 2 → cancel
 */
export function parseUnsavedDialogOutcome(
  backend: "zenity" | "kdialog",
  code: number,
  stdout: string,
): UnsavedChoice | null {
  const out = stdout.trim();
  if (backend === "zenity") {
    if (code === 0) return "save";
    if (code === 1 && out === "Discard") return "discard";
    if (code === 1) return "cancel";
    return null;
  }
  if (code === 0) return "save";
  if (code === 1) return "discard";
  if (code === 2) return "cancel";
  return null;
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
    const out = new TextDecoder().decode(stdout);
    const err = new TextDecoder().decode(stderr).trim();
    const choice = parseUnsavedDialogOutcome(backend, code, out);
    if (choice) return { ok: true, choice };
    return {
      ok: false,
      reason: "error",
      detail: err || `exit ${code}`,
    };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}

export async function unsavedChangesDialog(
  title = "Unsaved changes",
  text = "This drawing has no file path yet. Save, discard, or cancel?",
): Promise<UnsavedDialogResult> {
  if (isWindows()) return await winUnsavedChangesDialog(title, text);
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
