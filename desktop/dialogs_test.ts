import {
  buildChoiceDialogArgs,
  buildConfirmDialogArgs,
  buildDirectoryDialogArgs,
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

const INSTALL_OPTIONS = [
  { id: "global", label: "Global (user) — ~/.agents/skills" },
  { id: "project", label: "Project — <folder>/.agents/skills" },
  { id: "custom", label: "Custom — pick any folder" },
];

Deno.test("buildChoiceDialogArgs zenity radiolist", () => {
  assertEquals(
    buildChoiceDialogArgs(
      "zenity",
      "Install skill",
      "Where to install?",
      INSTALL_OPTIONS,
      "global",
    ),
    [
      "zenity",
      "--list",
      "--radiolist",
      "--title=Install skill",
      "--text=Where to install?",
      "--column=Select",
      "--column=Option",
      "--hide-header",
      "--print-column=2",
      "TRUE",
      "Global (user) — ~/.agents/skills",
      "FALSE",
      "Project — <folder>/.agents/skills",
      "FALSE",
      "Custom — pick any folder",
    ],
  );
});

Deno.test("buildChoiceDialogArgs kdialog radiolist", () => {
  assertEquals(
    buildChoiceDialogArgs(
      "kdialog",
      "Install skill",
      "Where to install?",
      INSTALL_OPTIONS,
      "global",
    ),
    [
      "kdialog",
      "--title",
      "Install skill",
      "--radiolist",
      "Where to install?",
      "global",
      "Global (user) — ~/.agents/skills",
      "on",
      "project",
      "Project — <folder>/.agents/skills",
      "off",
      "custom",
      "Custom — pick any folder",
      "off",
    ],
  );
});

Deno.test("buildDirectoryDialogArgs zenity", () => {
  assertEquals(
    buildDirectoryDialogArgs("zenity", "Select project folder", "/home/u"),
    [
      "zenity",
      "--file-selection",
      "--directory",
      "--title=Select project folder",
      "--filename=/home/u/",
    ],
  );
});

Deno.test("buildConfirmDialogArgs", () => {
  assertEquals(
    buildConfirmDialogArgs("zenity", "Overwrite?", "Replace existing skill?"),
    [
      "zenity",
      "--question",
      "--title=Overwrite?",
      "--text=Replace existing skill?",
    ],
  );
  assertEquals(
    buildConfirmDialogArgs("kdialog", "Overwrite?", "Replace existing skill?"),
    [
      "kdialog",
      "--title",
      "Overwrite?",
      "--yesno",
      "Replace existing skill?",
    ],
  );
});
