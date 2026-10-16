//! Run native dialogs on Tauri's GTK/main thread (required on Linux/Wayland).

use crate::app_state::AppState;
use parking_lot::Mutex;
use std::sync::Arc;
use std::thread::ThreadId;

static GTK_MAIN_THREAD: Mutex<Option<ThreadId>> = Mutex::new(None);

/// Call once from Tauri `setup` on the thread that owns GTK.
pub fn mark_gtk_main_thread() {
    *GTK_MAIN_THREAD.lock() = Some(std::thread::current().id());
}

pub fn is_gtk_main_thread() -> bool {
    GTK_MAIN_THREAD
        .lock()
        .is_some_and(|id| id == std::thread::current().id())
}

/// Panics in debug builds if GTK widgets would run off the main thread.
pub async fn run_on_main<R: Send + 'static>(
    state: &Arc<AppState>,
    f: impl FnOnce() -> R + Send + 'static,
) -> Result<R, String> {
    if is_gtk_main_thread() {
        return Ok(f());
    }
    let app = state
        .app_handle
        .lock()
        .clone()
        .ok_or_else(|| "app handle not ready".to_string())?;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(f());
    })
    .map_err(|e| format!("run_on_main_thread failed: {e}"))?;
    rx.await
        .map_err(|_| "main-thread dialog channel closed".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn main_thread_detection() {
        mark_gtk_main_thread();
        assert!(is_gtk_main_thread());
        let ok = std::thread::spawn(|| !is_gtk_main_thread()).join().unwrap();
        assert!(ok);
    }
}
