import { assertEquals } from "jsr:@std/assert@1";
import {
  appBundleFromExecPath,
  buildLsregisterArgs,
  shouldRegisterMacFileAssociation,
} from "./file-association-macos.ts";

Deno.test("appBundleFromExecPath finds .app from MacOS executable", () => {
  assertEquals(
    appBundleFromExecPath(
      "/Applications/Excalidraw Offline.app/Contents/MacOS/Excalidraw Offline",
    ),
    "/Applications/Excalidraw Offline.app",
  );
  assertEquals(
    appBundleFromExecPath(
      "/Applications/Excalidraw Offline.app/Contents/MacOS/excalidraw-offline",
    ),
    "/Applications/Excalidraw Offline.app",
  );
  assertEquals(appBundleFromExecPath("/usr/local/bin/deno"), null);
  assertEquals(
    appBundleFromExecPath("C:/Program Files/excalidraw-offline.exe"),
    null,
  );
});

Deno.test("shouldRegisterMacFileAssociation only packaged darwin app", () => {
  assertEquals(
    shouldRegisterMacFileAssociation(
      "/Applications/Excalidraw Offline.app/Contents/MacOS/Excalidraw Offline",
      "darwin",
    ),
    true,
  );
  assertEquals(
    shouldRegisterMacFileAssociation("/opt/homebrew/bin/deno", "darwin"),
    false,
  );
  assertEquals(
    shouldRegisterMacFileAssociation(
      "/Applications/Excalidraw Offline.app/Contents/MacOS/Excalidraw Offline",
      "linux",
    ),
    false,
  );
});

Deno.test("buildLsregisterArgs uses -f on the bundle", () => {
  const args = buildLsregisterArgs("/Applications/Excalidraw Offline.app");
  assertEquals(args.includes("-f"), true);
  assertEquals(args.includes("/Applications/Excalidraw Offline.app"), true);
});
