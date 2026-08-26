import { assertEquals } from "jsr:@std/assert@1";
import { shouldSignMacosNestedFile } from "./package-macos-release.ts";

Deno.test("shouldSignMacosNestedFile skips Deno update markers", () => {
  assertEquals(shouldSignMacosNestedFile("excalidraw-offline"), true);
  assertEquals(shouldSignMacosNestedFile("libruntime.dylib"), true);
  assertEquals(shouldSignMacosNestedFile("laufey_webview"), true);
  assertEquals(shouldSignMacosNestedFile("libruntime.dylib.update-ok"), false);
  assertEquals(shouldSignMacosNestedFile(".DS_Store"), false);
});
