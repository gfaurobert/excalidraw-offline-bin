use crate::app_state::{AppState, CliExportState};
use crate::export::{resolve_export_jobs, ExportSelectorInput, ParsedExportCli};
use crate::http_server::start_http_server;
use crate::paths::{recent_file_path, resolve_dist_dir};
use crate::recent::RecentStore;
use crate::scene::read_scene;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

pub fn run_cli_export(command: ParsedExportCli) -> i32 {
    let dist_dir = resolve_dist_dir();
    let recent = RecentStore::load(recent_file_path());
    let state = AppState::new(dist_dir, recent);

    let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
    let scene = rt.block_on(read_scene(&command.document_path));
    let scene = match scene {
        Ok(s) => s,
        Err(e) => {
            eprintln!(
                "Export failed: cannot read {}: {e}",
                command.document_path.display()
            );
            return 1;
        }
    };

    let elements = scene
        .get("elements")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let resolved = resolve_export_jobs(
        &elements,
        ExportSelectorInput {
            frames: &command.frames,
            all_frames: command.all_frames,
            element_ids: &command.element_ids,
            bbox: command.bbox.clone(),
        },
    );
    let jobs = match resolved {
        Ok(j) => j,
        Err(e) => {
            eprintln!("Export failed: {e}");
            return 1;
        }
    };

    if command
        .out
        .as_ref()
        .is_some_and(|o| o.to_lowercase().ends_with(".png"))
        && jobs.len() != 1
    {
        eprintln!("Export failed: --out <file.png> requires exactly one export job");
        return 1;
    }

    let now_iso = chrono::Utc::now().to_rfc3339();
    let job_payloads: Vec<serde_json::Value> = jobs
        .iter()
        .map(|job| {
            let selected: serde_json::Map<String, Value> = job
                .selected_element_ids
                .keys()
                .map(|k| (k.clone(), json!(true)))
                .collect();
            json!({
                "jobId": job.job_id,
                "selectedElementIds": selected,
                "exportingFrameId": job.exporting_frame_id,
                "frameNameSanitized": job.frame_name_sanitized,
                "scale": command.scale,
            })
        })
        .collect();

    {
        let mut guard = state.cli_export.lock();
        *guard = Some(CliExportState {
            document_path: command.document_path.to_string_lossy().into_owned(),
            scene: scene.clone(),
            jobs: job_payloads,
            now_iso,
            job_count: jobs.len(),
            out_override: command.out.clone(),
            received: Default::default(),
        });
    }

    let port = rt.block_on(start_http_server(state.clone()));
    let app_url = format!("http://127.0.0.1:{port}/export-cli.html");
    eprintln!("[cli-export] loading {app_url}");

    *state.cli_json_output.lock() = command.json;
    let state_setup = state.clone();
    tauri::Builder::default()
        .setup(move |app| {
            *state_setup.app_handle.lock() = Some(app.handle().clone());
            let url = app_url.parse().expect("export url");
            let _win =
                WebviewWindowBuilder::new(app, "cli-export", WebviewUrl::External(url))
                    .title("Excalidraw CLI Export")
                    .inner_size(640.0, 480.0)
                    .visible(false)
                    .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("cli export tauri run");

    let code = *state.export_exit_code.lock();
    code.unwrap_or(1)
}
