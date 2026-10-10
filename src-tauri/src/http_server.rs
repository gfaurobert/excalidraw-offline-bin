use crate::app_state::{AppState, UiCommand, UiMode};
use crate::dialogs::{
    dialog_backend_label, open_excalidraw_dialog, open_image_dialog, save_excalidraw_dialog,
    save_image_export_dialog, suggested_image_export_path, unsaved_changes_dialog, DialogResult,
};
use crate::export::{
    decode_png_base64, pick_unique_export_filename, resolve_export_output_location,
};
use crate::menu::refresh_menu;
use crate::paths::home_dir;
use crate::scene::{read_image_file, read_scene, write_scene};
use axum::{
    extract::State,
    http::header,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;

pub async fn start_http_server(state: Arc<AppState>) -> u16 {
    let dist = state.dist_dir.clone();
    let static_service = ServeDir::new(&dist).append_index_html_on_directories(true);

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/info", get(info))
        .route("/api/recent", get(recent))
        .route("/api/poll", get(poll))
        .route("/api/focus", post(focus))
        .route("/api/log", post(log))
        .route("/api/set-mode", post(set_mode))
        .route("/api/set-title", post(set_title))
        .route("/api/set-path", post(set_path))
        .route("/api/pick-open", post(pick_open))
        .route("/api/pick-save", post(pick_save))
        .route("/api/pick-save-image-export", post(pick_save_image))
        .route("/api/pick-image", post(pick_image))
        .route("/api/read", post(read))
        .route("/api/write", post(write))
        .route("/api/write-binary", post(write_binary))
        .route("/api/unsaved", post(unsaved))
        .route("/api/quit", post(quit))
        .route("/api/quit-aborted", post(quit_aborted))
        .route("/api/cli-export/session", get(cli_session))
        .route("/api/cli-export/png", post(cli_png))
        .route("/api/cli-export/finish", post(cli_finish))
        .route("/api/cli-export/fail", post(cli_fail))
        .fallback_service(static_service)
        .layer(SetResponseHeaderLayer::overriding(
            header::CACHE_CONTROL,
            header::HeaderValue::from_static("no-cache"),
        ))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
        .await
        .expect("bind localhost");
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });
    port
}

async fn health(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "ok": true,
        "path": state.current_path.lock().clone(),
        "queue": state.ui_queue.lock().len(),
    }))
}

async fn info(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "dialogBackend": dialog_backend_label(),
        "bindings": false,
        "path": state.current_path.lock().clone(),
        "home": home_dir().to_string_lossy(),
        "excalidrawVersion": "0.18.0-4ce38fb",
        "e2e": false,
    }))
}

async fn recent(State(state): State<Arc<AppState>>) -> Json<Value> {
    let paths = state.recent.list();
    let labels: Vec<String> = paths
        .iter()
        .map(|p| {
            std::path::Path::new(p)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(p)
                .to_string()
        })
        .collect();
    Json(json!({ "ok": true, "paths": paths, "labels": labels }))
}

async fn poll(State(state): State<Arc<AppState>>) -> Json<Value> {
    let cmd = {
        let mut q = state.ui_queue.lock();
        if q.is_empty() {
            None
        } else {
            Some(q.remove(0))
        }
    }
    .map(|c| match c {
        UiCommand::Status { message } => json!({ "type": "status", "message": message }),
        UiCommand::New => json!({ "type": "new" }),
        UiCommand::Open { path } => json!({ "type": "open", "path": path }),
        UiCommand::Save { force_picker, path } => {
            json!({ "type": "save", "forcePicker": force_picker, "path": path })
        }
        UiCommand::Reload => json!({ "type": "reload" }),
        UiCommand::Close => json!({ "type": "close" }),
        UiCommand::Quit => json!({ "type": "quit" }),
    });
    Json(json!({ "cmd": cmd }))
}

async fn focus(State(state): State<Arc<AppState>>) -> Json<Value> {
    let now = chrono::Utc::now().timestamp_millis();
    *state.last_focused_at.lock() = now;
    Json(json!({ "ok": true, "lastFocusedAt": now }))
}

