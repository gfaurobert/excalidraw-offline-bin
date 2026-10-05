import {
  buildZenityMultiSelectChecklistArgs,
  isZenityUnsupportedOptionError,
  normalizeZenityCliText,
  parseZenityVersion,
  zenityMultiSelectVariantOrder,
} from "./zenity-checklist.ts";
import { buildMultiSelectChecklistArgs } from "./dialogs.ts";

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

const SAMPLE = [
  { id: "agents", label: "Agents" },
  { id: "all", label: "All" },
];

Deno.test("normalizeZenityCliText replaces em dash", () => {
  assertEquals(
    normalizeZenityCliText("Install skill — targets"),
    "Install skill - targets",
  );
});

Deno.test("parseZenityVersion", () => {
  assertEquals(parseZenityVersion("4.2.2"), { major: 4, minor: 2, patch: 2 });
  assertEquals(parseZenityVersion("3.42.1\n"), { major: 3, minor: 42, patch: 1 });
  assertEquals(parseZenityVersion("bad"), null);
});

Deno.test("isZenityUnsupportedOptionError", () => {
  assert(
    isZenityUnsupportedOptionError(
      "This option is not available. Please see --help for all possible usages.",
    ),
  );
  assert(!isZenityUnsupportedOptionError("cannot open display"));
});

Deno.test("zenityMultiSelectVariantOrder prefers hidden-id then label-only", () => {
  assertEquals(
    zenityMultiSelectVariantOrder({ major: 4, minor: 2, patch: 2 }),
    ["hidden-id", "label-only"],
  );
});

Deno.test("buildZenityMultiSelectChecklistArgs hidden-id omits window sizing", () => {
  const args = buildZenityMultiSelectChecklistArgs(
    "hidden-id",
    "T",
    "body",
    SAMPLE,
    ["agents"],
  );
  assert(!args.includes("--width=920"), "no width");
  assert(!args.some((a) => a.startsWith("--height=")), "no height");
  assert(args.includes("--hide-column=2"), "hide id");
  assert(args.includes("TRUE"), "checked");
  assert(args.includes("agents"), "id column");
});

Deno.test("buildZenityMultiSelectChecklistArgs label-only two columns", () => {
  const args = buildZenityMultiSelectChecklistArgs(
    "label-only",
    "T",
    "body",
    SAMPLE,
    [],
  );
  assertEquals(
    args.filter((a) => a.startsWith("--column=")),
    ["--column=Select", "--column=Target"],
  );
  assert(!args.includes("--hide-column=2"), "no hide-column");
  assert(args.includes("FALSE"), "unchecked");
  assert(args.includes("All"), "label row");
});

Deno.test("buildMultiSelectChecklistArgs kdialog unchanged", () => {
  const args = buildMultiSelectChecklistArgs(
    "kdialog",
    "Install skill — targets",
    "Pick tools",
    SAMPLE,
    ["agents"],
  );
  assert(args.includes("--geometry"), "geometry");
  assert(args.includes("920x500"), "size");
  assert(args.includes("--checklist"), "checklist");
});
