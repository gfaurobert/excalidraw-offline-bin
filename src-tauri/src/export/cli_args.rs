use crate::paths::resolve_open_path;
use super::selectors::ExportBBox;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct ParsedExportCli {
    pub document_path: std::path::PathBuf,
    pub frames: Vec<String>,
    pub all_frames: bool,
    pub element_ids: Vec<String>,
    pub bbox: Option<ExportBBox>,
    pub out: Option<String>,
    pub scale: f64,
    pub json: bool,
}

pub fn wants_top_level_help(args: &[String]) -> bool {
    if find_export_subcommand_index(args) >= 0 {
        return false;
    }
    args.iter()
        .any(|a| a.trim() == "--help" || a.trim() == "-h")
}

pub fn wants_export_help(args: &[String]) -> bool {
    let tail = strip_leading_argv(args);
    let export_at = tail.iter().position(|a| a == "export");
    let Some(at) = export_at else {
        return false;
    };
    tail[at + 1..]
        .iter()
        .any(|a| a == "--help" || a == "-h")
}

fn find_export_subcommand_index(args: &[String]) -> isize {
    for (i, a) in args.iter().enumerate().rev() {
        if a == "export" {
            return i as isize;
        }
    }
    -1
}

fn strip_leading_argv(args: &[String]) -> Vec<String> {
    let mut out: Vec<String> = args.to_vec();
    if !out.is_empty() {
        out.remove(0);
    }
    while out.first().is_some_and(|t| t.starts_with('-') && t != "--") {
        out.remove(0);
    }
    out
}

pub fn parse_export_cli(args: &[String], cwd: &Path) -> Result<Option<ParsedExportCli>, String> {
    if find_export_subcommand_index(args) < 0 {
        return Ok(None);
    }
    if wants_export_help(args) {
        return Err("__HELP_EXPORT__".into());
    }

    let tail = strip_leading_argv(args);
    let export_at = tail.iter().position(|a| a == "export").unwrap();
    let tokens = &tail[export_at + 1..];

    let mut document_candidates = Vec::new();
    let mut frames = Vec::new();
    let mut element_ids = Vec::new();
    let mut all_frames = false;
    let mut bbox = None;
    let mut out = None;
    let mut scale = 2.0_f64;
    let mut json = false;

    let mut i = 0;
    while i < tokens.len() {
        let t = &tokens[i];
        if t == "--" {
            i += 1;
            continue;
        }
        if t == "--all-frames" {
            all_frames = true;
            i += 1;
            continue;
        }
        if t == "--json" {
            json = true;
            i += 1;
            continue;
        }
        if t == "--frame" {
            let v = tokens.get(i + 1).ok_or("--frame requires a value")?;
            if v.starts_with('-') {
                return Err("--frame requires a value".into());
            }
            frames.push(v.clone());
            i += 2;
            continue;
        }
        if t == "--element" {
            let v = tokens.get(i + 1).ok_or("--element requires a value")?;
            if v.starts_with('-') {
                return Err("--element requires a value".into());
            }
            element_ids.push(v.clone());
            i += 2;
            continue;
        }
        if t == "--bbox" {
            let v = tokens.get(i + 1).ok_or("--bbox requires a value")?;
            let parts: Vec<&str> = v.split(',').map(|p| p.trim()).collect();
            if parts.len() != 4 {
                return Err("--bbox expects x,y,width,height".into());
            }
            let nums: Result<Vec<f64>, _> = parts.iter().map(|p| p.parse()).collect();
            let nums = nums.map_err(|_| "--bbox values must be numbers")?;
            if nums[2] <= 0.0 || nums[3] <= 0.0 {
                return Err("--bbox width and height must be positive".into());
            }
            bbox = Some(ExportBBox {
                x: nums[0],
                y: nums[1],
                w: nums[2],
                h: nums[3],
            });
            i += 2;
            continue;
        }
        if t == "--out" || t == "-d" {
            let v = tokens.get(i + 1).ok_or(format!("{t} requires a value"))?;
            if v.starts_with('-') {
                return Err(format!("{t} requires a value"));
            }
            out = Some(v.clone());
            i += 2;
            continue;
        }
        if t == "--scale" {
            let v = tokens.get(i + 1).ok_or("--scale requires a value")?;
            let n: f64 = v.parse().map_err(|_| "--scale must be a number between 0 and 8")?;
            if !(n > 0.0 && n <= 8.0) {
                return Err("--scale must be a number between 0 and 8".into());
            }
            scale = n;
            i += 2;
            continue;
        }
        if t.starts_with('-') {
            return Err(format!("Unknown export flag: {t}"));
        }
        if t.to_lowercase().ends_with(".excalidraw") {
            document_candidates.push(t.clone());
            i += 1;
            continue;
        }
        return Err(format!("Unexpected argument: {t}"));
    }

    if document_candidates.is_empty() {
        return Err("Usage: excalidraw-offline export <file.excalidraw> [options]".into());
    }

    let document_raw = document_candidates.last().unwrap();
    if !document_raw.to_lowercase().ends_with(".excalidraw") {
        return Err("Export path must end with .excalidraw".into());
    }

    let mut document_path = resolve_open_path(document_raw, cwd);
    if let Some(ref o) = out {
        let resolved = resolve_open_path(o, cwd);
        out = Some(resolved.to_string_lossy().into_owned());
    }

    Ok(Some(ParsedExportCli {
        document_path,
        frames,
        all_frames,
        element_ids,
        bbox,
        out,
        scale,
        json,
    }))
}

pub fn print_top_level_help() {
    println!(
        r#"Excalidraw Offline — local desktop app for .excalidraw files.

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
"#
    );
}

pub fn print_export_help() {
    println!(
        r#"excalidraw-offline export — write PNG(s) from a .excalidraw file (headless).

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
  --json                    Print {{"paths":["…"]}} on stdout instead of paths

Default location: same folder as the .excalidraw file.
Default filename:  {{drawingBase}}_{{YYYYMMDD-HHMMSS}}.png
Frame exports:     {{drawingBase}}_{{frameName}}_{{YYYYMMDD-HHMMSS}}.png
Collisions:        -2, -3, … suffix before .png

Exit codes:
  0  Success; written path(s) on stdout (or JSON with --json)
  1  Usage, missing file, unknown frame/element, empty bbox, or export failure

Examples:
  excalidraw-offline export wireframes.excalidraw --all-frames -d ~/sketches/export
  excalidraw-offline export wireframes.excalidraw --frame "Login" --scale 3
  excalidraw-offline export wireframes.excalidraw --element rect-id --json
"#
    );
}
