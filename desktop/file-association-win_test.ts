import { assertEquals } from "jsr:@std/assert@1";
import {
  buildAssocRegScript,
  shouldRegisterFileAssociation,
} from "./file-association-win.ts";

Deno.test("shouldRegisterFileAssociation only packaged windows exe", () => {
  assertEquals(
    shouldRegisterFileAssociation("C:/Program Files/excalidraw-offline.exe", "windows"),
    true,
  );
  assertEquals(
    shouldRegisterFileAssociation("C:/Tools/excalidraw-offline.bat", "windows"),
    true,
  );
  assertEquals(shouldRegisterFileAssociation("C:/deno/deno.exe", "windows"), false);
  assertEquals(
    shouldRegisterFileAssociation("/usr/bin/excalidraw-offline", "linux"),
    false,
  );
});

Deno.test("buildAssocRegScript writes HKCU classes and %1", () => {
  const script = buildAssocRegScript("C:/Apps/excalidraw-offline.exe");
  assertEquals(script.includes("HKCU:\\Software\\Classes\\.excalidraw"), true);
  assertEquals(script.includes("ExcalidrawOffline.drawing"), true);
  assertEquals(script.includes("%1"), true);
  assertEquals(script.includes("excalidraw-offline.exe"), true);
});
