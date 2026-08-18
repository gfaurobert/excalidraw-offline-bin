import { assertEquals } from "jsr:@std/assert@1";
import {
  configDirFromEnv,
  homeDirFromEnv,
  parseTasklistHasPid,
  recentFilePathFromEnv,
  runtimeDirFromEnv,
} from "./platform.ts";

function env(map: Record<string, string | undefined>) {
  return { get: (key: string) => map[key] };
}

Deno.test("homeDirFromEnv prefers USERPROFILE then HOME", () => {
  assertEquals(
    homeDirFromEnv(env({ USERPROFILE: "C:\\Users\\greg", HOME: "/home/greg" })),
    "C:/Users/greg",
  );
  assertEquals(homeDirFromEnv(env({ HOME: "/home/greg" })), "/home/greg");
  assertEquals(homeDirFromEnv(env({})), ".");
});

Deno.test("recentFilePathFromEnv windows APPDATA", () => {
  assertEquals(
    recentFilePathFromEnv(
      "windows",
      env({ APPDATA: "C:\\Users\\greg\\AppData\\Roaming" }),
    ),
    "C:/Users/greg/AppData/Roaming/excalidraw-offline/recent.json",
  );
});

Deno.test("recentFilePathFromEnv linux XDG then ~/.config", () => {
  assertEquals(
    recentFilePathFromEnv("linux", env({ XDG_CONFIG_HOME: "/cfg" })),
    "/cfg/excalidraw-offline/recent.json",
  );
  assertEquals(
    recentFilePathFromEnv("linux", env({ HOME: "/home/u" })),
    "/home/u/.config/excalidraw-offline/recent.json",
  );
});

Deno.test("runtimeDirFromEnv windows TEMP vs linux XDG", () => {
  assertEquals(
    runtimeDirFromEnv("windows", env({ TEMP: "C:\\Users\\greg\\AppData\\Local\\Temp" })),
    "C:/Users/greg/AppData/Local/Temp/excalidraw-offline/instances",
  );
  assertEquals(
    runtimeDirFromEnv("linux", env({ XDG_RUNTIME_DIR: "/run/user/1000" })),
    "/run/user/1000/excalidraw-offline/instances",
  );
  assertEquals(
    runtimeDirFromEnv("linux", env({ HOME: "/home/u" })),
    "/home/u/.cache/excalidraw-offline/instances",
  );
});

Deno.test("configDirFromEnv windows fallback without APPDATA", () => {
  assertEquals(
    configDirFromEnv("windows", env({ USERPROFILE: "C:\\Users\\greg" })),
    "C:/Users/greg/AppData/Roaming/excalidraw-offline",
  );
});

Deno.test("parseTasklistHasPid", () => {
  const csv = `"deno.exe","4321","Console","1","10,000 K"\r\n`;
  assertEquals(parseTasklistHasPid(csv, 4321), true);
  assertEquals(parseTasklistHasPid(csv, 1), false);
  assertEquals(
    parseTasklistHasPid(
      "INFO: No tasks are running which match the specified criteria.",
      4321,
    ),
    false,
  );
  assertEquals(parseTasklistHasPid(csv, 0), false);
});
