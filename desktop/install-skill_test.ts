import {
  agentsSkillsUserDir,
  resolveInstallTarget,
  SKILL_ID,
  copyDirRecursive,
  installSkillTo,
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

Deno.test("resolveInstallTarget global", () => {
  assertEquals(
    resolveInstallTarget("global", "/home/alice"),
    `/home/alice/.agents/skills/${SKILL_ID}`,
  );
});

Deno.test("resolveInstallTarget project appends .agents/skills", () => {
  assertEquals(
    resolveInstallTarget("project", "/home/alice", "/work/my-repo"),
    `/work/my-repo/.agents/skills/${SKILL_ID}`,
  );
});

Deno.test("resolveInstallTarget custom does not append .agents/skills", () => {
  assertEquals(
    resolveInstallTarget("custom", "/home/alice", "/opt/skills-root"),
    `/opt/skills-root/${SKILL_ID}`,
  );
});

Deno.test("resolveInstallTarget project strips trailing slash", () => {
  assertEquals(
    resolveInstallTarget("project", "/home/alice", "/work/repo/"),
    `/work/repo/.agents/skills/${SKILL_ID}`,
  );
});

Deno.test("copyDirRecursive and installSkillTo round-trip", async () => {
  const tmp = await Deno.makeTempDir({ prefix: "skill-install-" });
  try {
    const source = join(tmp, "src", SKILL_ID);
    await Deno.mkdir(join(source, "references"), { recursive: true });
    await Deno.writeTextFile(join(source, "SKILL.md"), "# skill\n");
    await Deno.writeTextFile(join(source, "references", "a.md"), "ref\n");

    const dest = join(tmp, "out", SKILL_ID);
    await copyDirRecursive(source, dest);
    assertEquals(await Deno.readTextFile(join(dest, "SKILL.md")), "# skill\n");
    assertEquals(
      await Deno.readTextFile(join(dest, "references", "a.md")),
      "ref\n",
    );

    const result = await installSkillTo(source, dest);
    assertEquals(result.ok, true);
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
