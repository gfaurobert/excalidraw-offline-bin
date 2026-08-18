import { assertEquals } from "jsr:@std/assert@1";
import {
  APP_REPO_URL,
  APP_VERSION,
  EXCALIDRAW_REPO_URL,
  EXCALIDRAW_VERSION,
  getAppRepoUrl,
  getAppVersion,
  getExcalidrawRepoUrl,
  getExcalidrawVersion,
} from "./versions.ts";

Deno.test("hardcoded versions and repo URLs", () => {
  assertEquals(getAppVersion(), APP_VERSION);
  assertEquals(getExcalidrawVersion(), EXCALIDRAW_VERSION);
  assertEquals(getAppRepoUrl(), APP_REPO_URL);
  assertEquals(getExcalidrawRepoUrl(), EXCALIDRAW_REPO_URL);
  assertEquals(APP_VERSION, "0.3.1");
  assertEquals(EXCALIDRAW_VERSION, "0.18.0-4872083");
});
