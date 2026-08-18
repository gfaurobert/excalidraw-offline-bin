/**
 * Windows native dialogs via powershell.exe + System.Windows.Forms (STA).
 *
 * Same rule as zenity: run from the Deno menu/HTTP handler, never inside a
 * webview binding call.
 */
import { homeDir } from "./platform.ts";

type DialogResult =
  | { ok: true; path: string }
  | {
    ok: false;
    reason: "cancelled" | "unavailable" | "error";
    detail?: string;
  };

type InfoDialogResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "error"; detail?: string };

type ChoiceDialogResult =
  | { ok: true; id: string }
  | {
    ok: false;
    reason: "cancelled" | "unavailable" | "error";
    detail?: string;
  };

type ConfirmDialogResult =
  | { ok: true; confirmed: boolean }
  | { ok: false; reason: "unavailable" | "error"; detail?: string };

type UnsavedChoice = "save" | "discard" | "cancel";

type UnsavedDialogResult =
  | { ok: true; choice: UnsavedChoice }
  | { ok: false; reason: "unavailable" | "error"; detail?: string };

interface ChoiceOption {
  id: string;
  label: string;
}

function ensureExcalidrawExt(path: string): string {
  return path.endsWith(".excalidraw") ? path : `${path}.excalidraw`;
}

export function psSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function utf16LeBase64(text: string): string {
  const buf = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    buf[i * 2] = c & 0xff;
    buf[i * 2 + 1] = c >> 8;
  }
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin);
}

const WINFORMS_PREAMBLE = `Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
`;

export function buildWinOpenFileScript(
  title: string,
  filter: string,
  initialDir?: string,
): string {
  const dirLine = initialDir
    ? `$d.InitialDirectory = ${psSingleQuote(initialDir)}\n`
    : "";
  return `${WINFORMS_PREAMBLE}$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = ${psSingleQuote(title)}
$d.Filter = ${psSingleQuote(filter)}
$d.FilterIndex = 1
$d.RestoreDirectory = $true
${dirLine}if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($d.FileName)
  exit 0
}
exit 1
`;
}

export function buildWinSaveFileScript(
  title: string,
  filter: string,
  defaultPath: string,
): string {
  const slash = defaultPath.replace(/\\/g, "/");
  const last = slash.lastIndexOf("/");
  const dir = last >= 0 ? slash.slice(0, last) : "";
  const name = last >= 0 ? slash.slice(last + 1) : slash;
  const dirLine = dir.length > 0
    ? `$d.InitialDirectory = ${psSingleQuote(dir)}\n`
    : "";
  return `${WINFORMS_PREAMBLE}$d = New-Object System.Windows.Forms.SaveFileDialog
$d.Title = ${psSingleQuote(title)}
$d.Filter = ${psSingleQuote(filter)}
$d.FilterIndex = 1
$d.OverwritePrompt = $true
$d.AddExtension = $true
$d.DefaultExt = 'excalidraw'
$d.FileName = ${psSingleQuote(name || "drawing.excalidraw")}
$d.RestoreDirectory = $true
${dirLine}if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($d.FileName)
  exit 0
}
exit 1
`;
}

export function buildWinFolderScript(title: string, startDir: string): string {
  return `${WINFORMS_PREAMBLE}$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = ${psSingleQuote(title)}
$d.SelectedPath = ${psSingleQuote(startDir)}
$d.ShowNewFolderButton = $true
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($d.SelectedPath)
  exit 0
}
exit 1
`;
}

export function buildWinInfoScript(title: string, text: string): string {
  return `${WINFORMS_PREAMBLE}[void][System.Windows.Forms.MessageBox]::Show(${psSingleQuote(text)}, ${psSingleQuote(title)}, [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
exit 0
`;
}

export function buildWinConfirmScript(title: string, text: string): string {
  return `${WINFORMS_PREAMBLE}$r = [System.Windows.Forms.MessageBox]::Show(${psSingleQuote(text)}, ${psSingleQuote(title)}, [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Question)
if ($r -eq [System.Windows.Forms.DialogResult]::Yes) { exit 0 }
if ($r -eq [System.Windows.Forms.DialogResult]::No) { exit 1 }
exit 2
`;
}

