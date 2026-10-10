use crate::recent::RecentStore;
use parking_lot::Mutex;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::AppHandle;

#[derive(Debug, Clone)]
pub enum UiMode {
    Start,
    Canvas,
}

#[derive(Debug, Clone)]
pub enum UiCommand {
    Status { message: String },
    New,
    Open { path: Option<String> },
    Save { force_picker: bool, path: Option<String> },
    Reload,
    Close,
    Quit,
}

pub struct CliExportJobState {
    pub job_id: String,
}

pub struct CliExportState {
    pub document_path: String,
    pub scene: Value,
    pub jobs: Vec<serde_json::Value>,
    pub now_iso: String,
    pub job_count: usize,
    pub out_override: Option<String>,
    pub received: HashMap<String, (String, String)>,
}

pub struct AppState {
    pub dist_dir: PathBuf,
    pub recent: RecentStore,
    pub current_path: Mutex<Option<String>>,
    pub ui_mode: Mutex<UiMode>,
    pub ui_queue: Mutex<Vec<UiCommand>>,
    pub last_focused_at: Mutex<i64>,
    pub quit_pending: Mutex<bool>,
    pub allow_close: Mutex<bool>,
    pub cli_export: Mutex<Option<CliExportState>>,
    pub app_handle: Mutex<Option<AppHandle>>,
    pub export_exit_code: Mutex<Option<i32>>,
    pub last_export_paths: Mutex<Option<Vec<String>>>,
    pub cli_json_output: Mutex<bool>,
}

impl AppState {
    pub fn new(dist_dir: PathBuf, recent: RecentStore) -> Arc<Self> {
        Arc::new(Self {
            dist_dir,
            recent,
            current_path: Mutex::new(None),
            ui_mode: Mutex::new(UiMode::Start),
            ui_queue: Mutex::new(Vec::new()),
            last_focused_at: Mutex::new(chrono::Utc::now().timestamp_millis()),
            quit_pending: Mutex::new(false),
            allow_close: Mutex::new(false),
            cli_export: Mutex::new(None),
            app_handle: Mutex::new(None),
            export_exit_code: Mutex::new(None),
            last_export_paths: Mutex::new(None),
            cli_json_output: Mutex::new(false),
        })
    }

    pub fn enqueue_ui(&self, cmd: UiCommand) {
        self.ui_queue.lock().push(cmd);
    }
}
