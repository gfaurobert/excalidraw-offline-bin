/** CLI help text for terminal / coding agents (stdout, exit 0). */

import {
  findExportSubcommandIndex,
  stripLeadingDesktopArgv,
} from "./process-argv.ts";

function tailHasHelpFlag(tokens: readonly string[]): boolean {
  return tokens.some((t) => t === "--help" || t === "-h");
}

/** True when argv requests top-level help (no `export` subcommand). */
export function wantsTopLevelHelp(args: readonly string[]): boolean {
  if (findExportSubcommandIndex(args) >= 0) return false;
  return args.some((a) => {
    const t = a.trim();
    return t === "--help" || t === "-h";
  });
}

/** True when argv includes `export` and `--help` / `-h` after it. */
export function wantsExportHelp(args: readonly string[]): boolean {
  const tail = stripLeadingDesktopArgv(args);
  const exportAt = tail.indexOf("export");
  if (exportAt < 0) return false;
  return tailHasHelpFlag(tail.slice(exportAt + 1));
}

export function printTopLevelHelp(): void {
  console.log(`Excalidraw Offline — local desktop app for .excalidraw files.

Usage:
  excalidraw-offline [file.excalidraw]
  excalidraw-offline export <file.excalidraw> [options]

Open or create a drawing (GUI):
  excalidraw-offline sketches/wireframes.excalidraw

Headless PNG export (hidden webview, same export path as the GUI):
  excalidraw-offline export sketches/wireframes.excalidraw
  excalidraw-offline export sketches/wireframes.excalidraw --all-frames -d ./exports

Export flags and examples:
  excalidraw-offline export --help
`);
}

export function printExportHelp(): void {
  console.log(`excalidraw-offline export — write PNG(s) from a .excalidraw file (headless).

Usage:
  excalidraw-offline export <file.excalidraw> [options]

Selectors (use one kind only):
  (default)                 Whole scene bounding box
  --frame NAME              Repeatable; exact frame name; one PNG per match
  --all-frames              One PNG per named frame in the file
  --element ID              Repeatable; export selection of listed element ids
  --bbox x,y,width,height   Scene coords; elements intersecting the rectangle

Output:
  --out PATH, -d DIR        Destination directory, or a single .png path when
                            there is exactly one export job. Creates missing
                            directories recursively.
  --scale N                 Export scale (default 2, max 8)
  --json                    Print {"paths":["…"]} on stdout instead of paths

Default location: same folder as the .excalidraw file.
Default filename:  {drawingBase}_{YYYYMMDD-HHMMSS}.png
Frame exports:     {drawingBase}_{frameName}_{YYYYMMDD-HHMMSS}.png
Collisions:        -2, -3, … suffix before .png

Exit codes:
  0  Success; written path(s) on stdout (or JSON with --json)
  1  Usage, missing file, unknown frame/element, empty bbox, or export failure

Examples:
  excalidraw-offline export wireframes.excalidraw --all-frames -d ~/sketches/export
  excalidraw-offline export wireframes.excalidraw --frame "Login" --scale 3
  excalidraw-offline export wireframes.excalidraw --element rect-id --json

Repo checkout:
  deno task export -- wireframes.excalidraw --all-frames -d ./png-out
`);
}
