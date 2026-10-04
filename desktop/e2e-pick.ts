/// <reference path="./desktop-types.d.ts" />

import type { ConfirmDialogResult, DialogResult } from "./dialogs.ts";
import { commandExists } from "./platform.ts";

let pendingPick: {
  resolve: (result: DialogResult) => void;
  child: Deno.ChildProcess;
} | null = null;

let pendingConfirm: {
  resolve: (result: ConfirmDialogResult) => void;
  child: Deno.ChildProcess;
} | null = null;

export function isE2ePickMode(): boolean {
  try {
    return Deno.env.get("EXCALIDRAW_E2E") === "1";
  } catch {
    return false;
  }
}

/** Driver completes a visible zenity save/open picker while the UI awaits /api/pick-save. */
export function completeE2eConfirm(confirmed: boolean): boolean {
  const pending = pendingConfirm;
  if (!pending) return false;
  pendingConfirm = null;
  try {
    pending.child.kill();
  } catch {
    // ignore
  }
  pending.resolve({ ok: true, confirmed });
  return true;
}

export function completeE2ePick(
  path: string | null,
  cancelled = false,
): boolean {
  const pending = pendingPick;
  if (!pending) return false;
  pendingPick = null;
  try {
    pending.child.kill();
  } catch {
    // ignore
  }
  if (cancelled || !path?.trim()) {
    pending.resolve({ ok: false, reason: "cancelled" });
  } else {
    pending.resolve({ ok: true, path: path.trim() });
  }
  return true;
}

export async function runDialogWithE2ePick(args: string[]): Promise<DialogResult> {
  if (!isE2ePickMode()) {
    return await runDialogBlocking(args);
  }

  try {
    const useSetsid = await commandExists("setsid");
    const cmd = new Deno.Command(useSetsid ? "setsid" : args[0]!, {
      args: useSetsid ? args : args.slice(1),
      stdout: "piped",
      stderr: "piped",
    });
    const child = cmd.spawn();

    return await new Promise((resolve) => {
      pendingPick = { resolve, child };
      setTimeout(() => {
        if (pendingPick?.child === child) {
          completeE2ePick(null, true);
        }
      }, 120_000);
    });
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      detail: `Failed to spawn ${args[0]}: ${String(err)}`,
    };
  }
}

export async function runConfirmWithE2ePick(
  args: string[],
): Promise<ConfirmDialogResult> {
  if (!isE2ePickMode()) {
    return await runConfirmBlocking(args);
  }

  try {
    const useSetsid = await commandExists("setsid");
    const cmd = new Deno.Command(useSetsid ? "setsid" : args[0]!, {
      args: useSetsid ? args : args.slice(1),
      stdout: "null",
      stderr: "piped",
    });
    const child = cmd.spawn();

    return await new Promise((resolve) => {
      pendingConfirm = { resolve, child };
      setTimeout(() => {
        if (pendingConfirm?.child === child) {
          completeE2eConfirm(false);
        }
      }, 120_000);
    });
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      detail: `Failed to spawn ${args[0]}: ${String(err)}`,
    };
  }
}

async function runConfirmBlocking(args: string[]): Promise<ConfirmDialogResult> {
  try {
    const useSetsid = await commandExists("setsid");
    const cmd = new Deno.Command(useSetsid ? "setsid" : args[0]!, {
      args: useSetsid ? args : args.slice(1),
      stdout: "null",
      stderr: "piped",
    });
    const { success, code, stderr } = await cmd.output();
    if (success || code === 0) return { ok: true, confirmed: true };
    if (code === 1) return { ok: true, confirmed: false };
    const detail = new TextDecoder().decode(stderr).trim();
    return { ok: false, reason: "error", detail: detail || `exit ${code}` };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}

async function runDialogBlocking(args: string[]): Promise<DialogResult> {
  try {
    const useSetsid = await commandExists("setsid");
    const cmd = new Deno.Command(useSetsid ? "setsid" : args[0]!, {
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
