/**
 * Build macOS arm64 release artifacts (.app zip + DMG + checksums).
 * DMG and ad-hoc codesign require a Darwin host (hdiutil / codesign).
 * The .app itself can be cross-compiled via --target aarch64-apple-darwin.
 */
import { basename, dirname, fromFileUrl, join } from "../desktop/path.ts";
import { patchMacosInfoPlist } from "./macos-info-plist.ts";
import {
  assertVersionMatchesTag,
  macosArtifactBasenames,
  readDenoJsonVersion,
  stripVPrefix,
} from "./release-names.ts";

const ROOT = join(fromFileUrl(import.meta.url), "..", "..");
const DENO = Deno.execPath();
/** Space-free basename: `deno desktop` ad-hoc codesign fails if the .app name has spaces. */
const BUILD_BUNDLE_NAME = "excalidraw-offline.app";
const TARGET = "aarch64-apple-darwin";

async function run(
  args: string[],
  options?: { cwd?: string },
): Promise<void> {
  const code = await runAllowFail(args, options);
  if (code !== 0) {
    throw new Error(`command failed (${code}): ${args.join(" ")}`);
  }
}

async function runAllowFail(
  args: string[],
  options?: { cwd?: string },
): Promise<number> {
  const cmd = new Deno.Command(args[0]!, {
    args: args.slice(1),
    cwd: options?.cwd ?? ROOT,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await cmd.output();
  return code;
}

async function sha256Hex(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isDarwin(): boolean {
  return Deno.build.os === "darwin";
}

async function zipAppBundle(appPath: string, zipPath: string): Promise<void> {
  const parent = dirname(appPath);
  const name = basename(appPath);
  try {
    await Deno.remove(zipPath);
  } catch {
    // missing is fine
  }

  if (isDarwin()) {
    const ditto = new Deno.Command("ditto", {
      args: ["-c", "-k", "--keepParent", name, zipPath],
      cwd: parent,
      stdout: "inherit",
      stderr: "inherit",
    });
    const dittoOut = await ditto.output();
    if (dittoOut.success) return;
  }

  const zipCmd = new Deno.Command("zip", {
    args: ["-r", "-y", zipPath, name],
    cwd: parent,
    stdout: "inherit",
    stderr: "inherit",
  });
  const zipOut = await zipCmd.output();
  if (zipOut.success) return;

  const py = new Deno.Command("python3", {
    args: [
      "-c",
      "import shutil, sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2], sys.argv[3])",
      zipPath.replace(/\.zip$/i, ""),
      parent,
      name,
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  const pyOut = await py.output();
  if (!pyOut.success) {
    throw new Error("zip failed (need ditto, zip, or python3 shutil.make_archive)");
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Skip Deno update markers that break bundle codesign if left in Contents/MacOS. */
export function shouldSignMacosNestedFile(name: string): boolean {
  if (name.startsWith(".")) return false;
  return !/\.(update-ok|update|backup|tmp)$/.test(name);
}

/** Sign Contents/MacOS binaries first, then the bundle (inside-out). */
async function adHocSignBundle(appPath: string): Promise<void> {
  const macosDir = join(appPath, "Contents", "MacOS");
  for await (const entry of Deno.readDir(macosDir)) {
    if (!entry.isFile || !shouldSignMacosNestedFile(entry.name)) continue;
    const nested = join(macosDir, entry.name);
    const code = await runAllowFail([
      "codesign",
      "--force",
      "--sign",
      "-",
      nested,
    ]);
    if (code !== 0) {
      console.warn(`==> codesign skipped ${entry.name} (exit ${code})`);
    }
  }
  await run(["codesign", "--force", "--sign", "-", appPath]);
}

async function buildDesktopApp(appBuild: string): Promise<void> {
  const args = [
    DENO,
    "desktop",
    "-A",
    "--backend=webview",
    "--compress=xz",
    "--target",
    TARGET,
    "--include=./frontend/dist",
    "--include=./icons",
    "--include=./skills",
    `--output=${appBuild}`,
    "./desktop/main.ts",
  ];
  const code = await runAllowFail(args);
  if (code === 0) return;

  const launcher = join(
    appBuild,
    "Contents",
    "MacOS",
    BUILD_BUNDLE_NAME.replace(/\.app$/, ""),
  );
  if (!await pathExists(launcher)) {
    throw new Error(
      `deno desktop failed (${code}) and launcher is missing: ${launcher}`,
    );
  }
  // Deno 2.9.4 --compress rewrites the thin launcher after the first codesign,
  // then `codesign` of the bundle fails ("code object is not signed at all").
  console.warn(
    "==> deno desktop codesign failed; ad-hoc signing launcher + bundle",
  );
  await adHocSignBundle(appBuild);
}

async function createDmg(appPath: string, dmgPath: string): Promise<void> {
  const staging = join(dirname(appPath), "dmg-staging");
  await Deno.remove(staging, { recursive: true }).catch(() => {});
  await Deno.mkdir(staging, { recursive: true });
  const stagedApp = join(staging, basename(appPath));
  const copy = new Deno.Command("cp", {
    args: ["-R", appPath, stagedApp],
    stdout: "inherit",
    stderr: "inherit",
  });
  const copyOut = await copy.output();
  if (!copyOut.success) {
    throw new Error("failed to copy .app into DMG staging");
  }
  await Deno.symlink("/Applications", join(staging, "Applications"));
  try {
    await Deno.remove(dmgPath);
  } catch {
    // missing is fine
  }
  await run([
    "hdiutil",
    "create",
    "-volname",
    "Excalidraw Offline",
    "-srcfolder",
    staging,
    "-ov",
    "-format",
    "UDZO",
    dmgPath,
  ]);
  await Deno.remove(staging, { recursive: true }).catch(() => {});
}

async function patchAppPlist(appPath: string, version: string): Promise<void> {
  const plistPath = join(appPath, "Contents", "Info.plist");
  const xml = await Deno.readTextFile(plistPath);
  const patched = patchMacosInfoPlist(xml, version);
  await Deno.writeTextFile(plistPath, patched);
}

async function main(): Promise<void> {
  const denoJson = await Deno.readTextFile(join(ROOT, "deno.json"));
  const denoJsonVersion = readDenoJsonVersion(denoJson);
  const releaseVersion = Deno.env.get("RELEASE_VERSION");
  const version = releaseVersion
    ? stripVPrefix(releaseVersion)
    : denoJsonVersion;
  assertVersionMatchesTag(version, Deno.env.get("GITHUB_REF") ?? "");
  if (version !== denoJsonVersion) {
    throw new Error(
      `RELEASE_VERSION=${version} does not match deno.json version=${denoJsonVersion}`,
    );
  }

  const names = macosArtifactBasenames(version);
  const out = join(ROOT, "dist", "release-macos");
  await Deno.remove(out, { recursive: true }).catch(() => {});
  await Deno.mkdir(out, { recursive: true });

  console.log("==> installing frontend deps");
  await run([DENO, "install", "--node-modules-dir=auto"], {
    cwd: join(ROOT, "frontend"),
  });

  console.log("==> building frontend");
  await run([DENO, "task", "build:frontend"]);

  const appBuild = join(out, BUILD_BUNDLE_NAME);
  console.log(`==> .app → ${BUILD_BUNDLE_NAME} (${TARGET})`);
  await buildDesktopApp(appBuild);

  const appDisplay = join(out, names.appBundle);
  if (appBuild !== appDisplay) {
    console.log(`==> rename ${BUILD_BUNDLE_NAME} → ${names.appBundle}`);
    await Deno.remove(appDisplay, { recursive: true }).catch(() => {});
    await Deno.rename(appBuild, appDisplay);
  }

  console.log("==> patch Info.plist document types");
  await patchAppPlist(appDisplay, version);

  if (isDarwin()) {
    console.log("==> ad-hoc codesign after plist patch");
    await adHocSignBundle(appDisplay);
  } else {
    console.warn(
      "==> skipping codesign (not Darwin); signature is invalid after plist patch",
    );
  }

  const zipPath = join(out, names.zip);
  console.log(`==> zip → ${names.zip}`);
  await zipAppBundle(appDisplay, zipPath);

  const hashes: { file: string; hash: string }[] = [];
  hashes.push({ file: names.zip, hash: await sha256Hex(zipPath) });

  if (isDarwin()) {
    const dmgPath = join(out, names.dmg);
    console.log(`==> DMG → ${names.dmg}`);
    await createDmg(appDisplay, dmgPath);
    hashes.push({ file: names.dmg, hash: await sha256Hex(dmgPath) });
  } else {
    console.warn("==> skipping DMG (hdiutil requires macOS)");
  }

  console.log("==> checksums");
  const sums = hashes.map((h) => `${h.hash}  ${h.file}`).join("\n") + "\n";
  await Deno.writeTextFile(join(out, names.sums), sums);

  console.log(`Artifacts in ${out}:`);
  for await (const entry of Deno.readDir(out)) {
    console.log(" ", entry.name);
  }
}

if (import.meta.main) {
  await main();
}
