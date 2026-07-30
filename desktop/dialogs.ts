/**
 * Native file dialogs via zenity/kdialog (setsid).
 *
 * Safe when run from the Deno menu handler while the UI talks over HTTP.
 * Do NOT run these inside a webview binding call — that freezes laufey_webview.
 * Fallback: { ok: false, reason: "unavailable" } so the UI can show an in-webview path form.
 */

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

async function commandExists(name: string): Promise<boolean> {
  const cmd = new Deno.Command("sh", {
    args: ["-c", `command -v ${name}`],
    stdout: "null",
    stderr: "null",
  });
  const { success } = await cmd.output();
  return success;
}

function homeDir(): string {
  try {
    return Deno.env.get("HOME") ?? ".";
  } catch {
    return ".";
  }
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
  const parts: string[] = [];
  if (await commandExists("zenity")) parts.push("zenity");
  if (await commandExists("kdialog")) parts.push("kdialog");
  if (parts.length === 0) parts.push("in-webview");
  return parts.join("+");
}
