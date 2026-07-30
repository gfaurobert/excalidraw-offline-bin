import { buildInfoDialogArgs, ensureExcalidrawExt } from "./dialogs.ts";

function assertEquals(actual: unknown, expected: unknown, msg = ""): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(
      `assertEquals failed${msg ? `: ${msg}` : ""}\n  actual:   ${a}\n  expected: ${e}`,
    );
  }
}

Deno.test("ensureExcalidrawExt appends extension when missing", () => {
  assertEquals(ensureExcalidrawExt("/tmp/foo"), "/tmp/foo.excalidraw");
  assertEquals(
    ensureExcalidrawExt("/tmp/foo.excalidraw"),
    "/tmp/foo.excalidraw",
  );
});

Deno.test("buildInfoDialogArgs zenity", () => {
  assertEquals(
    buildInfoDialogArgs("zenity", "Runtime", "Ready · dialog: zenity+http"),
    [
      "zenity",
      "--info",
      "--title=Runtime",
      "--text=Ready · dialog: zenity+http",
    ],
  );
});

Deno.test("buildInfoDialogArgs kdialog", () => {
  assertEquals(
    buildInfoDialogArgs("kdialog", "Assets", "Images save into assets/"),
    [
      "kdialog",
      "--title",
      "Assets",
      "--msgbox",
      "Images save into assets/",
    ],
  );
});
