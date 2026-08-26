import {
  appleScriptString,
  buildMacChoiceScript,
  buildMacConfirmScript,
  buildMacFolderScript,
  buildMacInfoScript,
  buildMacOpenFileScript,
  buildMacSaveFileScript,
  buildMacUnsavedScript,
  MAC_EXCALIDRAW_TYPES,
  parseMacUnsavedOutcome,
} from "./dialogs-macos.ts";

function assertEquals(actual: unknown, expected: unknown, msg = ""): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(
      `assertEquals failed${msg ? `: ${msg}` : ""}\n  actual:   ${a}\n  expected: ${e}`,
    );
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

Deno.test("appleScriptString escapes quotes and backslashes", () => {
  assertEquals(appleScriptString("Save"), `"Save"`);
  assertEquals(appleScriptString(`say "hi"`), `"say \\"hi\\""`);
  assertEquals(appleScriptString("a\\b"), `"a\\\\b"`);
});

Deno.test("buildMacOpenFileScript uses choose file and types", () => {
  const script = buildMacOpenFileScript(
    "Open Excalidraw file",
    "/Users/u",
    MAC_EXCALIDRAW_TYPES,
  );
  assert(script.includes("choose file"), "choose file");
  assert(script.includes("excalidraw"), "type");
  assert(script.includes("POSIX file \"/Users/u\""), "start dir");
  assert(script.includes("error number -128"), "cancel");
});

Deno.test("buildMacSaveFileScript splits dir and name", () => {
  const script = buildMacSaveFileScript(
    "Save Excalidraw file",
    "/Users/u/drawing.excalidraw",
  );
  assert(script.includes("choose file name"), "choose file name");
  assert(script.includes("drawing.excalidraw"), "filename");
  assert(script.includes("POSIX file \"/Users/u\""), "initial dir");
});

Deno.test("buildMacFolderScript", () => {
  const script = buildMacFolderScript("Select folder", "/Users/u");
  assert(script.includes("choose folder"), "folder dialog");
  assert(script.includes("/Users/u"), "start dir");
});

Deno.test("buildMacInfoScript and confirm", () => {
  const info = buildMacInfoScript("Runtime", "Ready · osascript");
  assert(info.includes("display dialog"), "info dialog");
  assert(info.includes(`"OK"`), "OK button");
  const confirm = buildMacConfirmScript("Overwrite?", "Replace?");
  assert(confirm.includes(`"No"`), "No");
  assert(confirm.includes(`"Yes"`), "Yes");
});

Deno.test("buildMacUnsavedScript has Save Discard Cancel", () => {
  const script = buildMacUnsavedScript("Unsaved changes", "Save this drawing?");
  assert(script.includes("Save"), "Save");
  assert(script.includes("Discard"), "Discard");
  assert(script.includes("Cancel"), "Cancel");
});

Deno.test("buildMacChoiceScript prints option ids", () => {
  const script = buildMacChoiceScript(
    "Install skill",
    "Where to install?",
    [
      { id: "global", label: "Global (user) — ~/.agents/skills" },
      { id: "project", label: "Project — <folder>/.agents/skills" },
    ],
    "global",
  );
  assert(script.includes("choose from list"), "choose from list");
  assert(script.includes(`return "global"`), "global id");
  assert(script.includes(`return "project"`), "project id");
  assert(script.includes("default items"), "default");
});

Deno.test("parseMacUnsavedOutcome", () => {
  assertEquals(parseMacUnsavedOutcome("save"), "save");
  assertEquals(parseMacUnsavedOutcome("Discard\n"), "discard");
  assertEquals(parseMacUnsavedOutcome("Cancel"), "cancel");
  assertEquals(parseMacUnsavedOutcome("nope"), null);
});
