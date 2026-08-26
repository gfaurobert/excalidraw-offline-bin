import { assertEquals } from "jsr:@std/assert@1";
import {
  MACOS_DRAWING_UTI,
  patchMacosInfoPlist,
} from "./macos-info-plist.ts";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key>
	<string>dev.excalidraw.offline</string>
	<key>CFBundleName</key>
	<string>Excalidraw Offline</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1.0.0</string>
</dict>
</plist>
`;

Deno.test("patchMacosInfoPlist injects UTI and versions", () => {
  const patched = patchMacosInfoPlist(SAMPLE, "0.3.0");
  assertEquals(patched.includes(MACOS_DRAWING_UTI), true);
  assertEquals(patched.includes("<string>excalidraw</string>"), true);
  assertEquals(patched.includes("application/vnd.excalidraw+json"), true);
  assertEquals(patched.includes("CFBundleDocumentTypes"), true);
  assertEquals(
    patched.includes("<key>CFBundleShortVersionString</key>\n\t<string>0.3.0</string>"),
    true,
  );
  assertEquals(
    patched.includes("<key>CFBundleVersion</key>\n\t<string>0.3.0</string>"),
    true,
  );
});

Deno.test("patchMacosInfoPlist is idempotent for document types", () => {
  const once = patchMacosInfoPlist(SAMPLE, "0.3.0");
  const twice = patchMacosInfoPlist(once, "0.3.1");
  const count = twice.split("CFBundleDocumentTypes").length - 1;
  assertEquals(count, 1);
  assertEquals(twice.includes("<string>0.3.1</string>"), true);
});
