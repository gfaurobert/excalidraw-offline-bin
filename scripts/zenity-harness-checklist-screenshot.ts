import { buildMultiSelectChecklistArgs } from "../desktop/dialogs.ts";
import { HARNESS_TARGET_OPTIONS } from "../desktop/install-skill.ts";

const artifacts = Deno.args[0] ?? "/opt/cursor/artifacts/zenity-checklist-shot";
const out = `${artifacts}/harness-checklist.png`;

const args = buildMultiSelectChecklistArgs(
  "zenity",
  "Install skill — targets",
  "Which agent tools should receive the skill? (Global)",
  HARNESS_TARGET_OPTIONS,
  ["agents", "claude"],
);

const child = new Deno.Command(args[0]!, {
  args: args.slice(1),
  stdout: "piped",
  stderr: "piped",
}).spawn();

await new Promise((r) => setTimeout(r, 1500));

const widProc = new Deno.Command("xdotool", {
  args: ["search", "--name", "targets"],
  stdout: "piped",
  stderr: "null",
}).output();
let wid = new TextDecoder().decode(widProc.stdout).trim().split("\n")[0];
if (!wid) {
  const alt = new Deno.Command("xdotool", {
    args: ["search", "--class", "Zenity"],
    stdout: "piped",
  }).output();
  wid = new TextDecoder().decode(alt.stdout).trim().split("\n")[0];
}

if (!wid) {
  const status = await child.status;
  const err = child.stderr
    ? await new Response(child.stderr).text()
    : "";
  console.error("zenity exit", status.code, err);
  try {
    child.kill("SIGKILL");
  } catch {
    // ignore
  }
  Deno.exit(1);
}

await new Deno.Command("scrot", {
  args: ["-b", out, "-u"],
}).spawn().status;

console.log(`screenshot: ${out} wid=${wid}`);
try {
  child.kill("SIGTERM");
} catch {
  // ignore
}
