import {
  buildChoiceDialogArgs,
  buildConfirmDialogArgs,
  buildDirectoryDialogArgs,
  buildInfoDialogArgs,
  buildMultiSelectChecklistArgs,
  buildUnsavedChangesDialogArgs,
  parseMultiSelectIds,
  unsavedChangesDialogCopy,
  ensureExcalidrawExt,
  formatLinkedInfoText,
  parseUnsavedDialogOutcome,
  pickerUnavailableMessage,
} from "./dialogs.ts";
import { APP_REPO_URL, EXCALIDRAW_REPO_URL } from "./versions.ts";

function assert(condition: boolean, msg = ""): void {
  if (!condition) throw new Error(msg || "assert failed");
}

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
  { id: "global", label: "Global (user) — install under your home directory" },
  { id: "project", label: "Project — pick a project root folder" },
  { id: "custom", label: "Custom — pick any folder" },
];

const HARNESS_OPTIONS = [
  { id: "agents", label: ".agents/skills (Codex, Cursor)" },
  { id: "claude", label: "Claude Code" },
  { id: "all", label: "All" },
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
      "Global (user) — install under your home directory",
      "FALSE",
      "Project — pick a project root folder",
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
      "Global (user) — install under your home directory",
      "on",
      "project",
      "Project — pick a project root folder",
      "off",
      "custom",
      "Custom — pick any folder",
      "off",
    ],
  );
});

Deno.test("buildMultiSelectChecklistArgs zenity defaults", () => {
  const args = buildMultiSelectChecklistArgs(
    "zenity",
    "Install skill — targets",
    "Pick tools",
    HARNESS_OPTIONS,
    ["agents", "claude"],
  );
  assert(args.includes("--checklist"), "checklist");
  assert(args.includes("TRUE"), "agents checked");
  assert(args.includes("agents"), "agents id");
  assert(args.includes("claude"), "claude id");
});

Deno.test("parseMultiSelectIds multiline and tokens", () => {
  assertEquals(
    parseMultiSelectIds(HARNESS_OPTIONS, "agents\nclaude"),
    ["agents", "claude"],
  );
  assertEquals(parseMultiSelectIds(HARNESS_OPTIONS, "all"), ["all"]);
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

Deno.test("buildUnsavedChangesDialogArgs zenity", () => {
  assertEquals(
    buildUnsavedChangesDialogArgs(
      "zenity",
      "Unsaved changes",
      "Save this drawing before continuing?",
    ),
    [
      "zenity",
      "--question",
      "--title=Unsaved changes",
      "--text=Save this drawing before continuing?",
      "--ok-label=Save",
      "--cancel-label=Cancel",
      "--extra-button=Discard",
    ],
  );
});

Deno.test("buildUnsavedChangesDialogArgs kdialog", () => {
  assertEquals(
    buildUnsavedChangesDialogArgs(
      "kdialog",
      "Unsaved changes",
      "Save this drawing before continuing?",
    ),
    [
      "kdialog",
      "--title",
      "Unsaved changes",
      "--yesnocancel",
      "Save this drawing before continuing?",
      "--yes-label",
      "Save",
      "--no-label",
      "Discard",
      "--cancel-label",
      "Cancel",
    ],
  );
});

Deno.test("unsavedChangesDialogCopy reload vs untitled", () => {
  const reload = unsavedChangesDialogCopy("reload");
  assertEquals(reload.title, "Unsaved changes");
  assertEquals(
    reload.text.includes("reload from the file on disk"),
    true,
    "reload copy",
  );
  const untitled = unsavedChangesDialogCopy("untitled");
  assertEquals(
    untitled.text.includes("no file path yet"),
    true,
    "untitled copy",
  );
});

Deno.test("parseUnsavedDialogOutcome zenity", () => {
  assertEquals(parseUnsavedDialogOutcome("zenity", 0, ""), "save");
  assertEquals(parseUnsavedDialogOutcome("zenity", 1, "Discard"), "discard");
  assertEquals(parseUnsavedDialogOutcome("zenity", 1, ""), "cancel");
  assertEquals(parseUnsavedDialogOutcome("zenity", 5, ""), null);
});

Deno.test("parseUnsavedDialogOutcome kdialog", () => {
  assertEquals(parseUnsavedDialogOutcome("kdialog", 0, ""), "save");
  assertEquals(parseUnsavedDialogOutcome("kdialog", 1, ""), "discard");
  assertEquals(parseUnsavedDialogOutcome("kdialog", 2, ""), "cancel");
  assertEquals(parseUnsavedDialogOutcome("kdialog", 3, ""), null);
});

Deno.test("pickerUnavailableMessage is OS-specific", () => {
  assertEquals(
    pickerUnavailableMessage("windows").includes("PowerShell"),
    true,
  );
  assertEquals(pickerUnavailableMessage("darwin").includes("osascript"), true);
  assertEquals(pickerUnavailableMessage("linux").includes("zenity"), true);
});
