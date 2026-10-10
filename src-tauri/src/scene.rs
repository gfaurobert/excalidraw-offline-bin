use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};

const SOURCE: &str = "excalidraw-offline-bin";

fn mime_to_ext(mime: &str) -> &str {
    match mime {
        "image/png" => "png",
        "image/jpeg" | "image/jpg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        _ => "bin",
    }
}

fn mime_from_ext(ext: &str) -> &str {
    match ext.trim_start_matches('.').to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

fn data_url_to_bytes(data_url: &str) -> Result<Vec<u8>, String> {
    let Some((_, b64)) = data_url.split_once(";base64,") else {
        return Err("Invalid data URL".into());
    };
    STANDARD
        .decode(b64)
        .map_err(|e| format!("base64 decode: {e}"))
}

pub fn bytes_to_data_url(bytes: &[u8], mime: &str) -> String {
    format!("data:{mime};base64,{}", STANDARD.encode(bytes))
}

pub async fn write_scene(document_path: &Path, scene: &Value) -> Result<(), String> {
    let dir = document_path
        .parent()
        .ok_or_else(|| "document path has no parent".to_string())?;
    let assets_dir = dir.join("assets");
    tokio::fs::create_dir_all(&assets_dir)
        .await
        .map_err(|e| e.to_string())?;

    let files_obj = scene.get("files").and_then(|v| v.as_object()).cloned();
    let mut stored_files = Map::new();

    if let Some(files) = files_obj {
        for (id, file) in files {
            let mime = file
                .get("mimeType")
                .and_then(|v| v.as_str())
                .unwrap_or("application/octet-stream");
            let ext = mime_to_ext(mime);
            let relative = format!("assets/{id}.{ext}");
            let absolute = dir.join(&relative);

            if let Some(data_url) = file.get("dataURL").and_then(|v| v.as_str()) {
                let bytes = data_url_to_bytes(data_url)?;
                tokio::fs::write(&absolute, bytes)
                    .await
                    .map_err(|e| e.to_string())?;
            } else if !absolute.is_file() {
                return Err(format!("Missing asset data for file id {id}"));
            }

            let mut entry = Map::new();
            entry.insert("mimeType".into(), json!(mime));
            entry.insert("id".into(), json!(id));
            entry.insert("path".into(), json!(relative));
            entry.insert(
                "created".into(),
                file.get("created").cloned().unwrap_or(json!(chrono::Utc::now().timestamp_millis())),
            );
            if let Some(lr) = file.get("lastRetrieved") {
                entry.insert("lastRetrieved".into(), lr.clone());
            }
            stored_files.insert(id, Value::Object(entry));
        }
    }

    let mut app_state = scene
        .get("appState")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    app_state.remove("collaborators");

    let document = json!({
        "type": "excalidraw",
        "version": 2,
        "source": SOURCE,
        "elements": scene.get("elements").cloned().unwrap_or(json!([])),
        "appState": app_state,
        "files": stored_files,
    });

    let text = serde_json::to_string_pretty(&document).map_err(|e| e.to_string())?;
    tokio::fs::write(document_path, format!("{text}\n"))
        .await
        .map_err(|e| e.to_string())
}

pub async fn read_scene(document_path: &Path) -> Result<Value, String> {
    let text = tokio::fs::read_to_string(document_path)
        .await
        .map_err(|e| e.to_string())?;
    let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let dir = document_path
        .parent()
        .ok_or_else(|| "document path has no parent".to_string())?;

    let mut files_out = Map::new();
    if let Some(files) = parsed.get("files").and_then(|v| v.as_object()) {
        for (id, entry) in files {
            if let Some(path_rel) = entry.get("path").and_then(|v| v.as_str()) {
                let mime = entry
                    .get("mimeType")
                    .and_then(|v| v.as_str())
                    .unwrap_or("application/octet-stream");
                let absolute = dir.join(path_rel);
                let bytes = tokio::fs::read(&absolute).await.map_err(|e| e.to_string())?;
                let mut f = Map::new();
                f.insert("mimeType".into(), json!(mime));
                f.insert("id".into(), json!(id));
                f.insert(
                    "dataURL".into(),
                    json!(bytes_to_data_url(&bytes, mime)),
                );
                if let Some(c) = entry.get("created") {
                    f.insert("created".into(), c.clone());
                }
                f.insert(
                    "lastRetrieved".into(),
                    entry
                        .get("lastRetrieved")
                        .cloned()
                        .unwrap_or(json!(chrono::Utc::now().timestamp_millis())),
                );
                files_out.insert(id.clone(), Value::Object(f));
                continue;
            }
            if entry.get("dataURL").is_some() {
                files_out.insert(id.clone(), entry.clone());
            }
        }
    }

    Ok(json!({
        "elements": parsed.get("elements").cloned().unwrap_or(json!([])),
        "appState": parsed.get("appState").cloned().unwrap_or(json!({})),
        "files": files_out,
    }))
}

pub fn mime_from_path(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    mime_from_ext(ext).to_string()
}

pub fn read_image_file(path: &Path) -> Result<(String, String, String), String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("image")
        .to_string();
    let mime = mime_from_path(path);
    Ok((name, mime.clone(), bytes_to_data_url(&bytes, &mime)))
}
