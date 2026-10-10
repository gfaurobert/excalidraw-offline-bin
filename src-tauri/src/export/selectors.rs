use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ExportBBox {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Debug, Clone)]
pub struct ResolvedExportJob {
    pub job_id: String,
    pub selected_element_ids: HashMap<String, bool>,
    pub exporting_frame_id: Option<String>,
    pub frame_name_sanitized: Option<String>,
}

pub struct ExportSelectorInput<'a> {
    pub frames: &'a [String],
    pub all_frames: bool,
    pub element_ids: &'a [String],
    pub bbox: Option<ExportBBox>,
}

fn sanitize_frame_name(name: &str) -> String {
    let mut s: String = name
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
    if s.len() > 80 {
        s.truncate(80);
        s = s.trim_end_matches(['.', ' ']).to_string();
    }
    s
}

fn live_elements(elements: &[Value]) -> Vec<&Value> {
    elements
        .iter()
        .filter(|el| !el.get("isDeleted").and_then(|v| v.as_bool()).unwrap_or(false))
        .collect()
}

fn frame_elements(elements: &[Value]) -> Vec<&Value> {
    live_elements(elements)
        .into_iter()
        .filter(|el| el.get("type").and_then(|v| v.as_str()) == Some("frame"))
        .collect()
}

fn job_for_frame(frame: &Value, index: usize) -> ResolvedExportJob {
    let id = frame.get("id").and_then(|v| v.as_str()).unwrap_or("frame");
    let name = frame.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let sanitized = sanitize_frame_name(name);
    let mut selected = HashMap::new();
    selected.insert(id.to_string(), true);
    ResolvedExportJob {
        job_id: format!("frame-{id}-{index}"),
        selected_element_ids: selected,
        exporting_frame_id: Some(id.to_string()),
        frame_name_sanitized: if sanitized.is_empty() {
            None
        } else {
            Some(sanitized)
        },
    }
}

pub fn resolve_export_jobs(
    elements: &[Value],
    input: ExportSelectorInput<'_>,
) -> Result<Vec<ResolvedExportJob>, String> {
    let has_frames = input.all_frames || !input.frames.is_empty();
    let has_elements = !input.element_ids.is_empty();
    let has_bbox = input.bbox.is_some();
    let mode_count = [has_frames, has_elements, has_bbox]
        .iter()
        .filter(|&&b| b)
        .count();
    if mode_count > 1 {
        return Err(
            "Use only one selector kind: --frame/--all-frames, --element, or --bbox".into(),
        );
    }

    if input.all_frames || !input.frames.is_empty() {
        let mut jobs = Vec::new();
        if input.all_frames {
            let frames: Vec<&Value> = frame_elements(elements)
                .into_iter()
                .filter(|f| {
                    let n = f.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    !sanitize_frame_name(n).is_empty()
                })
                .collect();
            if frames.is_empty() {
                return Err("No named frames found in the drawing".into());
            }
            for (i, frame) in frames.into_iter().enumerate() {
                jobs.push(job_for_frame(frame, i));
            }
        } else {
            for name in input.frames {
                let wanted = name.trim();
                let matches: Vec<&Value> = frame_elements(elements)
                    .into_iter()
                    .filter(|f| f.get("name").and_then(|v| v.as_str()).unwrap_or("").trim() == wanted)
                    .collect();
                if matches.is_empty() {
                    return Err(format!("Frame not found: {wanted}"));
                }
                for (i, frame) in matches.into_iter().enumerate() {
                    jobs.push(job_for_frame(frame, i));
                }
            }
        }
        return Ok(jobs);
    }

    if !input.element_ids.is_empty() {
        let live = live_elements(elements);
        let mut ids = HashMap::new();
        for id in input.element_ids {
            let trimmed = id.trim();
            if trimmed.is_empty() {
                continue;
            }
            if !live.iter().any(|el| el.get("id").and_then(|v| v.as_str()) == Some(trimmed)) {
                return Err(format!("Element not found: {trimmed}"));
            }
            ids.insert(trimmed.to_string(), true);
        }
        if ids.is_empty() {
            return Err("No element ids provided".into());
        }
        return Ok(vec![ResolvedExportJob {
            job_id: "elements".into(),
            selected_element_ids: ids,
            exporting_frame_id: None,
            frame_name_sanitized: None,
        }]);
    }

    if let Some(bbox) = &input.bbox {
        let mut ids = HashMap::new();
        for el in live_elements(elements) {
            let Some(x) = el.get("x").and_then(|v| v.as_f64()) else {
                continue;
            };
            let Some(y) = el.get("y").and_then(|v| v.as_f64()) else {
                continue;
            };
            let w = el.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let h = el.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let ex2 = x + w;
            let ey2 = y + h;
            let bx2 = bbox.x + bbox.w;
            let by2 = bbox.y + bbox.h;
            if !(ex2 < bbox.x || x > bx2 || ey2 < bbox.y || y > by2) {
                if let Some(id) = el.get("id").and_then(|v| v.as_str()) {
                    ids.insert(id.to_string(), true);
                }
            }
        }
        if ids.is_empty() {
            return Err("No elements intersect the given --bbox".into());
        }
        return Ok(vec![ResolvedExportJob {
            job_id: "bbox".into(),
            selected_element_ids: ids,
            exporting_frame_id: None,
            frame_name_sanitized: None,
        }]);
    }

    Ok(vec![ResolvedExportJob {
        job_id: "whole-scene".into(),
        selected_element_ids: HashMap::new(),
        exporting_frame_id: None,
        frame_name_sanitized: None,
    }])
}
