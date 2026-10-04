import {
  agentsSkillsUserDir,
  copySkillContent,
  expandHarnessSelection,
  installSkillTo,
  installSkillToMany,
  resolveHarnessInstallDests,
  resolveInstallTarget,
  SKILL_ID,
  SKILL_INSTALL_ENTRIES,
} from "./install-skill.ts";
import { join } from "./path.ts";

function assertEquals(actual: unknown, expected: unknown, msg = ""): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(
      `assertEquals failed${msg ? `: ${msg}` : ""}\n  actual:   ${a}\n  expected: ${e}`,
    );
  }
}

Deno.test("agentsSkillsUserDir", () => {
  assertEquals(agentsSkillsUserDir("/home/alice"), "/home/alice/.agents/skills");
});

Deno.test("resolveInstallTarget custom does not append .agents/skills", () => {
  assertEquals(
    resolveInstallTarget("custom", "/home/alice", "/opt/skills-root"),
    `/opt/skills-root/${SKILL_ID}`,
  );
});

Deno.test("expandHarnessSelection All expands concrete targets", () => {
  assertEquals(expandHarnessSelection(["all"]), ["agents", "claude", "kiro", "cline"]);
});

Deno.test("expandHarnessSelection dedupes without All", () => {
  assertEquals(expandHarnessSelection(["agents", "claude", "agents"]), [
    "agents",
    "claude",
  ]);
});

Deno.test("resolveHarnessInstallDests global paths", () => {
  assertEquals(
    resolveHarnessInstallDests("global", "/home/alice", ["agents", "claude"]),
    [
      `/home/alice/.agents/skills/${SKILL_ID}`,
      `/home/alice/.claude/skills/${SKILL_ID}`,
    ],
  );
  assertEquals(
    resolveHarnessInstallDests("global", "/home/alice", ["cline"]),
    [`/home/alice/.cline/skills/${SKILL_ID}`],
  );
});

Deno.test("resolveHarnessInstallDests project paths", () => {
  assertEquals(
    resolveHarnessInstallDests("project", "/home/alice", ["kiro"], "/work/repo/"),
    [`/work/repo/.kiro/skills/${SKILL_ID}`],
  );
});

Deno.test("resolveHarnessInstallDests All on project", () => {
  const dests = resolveHarnessInstallDests("global", "/home/u", ["all"]);
  assertEquals(dests.length, 4);
  assertEquals(dests[0], `/home/u/.agents/skills/${SKILL_ID}`);
  assertEquals(dests[1], `/home/u/.claude/skills/${SKILL_ID}`);
});

Deno.test("copySkillContent copies only SKILL.md and references", async () => {
  const tmp = await Deno.makeTempDir({ prefix: "skill-copy-" });
  try {
    const source = join(tmp, "src", SKILL_ID);
    await Deno.mkdir(join(source, "references"), { recursive: true });
    await Deno.mkdir(join(source, "evals"), { recursive: true });
    await Deno.writeTextFile(join(source, "SKILL.md"), "# skill\n");
    await Deno.writeTextFile(join(source, "references", "a.md"), "ref\n");
    await Deno.writeTextFile(join(source, "evals", "evals.json"), "{}\n");
    await Deno.writeTextFile(join(source, "skill-content_test.ts"), "// test\n");

    const dest = join(tmp, "out", SKILL_ID);
    await copySkillContent(source, dest);

    assertEquals(await Deno.readTextFile(join(dest, "SKILL.md")), "# skill\n");
    assertEquals(
      await Deno.readTextFile(join(dest, "references", "a.md")),
      "ref\n",
    );
    let evalsExists = true;
    try {
      await Deno.stat(join(dest, "evals"));
    } catch {
      evalsExists = false;
    }
    assertEquals(evalsExists, false);
    let testFileExists = true;
    try {
      await Deno.stat(join(source, "skill-content_test.ts"));
      await Deno.stat(join(dest, "skill-content_test.ts"));
    } catch {
      testFileExists = false;
    }
    assertEquals(testFileExists, false);
    assertEquals([...SKILL_INSTALL_ENTRIES], ["SKILL.md", "references"]);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("installSkillTo and installSkillToMany round-trip", async () => {
  const tmp = await Deno.makeTempDir({ prefix: "skill-install-" });
  try {
    const source = join(tmp, "src", SKILL_ID);
    await Deno.mkdir(join(source, "references"), { recursive: true });
    await Deno.writeTextFile(join(source, "SKILL.md"), "# skill\n");

    const destA = join(tmp, "a", ".agents", "skills", SKILL_ID);
    const destB = join(tmp, "b", ".claude", "skills", SKILL_ID);
    const one = await installSkillTo(source, destA);
    assertEquals(one.ok, true);

    const many = await installSkillToMany(source, [destA, destB]);
    assertEquals(many.ok, true);
    if (many.ok) assertEquals(many.dests.length, 2);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("installSkillTo fails without SKILL.md", async () => {
  const tmp = await Deno.makeTempDir({ prefix: "skill-missing-" });
  try {
    const source = join(tmp, SKILL_ID);
    await Deno.mkdir(source);
    const result = await installSkillTo(source, join(tmp, "dest", SKILL_ID));
    assertEquals(result.ok, false);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});
