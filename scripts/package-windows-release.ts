/**
 * Build Windows x86_64 release artifacts (MSI + zip + checksums).
 * Cross-compiles from any host via --target x86_64-pc-windows-msvc.
 */
import { basename, dirname, fromFileUrl, join } from "../desktop/path.ts";
import {
  assertVersionMatchesTag,
  readDenoJsonVersion,
  stripVPrefix,
  windowsArtifactBasenames,
} from "./release-names.ts";

const ROOT = join(fromFileUrl(import.meta.url), "..", "..");
const DENO = Deno.execPath();

async function run(
  args: string[],
  options?: { cwd?: string },
): Promise<void> {
  const cmd = new Deno.Command(args[0]!, {
    args: args.slice(1),
    cwd: options?.cwd ?? ROOT,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error(`command failed (${code}): ${args.join(" ")}`);
  }
}

async function sha256Hex(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function zipDirectory(stagingDir: string, zipPath: string): Promise<void> {
  const parent = dirname(stagingDir);
  const name = basename(stagingDir);
  try {
    await Deno.remove(zipPath);
  } catch {
    // missing is fine
  }

  const zipCmd = new Deno.Command("zip", {
    args: ["-r", zipPath, name],
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
    throw new Error("zip failed (need `zip` or python3 shutil.make_archive)");
  }
}

async function flattenIfNested(staging: string, launcherName: string): Promise<void> {
  const nested = join(staging, launcherName);
  try {
    const st = await Deno.stat(nested);
    if (!st.isDirectory) return;
  } catch {
    return;
  }
  const tmp = join(staging, ".deno-desktop-bundle");
  await Deno.rename(nested, tmp);
  for await (const entry of Deno.readDir(tmp)) {
    await Deno.rename(join(tmp, entry.name), join(staging, entry.name));
  }
  await Deno.remove(tmp, { recursive: true });
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

  const names = windowsArtifactBasenames(version);
  const out = join(ROOT, "dist", "release-windows");
  const staging = join(out, "staging", names.stagingDir);
  await Deno.remove(out, { recursive: true }).catch(() => {});
  await Deno.mkdir(staging, { recursive: true });

  console.log("==> installing frontend deps");
  await run([DENO, "install", "--node-modules-dir=auto"], {
    cwd: join(ROOT, "frontend"),
  });

  console.log("==> building frontend");
  await run([DENO, "task", "build:frontend"]);

  const common = [
    DENO,
    "desktop",
    "-A",
    "--backend=webview",
    "--compress=xz",
    "--target",
    "x86_64-pc-windows-msvc",
    "--include=./frontend/dist",
    "--include=./icons",
    "--include=./skills",
  ];

  const msiBuild = join(out, "excalidraw-offline.msi");
  console.log(`==> MSI → ${names.msi}`);
  await run([...common, `--output=${msiBuild}`, "./desktop/main.ts"]);
  await Deno.rename(msiBuild, join(out, names.msi));

  console.log("==> directory bundle → staging");
  await run([
    ...common,
    `--output=${join(staging, "excalidraw-offline")}`,
    "./desktop/main.ts",
  ]);
  await flattenIfNested(staging, "excalidraw-offline");

  const zipPath = join(out, names.zip);
  console.log(`==> zip → ${names.zip}`);
  await zipDirectory(staging, zipPath);

  await Deno.remove(join(out, "staging"), { recursive: true }).catch(() => {});

  console.log("==> checksums");
  const msiHash = await sha256Hex(join(out, names.msi));
  const zipHash = await sha256Hex(zipPath);
  const sums = `${msiHash}  ${names.msi}\n${zipHash}  ${names.zip}\n`;
  await Deno.writeTextFile(join(out, names.sums), sums);

  console.log(`Artifacts in ${out}:`);
  for await (const entry of Deno.readDir(out)) {
    if (entry.isFile) console.log(" ", entry.name);
  }
}

if (import.meta.main) {
  await main();
}
