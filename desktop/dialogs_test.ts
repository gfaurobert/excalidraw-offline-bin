import {
  buildInfoDialogArgs,
  ensureExcalidrawExt,
  formatLinkedInfoText,
} from "./dialogs.ts";
import { APP_REPO_URL, EXCALIDRAW_REPO_URL } from "./versions.ts";

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

Deno.test("formatLinkedInfoText zenity uses clickable markup", () => {
  assertEquals(
    formatLinkedInfoText("zenity", "Version: 0.1.0", APP_REPO_URL),
    `Version: 0.1.0\n\n<a href="${APP_REPO_URL}">${APP_REPO_URL}</a>`,
  );
});

Deno.test("formatLinkedInfoText kdialog uses plain URL", () => {
  assertEquals(
    formatLinkedInfoText("kdialog", "Release: 0.18.1", EXCALIDRAW_REPO_URL),
    `Release: 0.18.1\n\n${EXCALIDRAW_REPO_URL}`,
  );
});