async fn log(Json(body): Json<Value>) -> Json<Value> {
    let level = body.get("level").and_then(|v| v.as_str()).unwrap_or("info");
    let message = body.get("message").and_then(|v| v.as_str()).unwrap_or("");
    if level == "error" {
        eprintln!("[ui/error] {message}");
    } else {
        println!("[ui/info] {message}");
    }
    Json(json!({ "ok": true }))
}

async fn set_mode(
    State(state): State<Arc<AppState>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let mode = body.get("mode").and_then(|v| v.as_str()).unwrap_or("");
    let ui_mode = match mode {
        "start" => UiMode::Start,
        "canvas" => UiMode::Canvas,
        _ => return Json(json!({ "ok": false, "error": "invalid mode" })),
    };
    *state.ui_mode.lock() = ui_mode;
    refresh_menu(&state);
    Json(json!({ "ok": true, "mode": mode }))
}

async fn set_title(_: State<Arc<AppState>>, Json(_body): Json<Value>) -> Json<Value> {
    Json(json!({ "ok": true }))
}

async fn set_path(State(state): State<Arc<AppState>>, Json(body): Json<Value>) -> Json<Value> {
    let path = body.get("path").cloned();
    *state.current_path.lock() = path
        .as_ref()
        .and_then(|v| v.as_str())
        .map(String::from);
    refresh_menu(&state);
    Json(json!({ "ok": true }))
}

async fn pick_open() -> Json<Value> {
    match open_excalidraw_dialog() {
        DialogResult::Ok { path } => Json(json!({ "ok": true, "path": path })),
        DialogResult::Cancelled => Json(json!({ "ok": true, "cancelled": true })),
        DialogResult::Unavailable { detail } => {
            Json(json!({ "ok": false, "error": detail }))
        }
    }
}

async fn pick_save(Json(body): Json<Value>) -> Json<Value> {
    let suggested = body
        .get("suggested")
        .and_then(|v| v.as_str())
        .unwrap_or("drawing.excalidraw");
    match save_excalidraw_dialog(suggested) {
        DialogResult::Ok { path } => Json(json!({ "ok": true, "path": path })),
        DialogResult::Cancelled => Json(json!({ "ok": true, "cancelled": true })),
        DialogResult::Unavailable { detail } => {
            Json(json!({ "ok": false, "error": detail }))
        }
    }
}

async fn pick_save_image(
    State(state): State<Arc<AppState>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let filename = body
        .get("filename")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if filename.is_empty() {
        return Json(json!({ "ok": false, "error": "missing filename" }));
    }
    let doc = state.current_path.lock().clone();
    let suggested = suggested_image_export_path(doc.as_deref(), &home_dir(), filename);
    match save_image_export_dialog(&suggested) {
        DialogResult::Ok { path } => Json(json!({ "ok": true, "path": path })),
        DialogResult::Cancelled => Json(json!({ "ok": true, "cancelled": true })),
        DialogResult::Unavailable { detail } => {
            Json(json!({ "ok": false, "error": detail }))
        }
    }
}

async fn pick_image() -> Json<Value> {
    match open_image_dialog() {
        DialogResult::Ok { path } => {
            match read_image_file(std::path::Path::new(&path)) {
                Ok((name, mime_type, data_url)) => Json(json!({
                    "ok": true,
                    "file": { "name": name, "mimeType": mime_type, "dataURL": data_url }
                })),
                Err(e) => Json(json!({ "ok": false, "error": e })),
            }
        }
        DialogResult::Cancelled => Json(json!({ "ok": true, "file": null })),
        DialogResult::Unavailable { detail } => {
            Json(json!({ "ok": false, "error": detail }))
        }
    }
}

