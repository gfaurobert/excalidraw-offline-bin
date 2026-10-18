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
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(url);
        // Inside an AppImage, AppRun points these at bundled libs/modules; the system
        // browser launched by xdg-open must not inherit them.
        if std::env::var_os("APPIMAGE").is_some() {
            for key in [
                "LD_LIBRARY_PATH",
                "LD_PRELOAD",
                "GDK_PIXBUF_MODULE_FILE",
                "GDK_PIXBUF_MODULEDIR",
                "GIO_MODULE_DIR",
                "GIO_EXTRA_MODULES",
                "GTK_PATH",
                "GTK_EXE_PREFIX",
                "GTK_DATA_PREFIX",
                "GSETTINGS_SCHEMA_DIR",
                "PYTHONHOME",
                "PYTHONPATH",
                "PERLLIB",
                "QT_PLUGIN_PATH",
            ] {
                cmd.env_remove(key);
            }
        }
        match cmd.spawn() {
            Ok(_) => crate::desktop_log::info(&format!("open_url_in_browser: xdg-open {url}")),
            Err(e) => crate::desktop_log::error(&format!("open_url_in_browser: xdg-open failed: {e}")),
        }
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

/// After OK on the harness checklist, an empty selection is treated like cancel.
pub fn harness_checklist_selection_ok(ids: Vec<String>) -> DialogResult<Vec<String>> {
    if ids.is_empty() {
        Err(DialogError::Cancelled)
    } else {
        Ok(ids)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn harness_checklist_empty_is_cancelled() {
        assert!(matches!(
            harness_checklist_selection_ok(vec![]),
            Err(DialogError::Cancelled)
        ));
    }

    #[test]
    fn harness_checklist_non_empty_proceeds() {
        let ids = harness_checklist_selection_ok(vec!["agents".into(), "claude".into()]).unwrap();
        assert_eq!(ids, vec!["agents", "claude"]);
    }
}
