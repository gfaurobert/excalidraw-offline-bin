/**
 * Dev checkout: build (if needed) the local desktop bundle, then exec it with
 * `export …` args. `deno desktop … export file` only compiles; it does not run.
 */
import { fromFileUrl, join } from "../desktop/path.ts";

const ROOT = join(fromFileUrl(import.meta.url), "..");
const LAUNCHER = join(ROOT, "dist/linux/excalidraw-offline/excalidraw-offline");

/** Args from `deno task export -- …`, minus a forwarded `--`. */
export function normalizeDevExportUserArgs(args: readonly string[]): string[] {
  return args.map((a) => a.trim()).filter((a) => a.length > 0 && a !== "--");
}

export function devExportLauncherArgs(userArgs: readonly string[]): string[] {
  return ["export", ...normalizeDevExportUserArgs(userArgs)];
}

async function launcherNeedsRebuild(): Promise<boolean> {
  try {
    const launcherStat = await Deno.stat(LAUNCHER);
    const sources = [
      join(ROOT, "desktop/main.ts"),
      join(ROOT, "frontend/dist/index.html"),
    ];
    for (const path of sources) {
      try {
        const st = await Deno.stat(path);
        const stMs = st.mtime?.getTime() ?? 0;
        const launcherMs = launcherStat.mtime?.getTime() ?? 0;
        if (stMs > launcherMs) return true;
      } catch {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

async function ensureDevLauncher(): Promise<void> {
  if (!(await launcherNeedsRebuild())) return;

  const cmd = new Deno.Command("deno", {
    args: [
      "desktop",
      "-A",
      "--backend=webview",
      "--include=./frontend/dist",
      "--include=./icons",
      "--include=./skills",
      "--output=./dist/linux/excalidraw-offline",
      "./desktop/main.ts",
    ],
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await cmd.spawn().status;
  if (!status.success) {
    Deno.exit(status.code ?? 1);
  }
}

if (import.meta.main) {
  const userArgs = normalizeDevExportUserArgs(Deno.args);
  if (userArgs.length === 0) {
    console.error(
      "Usage: deno task export -- <file.excalidraw> [--frame NAME …] [--all-frames] [--json] [--out path]",
    );
    Deno.exit(1);
  }

  await ensureDevLauncher();

  const run = new Deno.Command(LAUNCHER, {
    args: devExportLauncherArgs(userArgs),
    cwd: Deno.cwd(),
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await run.spawn().status;
  Deno.exit(status.code ?? 0);
}
