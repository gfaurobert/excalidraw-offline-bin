import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  artifactBasenames,
  assertVersionMatchesTag,
  macosArtifactBasenames,
  previousVersionTag,
  readDenoJsonVersion,
  stripVPrefix,
  windowsArtifactBasenames,
} from "./release-names.ts";

Deno.test("readDenoJsonVersion parses version field", () => {
  assertEquals(
    readDenoJsonVersion(`{\n  "name": "excalidraw-offline",\n  "version": "0.1.0"\n}`),
    "0.1.0",
  );
});

Deno.test("stripVPrefix", () => {
  assertEquals(stripVPrefix("v0.1.0"), "0.1.0");
  assertEquals(stripVPrefix("0.1.0"), "0.1.0");
});

Deno.test("assertVersionMatchesTag accepts matching tag", () => {
  assertVersionMatchesTag("0.1.0", "refs/tags/v0.1.0");
});

Deno.test("assertVersionMatchesTag rejects mismatch", () => {
  assertThrows(() => assertVersionMatchesTag("0.1.0", "refs/tags/v0.2.0"));
});

Deno.test("assertVersionMatchesTag ignores non-tag refs", () => {
  assertVersionMatchesTag("0.1.0", "refs/heads/main");
});

Deno.test("artifactBasenames", () => {
  assertEquals(artifactBasenames("0.1.0"), {
    appImage: "excalidraw-offline-0.1.0-linux-x86_64.AppImage",
    tarball: "excalidraw-offline-0.1.0-linux-x86_64.tar.xz",
    sums: "SHA256SUMS",
    stagingDir: "excalidraw-offline-0.1.0-linux-x86_64",
  });
});

Deno.test("windowsArtifactBasenames", () => {
  assertEquals(windowsArtifactBasenames("0.3.0"), {
    msi: "excalidraw-offline-0.3.0-windows-x86_64.msi",
    zip: "excalidraw-offline-0.3.0-windows-x86_64.zip",
    sums: "SHA256SUMS-windows-x86_64",
    stagingDir: "excalidraw-offline-0.3.0-windows-x86_64",
  });
});

Deno.test("previousVersionTag picks semver predecessor", () => {
  const tags = ["v0.3.0", "v0.3.1", "v0.4.0", "v0.5.0"];
  assertEquals(previousVersionTag(tags, "v0.5.0"), "v0.4.0");
  assertEquals(previousVersionTag(tags, "v0.4.0"), "v0.3.1");
  assertEquals(previousVersionTag(tags, "v0.3.0"), undefined);
});

Deno.test("macosArtifactBasenames", () => {
  assertEquals(macosArtifactBasenames("0.3.0"), {
    dmg: "excalidraw-offline-0.3.0-macos-arm64.dmg",
    zip: "excalidraw-offline-0.3.0-macos-arm64.zip",
    sums: "SHA256SUMS-macos-arm64",
    appBundle: "Excalidraw Offline.app",
  });
});
