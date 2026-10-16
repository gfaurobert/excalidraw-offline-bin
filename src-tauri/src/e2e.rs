use crate::app_state::AppState;
use std::sync::Arc;
use tauri::{Manager, WebviewWindow};

pub fn e2e_enabled() -> bool {
    std::env::var("EXCALIDRAW_E2E")
        .map(|v| v == "1")
        .unwrap_or(false)
}

pub fn eval_in_main_webview(state: &Arc<AppState>, js: &str) -> Result<(), String> {
    if !e2e_enabled() {
        return Err("e2e disabled (set EXCALIDRAW_E2E=1)".into());
    }
    let app = state
        .app_handle
        .lock()
        .clone()
        .ok_or("app handle not ready")?;
    let win: WebviewWindow = app
        .get_webview_window("main")
        .ok_or("main webview window missing")?;
    win.eval(js).map_err(|e| e.to_string())
}
