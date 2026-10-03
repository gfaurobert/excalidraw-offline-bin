/**
 * `deno task start` / `dev`: optional fast --help, then build frontend + run desktop.
 */
import { printTopLevelHelp, wantsTopLevelHelp } from "../desktop/cli-help.ts";
import { fromFileUrl, join } from "../desktop/path.ts";

const ROOT = join(fromFileUrl(import.meta.url), "..", "..");

const rawArgs = Deno.args.filter((a) => a !== "--dev");
const useHmr = Deno.args.includes("--dev");

if (wantsTopLevelHelp(rawArgs)) {
  printTopLevelHelp();
  Deno.exit(0);
}

async function runBuildFrontend(): Promise<void> {
  const status = await new Deno.Command("deno", {
    args: ["task", "build:frontend"],
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  if (!status.success) Deno.exit(status.code ?? 1);
}

const desktopArgs = [
  "desktop",
  "-A",
  ...(useHmr ? ["--hmr"] : []),
  "--backend=webview",
  "--include=./frontend/dist",
  "--include=./icons",
  "--include=./skills",
  "./desktop/main.ts",
  ...rawArgs,
];

if (import.meta.main) {
  await runBuildFrontend();
  const status = await new Deno.Command("deno", {
    args: desktopArgs,
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  Deno.exit(status.code ?? 0);
}
