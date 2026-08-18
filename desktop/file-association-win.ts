/** Per-user HKCU file association for packaged Windows builds. */
import { basename } from "./path.ts";
import { utf16LeBase64 } from "./dialogs-win.ts";

export function shouldRegisterFileAssociation(execPath: string, os: string): boolean {
  if (os !== "windows") return false;
  const name = basename(execPath).toLowerCase();
  if (name === "deno" || name === "deno.exe") return false;
  return name.startsWith("excalidraw-offline");
}

export function buildAssocRegScript(execPath: string): string {
  const exe = execPath.replace(/\//g, "\\");
  return `
$ErrorActionPreference = 'Stop'
$exe = '${exe.replace(/'/g, "''")}'
$cmd = '"' + $exe + '" "%1"'
New-Item -Path 'HKCU:\\Software\\Classes\\.excalidraw' -Force | Out-Null
(Get-Item 'HKCU:\\Software\\Classes\\.excalidraw').SetValue('', 'ExcalidrawOffline.drawing')
New-Item -Path 'HKCU:\\Software\\Classes\\ExcalidrawOffline.drawing' -Force | Out-Null
(Get-Item 'HKCU:\\Software\\Classes\\ExcalidrawOffline.drawing').SetValue('', 'Excalidraw drawing')
New-Item -Path 'HKCU:\\Software\\Classes\\ExcalidrawOffline.drawing\\shell\\open\\command' -Force | Out-Null
(Get-Item 'HKCU:\\Software\\Classes\\ExcalidrawOffline.drawing\\shell\\open\\command').SetValue('', $cmd)
`;
}

export async function registerExcalidrawFileAssociation(
  execPath = Deno.execPath(),
  os = Deno.build.os,
): Promise<void> {
  if (!shouldRegisterFileAssociation(execPath, os)) return;
  const encoded = utf16LeBase64(buildAssocRegScript(execPath));
  const cmd = new Deno.Command("powershell.exe", {
    args: [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encoded,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const { success, stderr } = await cmd.output();
  if (!success) {
    const detail = new TextDecoder().decode(stderr).trim();
    console.warn("[assoc] HKCU register failed", detail || "powershell error");
  }
}
