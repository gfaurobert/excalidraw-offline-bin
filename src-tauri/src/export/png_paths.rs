use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::path::{Path, PathBuf};

pub fn decode_png_base64(b64: &str) -> Result<Vec<u8>, String> {
    let trimmed = b64.trim();
    if trimmed.is_empty() {
        return Err("empty PNG payload".into());
    }
    STANDARD.decode(trimmed).map_err(|e| e.to_string())
}

fn sanitize_filename_part(part: &str) -> String {
    let mut s: String = part
        .trim()
        .chars()
        .map(|c| {
            if r#"\/:*?"<>|"#.contains(c) {
                '_'
            } else {
                c
            }
        })
        .collect();
    while s.contains("  ") {
        s = s.replace("  ", " ");
    }
    s = s.trim_end_matches(['.', ' ']).to_string();
    if s.is_empty() {
        "drawing".to_string()
    } else {
        s
    }
}

pub fn drawing_directory_for_document(document_path: &Path) -> PathBuf {
    document_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf()
}

pub fn drawing_base_name_from_path(document_path: &Path) -> String {
    let file = document_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("drawing");
    let lower = file.to_lowercase();
    let stem = if lower.ends_with(".excalidraw") {
        &file[..file.len() - ".excalidraw".len()]
    } else if let Some(dot) = file.rfind('.') {
        &file[..dot]
    } else {
        file
    };
    sanitize_filename_part(stem)
}

fn with_collision_suffix(filename: &str, attempt: u32) -> String {
    if attempt == 0 {
        return filename.to_string();
    }
    let lower = filename.to_lowercase();
    if lower.ends_with(".png") {
        let stem = &filename[..filename.len() - 4];
        format!("{stem}-{}.png", attempt + 1)
    } else {
        format!("{filename}-{}", attempt + 1)
    }
}

pub fn pick_unique_export_filename(
    directory: &Path,
    preferred: &str,
) -> Result<(String, PathBuf), String> {
    for attempt in 0..1000 {
        let filename = with_collision_suffix(preferred, attempt);
        let absolute = directory.join(&filename);
        if !absolute.exists() {
            return Ok((filename, absolute));
        }
    }
    Err("too many export PNG name collisions".into())
}

pub fn resolve_export_output_location(
    document_path: &Path,
    preferred_filename: &str,
    out_override: Option<&str>,
    job_count: usize,
) -> Result<(PathBuf, String), String> {
    let Some(out) = out_override.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok((
            drawing_directory_for_document(document_path),
            preferred_filename.to_string(),
        ));
    };
    if out.to_lowercase().ends_with(".png") {
        if job_count != 1 {
            return Err("--out <file.png> requires exactly one export job".into());
        }
        let p = PathBuf::from(out);
        let filename = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(preferred_filename)
            .to_string();
        let dir = p
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf();
        return Ok((dir, filename));
    }
    Ok((PathBuf::from(out), preferred_filename.to_string()))
}
