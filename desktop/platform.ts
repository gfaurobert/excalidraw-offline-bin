/** OS home, config, runtime dirs, command lookup, and process liveness. */
import { join } from "./path.ts";

export interface EnvLike {
  get(key: string): string | undefined;
}

const denoEnv: EnvLike = {
  get(key: string): string | undefined {
    try {
      return Deno.env.get(key);
    } catch {
      return undefined;
    }
  },
};

function slash(path: string): string {
  return path.replace(/\\/g, "/");
}

export function homeDirFromEnv(env: EnvLike): string {
  const userProfile = env.get("USERPROFILE");
  if (userProfile && userProfile.length > 0) return slash(userProfile);
  const home = env.get("HOME");
  if (home && home.length > 0) return slash(home);
  return ".";
}

export function homeDir(): string {
  return homeDirFromEnv(denoEnv);
}

/** App config directory (not including recent.json). */
export function configDirFromEnv(os: string, env: EnvLike): string {
  if (os === "windows") {
    const appdata = env.get("APPDATA");
    if (appdata && appdata.length > 0) {
      return join(slash(appdata), "excalidraw-offline");
    }
    return join(homeDirFromEnv(env), "AppData", "Roaming", "excalidraw-offline");
  }
  const xdg = env.get("XDG_CONFIG_HOME");
  if (xdg && xdg.length > 0) return join(slash(xdg), "excalidraw-offline");
  return join(homeDirFromEnv(env), ".config", "excalidraw-offline");
}

export function recentFilePathFromEnv(os: string, env: EnvLike): string {
  return join(configDirFromEnv(os, env), "recent.json");
}

export function runtimeDirFromEnv(os: string, env: EnvLike): string {
  if (os === "windows") {
    const temp = env.get("TEMP") ?? env.get("TMP") ?? env.get("LOCALAPPDATA");
    if (temp && temp.length > 0) {
      return join(slash(temp), "excalidraw-offline", "instances");
    }
    return join(
      homeDirFromEnv(env),
      "AppData",
      "Local",
      "Temp",
      "excalidraw-offline",
      "instances",
    );
  }
  const xdg = env.get("XDG_RUNTIME_DIR");
  if (xdg && xdg.length > 0) {
    return join(slash(xdg), "excalidraw-offline", "instances");
  }
  return join(homeDirFromEnv(env), ".cache", "excalidraw-offline", "instances");
}

export function defaultRecentFilePath(): string {
  return recentFilePathFromEnv(Deno.build.os, denoEnv);
}

export function defaultRegistryDir(): string {
  return runtimeDirFromEnv(Deno.build.os, denoEnv);
}

export async function commandExists(name: string): Promise<boolean> {
  if (Deno.build.os === "windows") {
    const cmd = new Deno.Command("where.exe", {
      args: [name],
      stdout: "null",
      stderr: "null",
    });
    const { success } = await cmd.output();
    return success;
  }
  const cmd = new Deno.Command("sh", {
    args: ["-c", `command -v ${name}`],
    stdout: "null",
    stderr: "null",
  });
  const { success } = await cmd.output();
  return success;
}

/** Parse `tasklist /FO CSV /NH` output for a PID column. */
export function parseTasklistHasPid(output: string, pid: number): boolean {
  if (pid <= 0) return false;
  const want = String(pid);
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('"')) continue;
    const parts = trimmed.split('","');
    if (parts.length < 2) continue;
    const pidField = parts[1]!.replace(/"/g, "");
    if (pidField === want) return true;
  }
  return false;
}

function isWindowsPidAlive(pid: number): boolean {
  try {
    const cmd = new Deno.Command("tasklist.exe", {
      args: ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"],
      stdout: "piped",
      stderr: "piped",
    });
    const { stdout } = cmd.outputSync();
    return parseTasklistHasPid(new TextDecoder().decode(stdout), pid);
  } catch {
    return false;
  }
}

export function isProcessAlive(pid: number): boolean {
  if (pid <= 0) return false;
  if (Deno.build.os === "windows") return isWindowsPidAlive(pid);
  try {
    Deno.kill(pid, 0);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.PermissionDenied) return true;
    return false;
  }
}
