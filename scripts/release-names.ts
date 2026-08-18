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
