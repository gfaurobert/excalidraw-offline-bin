import { join, fromFileUrl, dirname } from "../../desktop/path.ts";

const SKILL_DIR = dirname(fromFileUrl(import.meta.url));
const SKILL_MD = join(SKILL_DIR, "SKILL.md");

const REQUIRED_SNIPPETS = [
  "name: excalidraw-sketching",
  "excalidraw-offline --help",
  "excalidraw-offline export --help",
  "deno task export -- --help",
  "--all-frames",
  "--frame",
  "--element",
  "--bbox",
  "--out",
  "-d",
  "--scale",
  "--json",
  "File → Reload",
  "Ctrl+R",
  "Ctrl+Shift+E",
  "Cancel / Save / Discard",
  "Skills → Install excalidraw-sketching skill",
  "test-fixtures/e2e-export/matrix-demo.excalidraw",
  "stickynote",
  "right-click drag",
] as const;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("bundled SKILL.md contains documented app and CLI sections", async () => {
  const text = await Deno.readTextFile(SKILL_MD);
  assert(text.startsWith("---\n"), "SKILL.md must have YAML frontmatter");
  assert(
    text.includes("description:"),
    "SKILL.md frontmatter must include description",
  );
  for (const snippet of REQUIRED_SNIPPETS) {
    assert(
      text.includes(snippet),
      `SKILL.md must mention: ${snippet}`,
    );
  }
});
