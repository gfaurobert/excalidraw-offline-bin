//! Non-blocking GTK dialogs (show + connect_response) so Tauri's main loop keeps running on Wayland.

#[cfg(target_os = "linux")]
use crate::app_state::AppState;
#[cfg(target_os = "linux")]
use crate::dialogs_main::run_on_main;
#[cfg(target_os = "linux")]
use gtk::ResponseType;
#[cfg(target_os = "linux")]
use std::sync::Arc;

#[cfg(target_os = "linux")]
pub async fn run_dialog<R: Send + 'static>(
    state: &Arc<AppState>,
    show: impl FnOnce(tokio::sync::oneshot::Sender<R>) + Send + 'static,
) -> Result<R, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    run_on_main(state, move || show(tx)).await?;
    rx.await
        .map_err(|_| "GTK dialog channel closed".to_string())
}

#[cfg(target_os = "linux")]
pub async fn wait_dialog_response(
    state: &Arc<AppState>,
    build: impl FnOnce(tokio::sync::oneshot::Sender<ResponseType>) + Send + 'static,
) -> Result<ResponseType, String> {
    run_dialog(state, build).await
}
