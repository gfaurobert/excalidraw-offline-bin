import {
  buildWinChoiceScript,
  buildWinConfirmScript,
  buildWinFolderScript,
  buildWinInfoScript,
  buildWinOpenFileScript,
  buildWinSaveFileScript,
  buildWinUnsavedScript,
  EXCALIDRAW_FILTER,
  parseWinUnsavedOutcome,
  psSingleQuote,
  utf16LeBase64,
} from "./dialogs-win.ts";

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

Deno.test("psSingleQuote doubles single quotes", () => {
  assertEquals(psSingleQuote("It's"), "'It''s'");
  assertEquals(psSingleQuote("Save"), "'Save'");
});

Deno.test("utf16LeBase64 round-trips ASCII via atob length", () => {
  const encoded = utf16LeBase64("Hi");
  const bin = atob(encoded);
  assertEquals(bin.length, 4);
  assertEquals(bin.charCodeAt(0), 0x48);
  assertEquals(bin.charCodeAt(1), 0);
  assertEquals(bin.charCodeAt(2), 0x69);
  assertEquals(bin.charCodeAt(3), 0);
});

Deno.test("buildWinOpenFileScript uses OpenFileDialog and filter", () => {
  const script = buildWinOpenFileScript(
    "Open Excalidraw file",
    EXCALIDRAW_FILTER,
    "C:/Users/u",
  );
  assert(script.includes("OpenFileDialog"), "OpenFileDialog");
  assert(script.includes("*.excalidraw"), "filter");
  assert(script.includes("C:/Users/u") || script.includes("C:/Users/u"), "initial dir");
  assert(script.includes("ShowDialog"), "ShowDialog");
});

Deno.test("buildWinSaveFileScript uses SaveFileDialog", () => {
  const script = buildWinSaveFileScript(
    "Save Excalidraw file",
    EXCALIDRAW_FILTER,
    "C:/Users/u/drawing.excalidraw",
  );
  assert(script.includes("SaveFileDialog"), "SaveFileDialog");
  assert(script.includes("drawing.excalidraw"), "filename");
  assert(script.includes("C:/Users/u"), "initial dir");
});

Deno.test("buildWinFolderScript", () => {
  const script = buildWinFolderScript("Select folder", "C:/Users/u");
  assert(script.includes("FolderBrowserDialog"), "folder dialog");
  assert(script.includes("C:/Users/u"), "start dir");
});

Deno.test("buildWinInfoScript and confirm", () => {
  const info = buildWinInfoScript("Runtime", "Ready · powershell");
  assert(info.includes("MessageBox"), "info MessageBox");
  const confirm = buildWinConfirmScript("Overwrite?", "Replace?");
  assert(confirm.includes("YesNo"), "YesNo");
});

Deno.test("buildWinUnsavedScript has Save Discard Cancel", () => {
  const script = buildWinUnsavedScript("Unsaved changes", "Save this drawing?");
  assert(script.includes("Save"), "Save");
  assert(script.includes("Discard"), "Discard");
  assert(script.includes("Cancel"), "Cancel");
  assert(script.includes("$script:choice = 'save'"), "save assignment");
});

Deno.test("buildWinChoiceScript prints option ids as Tag", () => {
  const script = buildWinChoiceScript(
    "Install skill",
    "Where to install?",
    [
      { id: "global", label: "Global (user) — ~/.agents/skills" },
      { id: "project", label: "Project — <folder>/.agents/skills" },
    ],
    "global",
  );
  assert(script.includes("$r.Tag = 'global'"), "global tag");
  assert(script.includes("$r.Tag = 'project'"), "project tag");
  assert(script.includes("$r.Checked = $true"), "default checked");
});

Deno.test("parseWinUnsavedOutcome", () => {
  assertEquals(parseWinUnsavedOutcome("save"), "save");
  assertEquals(parseWinUnsavedOutcome("Discard\r\n"), "discard");
  assertEquals(parseWinUnsavedOutcome("cancel"), "cancel");
  assertEquals(parseWinUnsavedOutcome("nope"), null);
});