export function buildWinUnsavedScript(title: string, text: string): string {
  return `${WINFORMS_PREAMBLE}$form = New-Object System.Windows.Forms.Form
$form.Text = ${psSingleQuote(title)}
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.Width = 440
$form.Height = 180
$form.ShowInTaskbar = $false
$label = New-Object System.Windows.Forms.Label
$label.Text = ${psSingleQuote(text)}
$label.Left = 16
$label.Top = 16
$label.Width = 390
$label.Height = 60
$form.Controls.Add($label)
$choice = 'cancel'
$save = New-Object System.Windows.Forms.Button
$save.Text = 'Save'
$save.Width = 90
$save.Left = 110
$save.Top = 100
$save.Add_Click({ $script:choice = 'save'; $form.Close() })
$discard = New-Object System.Windows.Forms.Button
$discard.Text = 'Discard'
$discard.Width = 90
$discard.Left = 210
$discard.Top = 100
$discard.Add_Click({ $script:choice = 'discard'; $form.Close() })
$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = 'Cancel'
$cancel.Width = 90
$cancel.Left = 310
$cancel.Top = 100
$cancel.Add_Click({ $script:choice = 'cancel'; $form.Close() })
$form.Controls.Add($save)
$form.Controls.Add($discard)
$form.Controls.Add($cancel)
$form.CancelButton = $cancel
$form.AcceptButton = $save
[void]$form.ShowDialog()
[Console]::Out.Write($choice)
exit 0
`;
}

export function buildWinChoiceScript(
  title: string,
  text: string,
  options: ChoiceOption[],
  defaultId?: string,
): string {
  const radioLines: string[] = [];
  let y = 48;
  for (const opt of options) {
    const checked = opt.id === defaultId ? "$true" : "$false";
    radioLines.push(
      `$r = New-Object System.Windows.Forms.RadioButton
$r.Text = ${psSingleQuote(opt.label)}
$r.Tag = ${psSingleQuote(opt.id)}
$r.Left = 16
$r.Top = ${y}
$r.Width = 380
$r.Checked = ${checked}
$form.Controls.Add($r)
$radios += $r`,
    );
    y += 28;
  }
  const height = Math.max(180, y + 80);
  return `${WINFORMS_PREAMBLE}$form = New-Object System.Windows.Forms.Form
$form.Text = ${psSingleQuote(title)}
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.Width = 440
$form.Height = ${height}
$form.ShowInTaskbar = $false
$label = New-Object System.Windows.Forms.Label
$label.Text = ${psSingleQuote(text)}
$label.Left = 16
$label.Top = 12
$label.Width = 390
$label.Height = 32
$form.Controls.Add($label)
$radios = @()
${radioLines.join("\n")}
$ok = New-Object System.Windows.Forms.Button
$ok.Text = 'OK'
$ok.Width = 90
$ok.Left = 220
$ok.Top = ${y + 8}
$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = 'Cancel'
$cancel.Width = 90
$cancel.Left = 320
$cancel.Top = ${y + 8}
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($ok)
$form.Controls.Add($cancel)
$form.AcceptButton = $ok
$form.CancelButton = $cancel
$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  foreach ($r in $radios) {
    if ($r.Checked) {
      [Console]::Out.Write([string]$r.Tag)
      exit 0
    }
  }
}
exit 1
`;
}

export function parseWinUnsavedOutcome(stdout: string): UnsavedChoice | null {
  const out = stdout.trim().toLowerCase();
  if (out === "save" || out === "discard" || out === "cancel") return out;
  return null;
}

export const EXCALIDRAW_FILTER =
  "Excalidraw (*.excalidraw)|*.excalidraw|All files (*.*)|*.*";
export const IMAGE_FILTER =
  "Images (*.png;*.jpg;*.jpeg;*.gif;*.webp;*.svg)|*.png;*.jpg;*.jpeg;*.gif;*.webp;*.svg|All files (*.*)|*.*";

