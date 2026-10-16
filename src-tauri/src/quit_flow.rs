use crate::app_state::{AppState, UiCommand};
use crate::desktop_log;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

pub fn finish_quit(app: &AppHandle, state: &Arc<AppState>, code: i32) {
    *state.allow_close.lock() = true;
    *state.quit_pending.lock() = false;
    desktop_log::info(&format!("finish_quit code={code}"));
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.close();
    }
    app.exit(code);
}

/// Close / File → Quit: use the web UI when it is alive; otherwise exit immediately.
pub fn request_application_quit(app: &AppHandle, state: &Arc<AppState>) {
    desktop_log::info("request_application_quit");
    if *state.allow_close.lock() {
        finish_quit(app, state, 0);
        return;
    }
    if !state.frontend_ready.load(Ordering::Relaxed) {
        desktop_log::warn("frontend not ready — native quit without unsaved prompt");
        finish_quit(app, state, 0);
        return;
    }
    state.enqueue_ui(UiCommand::Quit);
}
