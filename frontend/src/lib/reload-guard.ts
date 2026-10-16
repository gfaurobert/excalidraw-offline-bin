/** Pure helpers for File → Reload preconditions and unsaved prompts. */

export type ReloadPlan =
  | { kind: "noop" }
  | { kind: "reload" }
  | { kind: "prompt_unsaved" };

export type UnsavedChoice = "save" | "discard" | "cancel";

export type ReloadAfterPrompt =
  | { kind: "abort" }
  | { kind: "reload" }
  | { kind: "save_then_reload" };

export function planReload(input: {
  mode: "start" | "canvas";
  path: string | null;
  dirty: boolean;
}): ReloadPlan {
  if (input.mode !== "canvas") return { kind: "noop" };
  if (!input.path?.trim()) return { kind: "noop" };
  if (!input.dirty) return { kind: "reload" };
  return { kind: "prompt_unsaved" };
}

export function reloadActionAfterUnsavedChoice(
  choice: UnsavedChoice,
): ReloadAfterPrompt {
  if (choice === "cancel") return { kind: "abort" };
  if (choice === "save") return { kind: "save_then_reload" };
  return { kind: "reload" };
}
