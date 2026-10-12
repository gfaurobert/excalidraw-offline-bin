use crate::e2e::e2e_enabled;
use std::time::Duration;
use std::thread;

#[derive(Debug)]
pub enum DialogError {
    Cancelled,
    Unavailable { detail: String },
}

pub type DialogResult<T> = Result<T, DialogError>;

#[derive(Clone)]
pub struct ChoiceOption {
    pub id: String,
    pub label: String,
}

pub fn e2e_pause_ms() -> u64 {
    if !e2e_enabled() {
        return 0;
    }
    std::env::var("EXCALIDRAW_E2E_DIALOG_PAUSE_MS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0)
}

pub fn e2e_skill_cancelled() -> bool {
    e2e_enabled()
        && std::env::var("EXCALIDRAW_E2E_SKILL_CANCEL")
            .map(|v| v == "1")
            .unwrap_or(false)
}

pub fn e2e_sleep_pause() {
    let ms = e2e_pause_ms();
    if ms > 0 {
        thread::sleep(Duration::from_millis(ms));
    }
}

pub fn open_url_in_browser(url: &str) {
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(url).spawn();
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        let _ = url;
    }
}