async fn read(State(state): State<Arc<AppState>>, Json(body): Json<Value>) -> Json<Value> {
    let path = body.get("path").and_then(|v| v.as_str()).unwrap_or("");
    if path.is_empty() {
        return Json(json!({ "ok": false, "error": "missing path" }));
    }
    match read_scene(std::path::Path::new(path)).await {
        Ok(scene) => {
            *state.current_path.lock() = Some(path.to_string());
            state.recent.touch(path);
            refresh_menu(&state);
            let mut resp = json!({ "ok": true, "path": path });
            if let Some(obj) = resp.as_object_mut() {
                if let Some(s) = scene.as_object() {
                    for (k, v) in s {
                        obj.insert(k.clone(), v.clone());
                    }
                }
            }
            Json(resp)
        }
        Err(e) => {
            if state.recent.list().iter().any(|p| p == path) {
                state.recent.remove(path);
            }
            Json(json!({ "ok": false, "error": e }))
        }
    }
}

async fn write(State(state): State<Arc<AppState>>, Json(body): Json<Value>) -> Json<Value> {
    let path = body.get("path").and_then(|v| v.as_str()).unwrap_or("");
    if path.is_empty() {
        return Json(json!({ "ok": false, "error": "missing path" }));
    }
    let scene = body.get("scene").cloned();
    let Some(scene_val) = scene else {
        return Json(json!({ "ok": false, "error": "missing scene" }));
    };
    let scene = if scene_val.is_string() {
        serde_json::from_str(scene_val.as_str().unwrap()).unwrap_or(json!({}))
    } else {
        scene_val
    };
    match write_scene(std::path::Path::new(path), &scene).await {
        Ok(()) => {
            *state.current_path.lock() = Some(path.to_string());
            state.recent.touch(path);
            refresh_menu(&state);
            Json(json!({ "ok": true, "path": path }))
        }
        Err(e) => Json(json!({ "ok": false, "error": e })),
    }
}

async fn write_binary(Json(body): Json<Value>) -> Json<Value> {
    let path = body.get("path").and_then(|v| v.as_str()).unwrap_or("");
    let data = body.get("dataBase64").and_then(|v| v.as_str()).unwrap_or("");
    if path.is_empty() || data.is_empty() {
        return Json(json!({ "ok": false, "error": "missing path or dataBase64" }));
    }
    match decode_png_base64(data) {
        Ok(bytes) => {
            let p = std::path::Path::new(path);
            if let Some(parent) = p.parent() {
                let _ = tokio::fs::create_dir_all(parent).await;
            }
            match tokio::fs::write(p, bytes).await {
                Ok(()) => Json(json!({ "ok": true, "path": path })),
                Err(e) => Json(json!({ "ok": false, "error": e.to_string() })),
            }
        }
        Err(e) => Json(json!({ "ok": false, "error": e })),
    }
}

async fn unsaved(Json(body): Json<Value>) -> Json<Value> {
    let reason = body.get("reason").and_then(|v| v.as_str()).unwrap_or("untitled");
    let (title, text) = match reason {
        "reload" => (
            "Unsaved changes",
            "You have unsaved changes. Save them to disk, discard and reload from the file on disk, or cancel?",
        ),
        "navigation" => (
            "Unsaved changes",
            "You have unsaved changes. Save, discard, or cancel?",
        ),
        _ => (
            "Unsaved changes",
            "This drawing has no file path yet. Save, discard, or cancel?",
        ),
    };
    match unsaved_changes_dialog(title, text) {
        Ok(choice) => Json(json!({ "ok": true, "choice": choice })),
        Err(DialogResult::Cancelled) => Json(json!({ "ok": true, "choice": "cancel" })),
        Err(DialogResult::Unavailable { detail }) => {
            Json(json!({ "ok": false, "error": detail }))
        }
        Err(DialogResult::Ok { .. }) => Json(json!({ "ok": false, "error": "unexpected" })),
    }
}

async fn quit(State(state): State<Arc<AppState>>) -> Json<Value> {
    *state.quit_pending.lock() = false;
    *state.allow_close.lock() = true;
    Json(json!({ "ok": true }))
}

