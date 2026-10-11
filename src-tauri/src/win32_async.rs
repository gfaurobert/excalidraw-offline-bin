//! Modeless Win32 dialogs: show on the UI thread, complete via oneshot (Tauri pumps messages).

use crate::app_state::AppState;
use crate::dialogs_main::run_on_main;
use std::sync::Arc;

pub async fn run_dialog<R: Send + 'static>(
    state: &Arc<AppState>,
    show: impl FnOnce(tokio::sync::oneshot::Sender<R>) + Send + 'static,
) -> Result<R, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    run_on_main(state, move || show(tx)).await?;
    rx.await
        .map_err(|_| "Win32 dialog channel closed".to_string())
}