async function runPowerShell(
  script: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const encoded = utf16LeBase64(script);
  const cmd = new Deno.Command("powershell.exe", {
    args: [
      "-NoProfile",
      "-STA",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encoded,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

function mapPathResult(
  code: number,
  stdout: string,
  stderr: string,
): DialogResult {
  const text = stdout.trim();
  if (code === 0 && text.length > 0) return { ok: true, path: text };
  if (code === 1 && text.length === 0) return { ok: false, reason: "cancelled" };
  return {
    ok: false,
    reason: "error",
    detail: stderr.trim() || `powershell exited with code ${code}`,
  };
}

export async function winOpenExcalidrawDialog(): Promise<DialogResult> {
  const { code, stdout, stderr } = await runPowerShell(
    buildWinOpenFileScript("Open Excalidraw file", EXCALIDRAW_FILTER, homeDir()),
  );
  return mapPathResult(code, stdout, stderr);
}

export async function winSaveExcalidrawDialog(
  defaultNameOrPath = "drawing.excalidraw",
): Promise<DialogResult> {
  try {
    const forced = Deno.env.get("EXCALIDRAW_FORCE_SAVE_PATH");
    if (forced && forced.trim()) {
      return { ok: true, path: ensureExcalidrawExt(forced.trim()) };
    }
  } catch {
    // ignore
  }
  const defaultPath = defaultNameOrPath.includes("/") ||
      defaultNameOrPath.includes("\\")
    ? defaultNameOrPath
    : `${homeDir()}/${defaultNameOrPath}`;
  const { code, stdout, stderr } = await runPowerShell(
    buildWinSaveFileScript("Save Excalidraw file", EXCALIDRAW_FILTER, defaultPath),
  );
  const result = mapPathResult(code, stdout, stderr);
  if (result.ok) return { ok: true, path: ensureExcalidrawExt(result.path) };
  return result;
}

export async function winOpenImageDialog(): Promise<DialogResult> {
  const { code, stdout, stderr } = await runPowerShell(
    buildWinOpenFileScript("Import image", IMAGE_FILTER, homeDir()),
  );
  return mapPathResult(code, stdout, stderr);
}

export async function winOpenDirectoryDialog(
  title: string,
  startDir: string,
): Promise<DialogResult> {
  const { code, stdout, stderr } = await runPowerShell(
    buildWinFolderScript(title, startDir),
  );
  return mapPathResult(code, stdout, stderr);
}

export async function winInfoDialog(
  title: string,
  text: string,
): Promise<InfoDialogResult> {
  try {
    const { code, stderr } = await runPowerShell(buildWinInfoScript(title, text));
    if (code === 0) return { ok: true };
    return {
      ok: false,
      reason: "error",
      detail: stderr.trim() || `exit ${code}`,
    };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}

export async function winConfirmDialog(
  title: string,
  text: string,
): Promise<ConfirmDialogResult> {
  try {
    const { code, stderr } = await runPowerShell(
      buildWinConfirmScript(title, text),
    );
    if (code === 0) return { ok: true, confirmed: true };
    if (code === 1) return { ok: true, confirmed: false };
    return {
      ok: false,
      reason: "error",
      detail: stderr.trim() || `exit ${code}`,
    };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}

export async function winUnsavedChangesDialog(
  title: string,
  text: string,
): Promise<UnsavedDialogResult> {
  try {
    const { code, stdout, stderr } = await runPowerShell(
      buildWinUnsavedScript(title, text),
    );
    const choice = parseWinUnsavedOutcome(stdout);
    if (code === 0 && choice) return { ok: true, choice };
    return {
      ok: false,
      reason: "error",
      detail: stderr.trim() || `exit ${code}`,
    };
  } catch (err) {
    return { ok: false, reason: "error", detail: String(err) };
  }
}

export async function winChoiceDialog(
  title: string,
  text: string,
  options: ChoiceOption[],
  defaultId?: string,
): Promise<ChoiceDialogResult> {
  if (options.length === 0) {
    return { ok: false, reason: "error", detail: "no options" };
  }
  const { code, stdout, stderr } = await runPowerShell(
    buildWinChoiceScript(title, text, options, defaultId),
  );
  const printed = stdout.trim();
  if (code === 0 && printed.length > 0) {
    const byId = options.find((o) => o.id === printed);
    if (byId) return { ok: true, id: byId.id };
    return { ok: false, reason: "error", detail: `unknown choice: ${printed}` };
  }
  if (code === 1) return { ok: false, reason: "cancelled" };
  return {
    ok: false,
    reason: "error",
    detail: stderr.trim() || `exit ${code}`,
  };
}

export async function describeWindowsDialogBackend(): Promise<string> {
  return "powershell";
}
