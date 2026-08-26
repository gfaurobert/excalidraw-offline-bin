/** Launch Services refresh for packaged macOS .app builds. */
import { basename } from "./path.ts";

const LSREGISTER =
  "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

/** Walk up from an executable inside Contents/MacOS to the .app bundle. */
export function appBundleFromExecPath(execPath: string): string | null {
  const n = execPath.replace(/\\/g, "/");
  const lower = n.toLowerCase();
  const marker = ".app/contents/macos/";
  const idx = lower.lastIndexOf(marker);
  if (idx < 0) return null;
  return n.slice(0, idx + ".app".length);
}

export function shouldRegisterMacFileAssociation(
  execPath: string,
  os: string,
): boolean {
  if (os !== "darwin") return false;
  const name = basename(execPath).toLowerCase();
  if (name === "deno") return false;
  return appBundleFromExecPath(execPath) !== null;
}

export function buildLsregisterArgs(bundlePath: string): string[] {
  return [LSREGISTER, "-f", bundlePath];
}

export async function registerMacExcalidrawFileAssociation(
  execPath = Deno.execPath(),
  os = Deno.build.os,
): Promise<void> {
  if (!shouldRegisterMacFileAssociation(execPath, os)) return;
  const bundle = appBundleFromExecPath(execPath);
  if (!bundle) return;
  const args = buildLsregisterArgs(bundle);
  try {
    const cmd = new Deno.Command(args[0]!, {
      args: args.slice(1),
      stdout: "piped",
      stderr: "piped",
    });
    const { success, stderr } = await cmd.output();
    if (!success) {
      const detail = new TextDecoder().decode(stderr).trim();
      console.warn("[assoc] lsregister failed", detail || "lsregister error");
    }
  } catch (err) {
    console.warn("[assoc] lsregister failed", err);
  }
}