async fn quit_aborted(State(state): State<Arc<AppState>>) -> Json<Value> {
    *state.quit_pending.lock() = false;
    Json(json!({ "ok": true }))
}

async fn cli_session(State(state): State<Arc<AppState>>) -> Json<Value> {
    let guard = state.cli_export.lock();
    let Some(cli) = guard.as_ref() else {
        return Json(json!({ "error": "no cli session" }));
    };
    Json(json!({
        "documentPath": cli.document_path,
        "scene": cli.scene,
        "jobs": cli.jobs,
        "nowIso": cli.now_iso,
    }))
}

async fn cli_png(
    State(state): State<Arc<AppState>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let job_id = body.get("jobId").and_then(|v| v.as_str()).unwrap_or("");
    let preferred = body
        .get("preferredFilename")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let png = body.get("pngBase64").and_then(|v| v.as_str()).unwrap_or("");
    if job_id.is_empty() || preferred.is_empty() || png.is_empty() {
        return Json(json!({ "ok": false, "error": "missing png payload" }));
    }
    if let Some(cli) = state.cli_export.lock().as_mut() {
        cli.received
            .insert(job_id.to_string(), (preferred.to_string(), png.to_string()));
    }
    Json(json!({ "ok": true }))
}

async fn cli_finish(State(state): State<Arc<AppState>>) -> Json<Value> {
    let cli = { state.cli_export.lock().take() };
    let Some(cli) = cli else {
        return Json(json!({ "ok": false, "error": "no cli session" }));
    };
    let mut paths = Vec::new();
    for job in &cli.jobs {
        let job_id = job.get("jobId").and_then(|v| v.as_str()).unwrap_or("");
        let Some((preferred, png_b64)) = cli.received.get(job_id) else {
            return Json(json!({ "ok": false, "error": format!("Missing PNG for job {job_id}") }));
        };
        let doc_path = std::path::Path::new(&cli.document_path);
        let loc = match resolve_export_output_location(
            doc_path,
            preferred,
            cli.out_override.as_deref(),
            cli.job_count,
        ) {
            Ok(x) => x,
            Err(e) => return Json(json!({ "ok": false, "error": e })),
        };
        let bytes = match decode_png_base64(png_b64) {
            Ok(b) => b,
            Err(e) => return Json(json!({ "ok": false, "error": e })),
        };
        if let Err(e) = tokio::fs::create_dir_all(&loc.0).await {
            return Json(json!({ "ok": false, "error": e.to_string() }));
        }
        let picked = match pick_unique_export_filename(&loc.0, &loc.1) {
            Ok(p) => p,
            Err(e) => return Json(json!({ "ok": false, "error": e })),
        };
        let byte_len = bytes.len();
        if let Err(e) = tokio::fs::write(&picked.1, bytes).await {
            return Json(json!({ "ok": false, "error": e.to_string() }));
        }
        eprintln!(
            "[cli-export] wrote {} ({} bytes)",
            picked.1.display(),
            byte_len
        );
        paths.push(picked.1.to_string_lossy().into_owned());
    }
    *state.last_export_paths.lock() = Some(paths.clone());
    *state.export_exit_code.lock() = Some(0);
    if *state.cli_json_output.lock() {
        println!("{}", json!({ "paths": paths }));
    } else {
        for p in &paths {
            println!("{p}");
        }
    }
    if let Some(app) = state.app_handle.lock().clone() {
        app.exit(0);
    }
    Json(json!({ "ok": true, "paths": paths }))
}

async fn cli_fail(
    State(state): State<Arc<AppState>>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let err = body
        .get("error")
        .and_then(|v| v.as_str())
        .unwrap_or("CLI export failed in webview");
    state.cli_export.lock().take();
    *state.export_exit_code.lock() = Some(1);
    eprintln!("Export failed: {err}");
    if let Some(app) = state.app_handle.lock().clone() {
        app.exit(1);
    }
    Json(json!({ "ok": true }))
}
