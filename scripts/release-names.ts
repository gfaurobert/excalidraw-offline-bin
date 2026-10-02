export function readDenoJsonVersion(text: string): string {
  const data = JSON.parse(text) as { version?: unknown };
  if (typeof data.version !== "string" || data.version.length === 0) {
    throw new Error("deno.json missing string version");
  }
  return data.version;
}

export function stripVPrefix(tagOrVersion: string): string {
  return tagOrVersion.startsWith("v") ? tagOrVersion.slice(1) : tagOrVersion;
}

/** Semver-ish sort key for `vX.Y.Z` tags (ignores non-numeric suffixes). */
function releaseTagKey(tag: string): [number, number, number, string] {
  const raw = stripVPrefix(tag);
  const [maj = "0", min = "0", patchRest = "0"] = raw.split(".");
  const patch = patchRest.replace(/[^0-9].*$/, "");
  return [Number(maj), Number(min), Number(patch), tag];
}

export function compareReleaseTags(a: string, b: string): number {
  const [ma, mi, pa, ta] = releaseTagKey(a);
  const [mb, mj, pb, tb] = releaseTagKey(b);
  if (ma !== mb) return ma - mb;
  if (mi !== mj) return mi - mj;
  if (pa !== pb) return pa - pb;
  return ta.localeCompare(tb);
}

/** Previous tag when releasing `currentTag` (e.g. v0.4.0 before v0.5.0). */
export function previousVersionTag(
  allTags: readonly string[],
  currentTag: string,
): string | undefined {
  const versionTags = allTags
    .filter((t) => /^v\d/.test(t))
    .sort(compareReleaseTags);
  const idx = versionTags.indexOf(currentTag);
  if (idx <= 0) return undefined;
  return versionTags[idx - 1];
}

export function assertVersionMatchesTag(version: string, gitRef: string): void {
  const prefix = "refs/tags/v";
  if (!gitRef.startsWith(prefix)) return;
  const tagVersion = gitRef.slice(prefix.length);
  if (tagVersion !== version) {
    throw new Error(
      `version mismatch: deno.json=${version} tag=${tagVersion} (ref=${gitRef})`,
    );
  }
}

export function artifactBasenames(version: string): {
  appImage: string;
  tarball: string;
  sums: string;
  stagingDir: string;
} {
  const base = `excalidraw-offline-${version}-linux-x86_64`;
  return {
    appImage: `${base}.AppImage`,
    tarball: `${base}.tar.xz`,
    sums: "SHA256SUMS",
    stagingDir: base,
  };
}

export function windowsArtifactBasenames(version: string): {
  msi: string;
  zip: string;
  sums: string;
  stagingDir: string;
} {
  const base = `excalidraw-offline-${version}-windows-x86_64`;
  return {
    msi: `${base}.msi`,
    zip: `${base}.zip`,
    sums: "SHA256SUMS-windows-x86_64",
    stagingDir: base,
  };
}

export function macosArtifactBasenames(version: string): {
  dmg: string;
  zip: string;
  sums: string;
  appBundle: string;
} {
  const base = `excalidraw-offline-${version}-macos-arm64`;
  return {
    dmg: `${base}.dmg`,
    zip: `${base}.zip`,
    sums: "SHA256SUMS-macos-arm64",
    appBundle: "Excalidraw Offline.app",
  };
}
