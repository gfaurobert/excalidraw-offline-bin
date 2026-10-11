use crate::app_state::AppState;
use crate::dialogs_main::run_on_main;
use crate::e2e::e2e_enabled;
use crate::paths::{ensure_excalidraw_ext, home_dir};
use rfd::FileDialog;
#[cfg(target_os = "linux")]
use rfd::AsyncFileDialog;
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Debug)]
pub enum DialogResult {
    Ok { path: String },
    Cancelled,
    Unavailable { detail: String },
}

pub fn dialog_backend_label() -> &'static str {
    #[cfg(target_os = "linux")]
    {
        "rfd (GTK3 native)"
    }
    #[cfg(target_os = "windows")]
    {
        "rfd (Win32 native)"
    }
    #[cfg(target_os = "macos")]
    {
        "rfd (AppKit native)"
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        "rfd (native)"
    }
}

fn resolve_default_save_path(default_name_or_path: &str) -> PathBuf {
    let raw = default_name_or_path.trim();
    let path = if raw.contains('/') || raw.contains('\\') {
        PathBuf::from(raw)
    } else {
        home_dir().join(raw)
    };
    path.canonicalize().unwrap_or(path)
}

#[cfg(not(target_os = "linux"))]
fn open_excalidraw_dialog_inner() -> DialogResult {
    if let Ok(forced) = std::env::var("EXCALIDRAW_FORCE_OPEN_PATH") {
        let t = forced.trim();
        if !t.is_empty() {
            return DialogResult::Ok { path: t.to_string() };
        }
    }
    match FileDialog::new()
        .set_title("Open Excalidraw file")
        .add_filter("Excalidraw", &["excalidraw"])
        .pick_file()
    {
        Some(p) => DialogResult::Ok {
            path: p.to_string_lossy().into_owned(),
        },
        None => DialogResult::Cancelled,
    }
}

pub async fn open_excalidraw_dialog(state: &Arc<AppState>) -> DialogResult {
    if let Ok(forced) = std::env::var("EXCALIDRAW_FORCE_OPEN_PATH") {
        let t = forced.trim();
        if !t.is_empty() {
            return DialogResult::Ok { path: t.to_string() };
        }
    }
    #[cfg(target_os = "linux")]
    {
        let _ = state;
        match AsyncFileDialog::new()
            .set_title("Open Excalidraw file")
            .add_filter("Excalidraw", &["excalidraw"])
            .pick_file()
            .await
        {
            Some(h) => DialogResult::Ok {
                path: h.path().to_string_lossy().into_owned(),
            },
            None => DialogResult::Cancelled,
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        match run_on_main(state, open_excalidraw_dialog_inner).await {
            Ok(r) => r,
            Err(detail) => DialogResult::Unavailable { detail },
        }
    }
}

#[cfg(not(target_os = "linux"))]
fn save_excalidraw_dialog_inner(default_name_or_path: &str) -> DialogResult {
    if let Ok(forced) = std::env::var("EXCALIDRAW_FORCE_SAVE_PATH") {
        let t = forced.trim();
        if !t.is_empty() {
            return DialogResult::Ok {
                path: ensure_excalidraw_ext(t),
            };
        }
    }
    let default_path = resolve_default_save_path(default_name_or_path);
    let mut dialog = FileDialog::new()
        .set_title("Save Excalidraw file")
        .add_filter("Excalidraw", &["excalidraw"]);
    if let Some(parent) = default_path.parent() {
        if parent.is_dir() {
            dialog = dialog.set_directory(parent);
        }
    }
    if let Some(name) = default_path.file_name().and_then(|n| n.to_str()) {
        dialog = dialog.set_file_name(name);
    }
    match dialog.save_file() {
        Some(p) => DialogResult::Ok {
            path: ensure_excalidraw_ext(&p.to_string_lossy()),
        },
        None => DialogResult::Cancelled,
    }
}

pub async fn save_excalidraw_dialog(
    _state: &Arc<AppState>,
    default_name_or_path: &str,
) -> DialogResult {
    if let Ok(forced) = std::env::var("EXCALIDRAW_FORCE_SAVE_PATH") {
        let t = forced.trim();
        if !t.is_empty() {
            return DialogResult::Ok {
                path: ensure_excalidraw_ext(t),
            };
        }
    }
    #[cfg(target_os = "linux")]
    {
        let default_path = resolve_default_save_path(default_name_or_path);
        let mut dialog = AsyncFileDialog::new()
            .set_title("Save Excalidraw file")
            .add_filter("Excalidraw", &["excalidraw"]);
        if let Some(parent) = default_path.parent() {
            if parent.is_dir() {
                dialog = dialog.set_directory(parent);
            }
        }
        if let Some(name) = default_path.file_name().and_then(|n| n.to_str()) {
            dialog = dialog.set_file_name(name);
        }
        match dialog.save_file().await {
            Some(h) => DialogResult::Ok {
                path: ensure_excalidraw_ext(&h.path().to_string_lossy()),
            },
            None => DialogResult::Cancelled,
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        let suggested = default_name_or_path.to_string();
        match run_on_main(_state, move || save_excalidraw_dialog_inner(&suggested)).await {
            Ok(r) => r,
            Err(detail) => DialogResult::Unavailable { detail },
        }
    }
}

fn save_image_export_dialog_inner(suggested_path: &str) -> DialogResult {
    let default_path = resolve_default_save_path(suggested_path);
    let mut dialog = FileDialog::new()
        .set_title("Export image")
        .add_filter("PNG", &["png"]);
    if let Some(parent) = default_path.parent() {
        if parent.is_dir() {
            dialog = dialog.set_directory(parent);
        }
    }
    if let Some(name) = default_path.file_name().and_then(|n| n.to_str()) {
        dialog = dialog.set_file_name(name);
    }
    match dialog.save_file() {
        Some(p) => DialogResult::Ok {
            path: p.to_string_lossy().into_owned(),
        },
        None => DialogResult::Cancelled,
    }
}

pub async fn save_image_export_dialog(
    state: &Arc<AppState>,
    suggested_path: &str,
) -> DialogResult {
    let suggested = suggested_path.to_string();
    match run_on_main(state, move || save_image_export_dialog_inner(&suggested)).await {
        Ok(r) => r,
        Err(detail) => DialogResult::Unavailable { detail },
    }
}

#[cfg(not(target_os = "linux"))]
fn open_image_dialog_inner() -> DialogResult {
    match FileDialog::new()
        .set_title("Import image")
        .add_filter("Images", &["png", "jpg", "jpeg", "gif", "webp", "svg"])
        .pick_file()
    {
        Some(p) => DialogResult::Ok {
            path: p.to_string_lossy().into_owned(),
        },
        None => DialogResult::Cancelled,
    }
}

pub async fn open_image_dialog(state: &Arc<AppState>) -> DialogResult {
    #[cfg(target_os = "linux")]
    {
        let _ = state;
        match AsyncFileDialog::new()
            .set_title("Import image")
            .add_filter("Images", &["png", "jpg", "jpeg", "gif", "webp", "svg"])
            .pick_file()
            .await
        {
            Some(h) => DialogResult::Ok {
                path: h.path().to_string_lossy().into_owned(),
            },
            None => DialogResult::Cancelled,
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        match run_on_main(state, open_image_dialog_inner).await {
            Ok(r) => r,
            Err(detail) => DialogResult::Unavailable { detail },
        }
    }
}

pub(crate) fn map_unsaved_choice(choice: &str) -> Result<String, DialogResult> {
    if choice == "cancel" {
        Err(DialogResult::Cancelled)
    } else {
        Ok(choice.to_string())
    }
}

#[cfg(not(target_os = "linux"))]
fn unsaved_changes_dialog_inner(title: &str, text: &str) -> Result<String, DialogResult> {
    if e2e_enabled() {
        if let Ok(forced) = std::env::var("EXCALIDRAW_E2E_UNSAVED_CHOICE") {
            return map_unsaved_choice(forced.trim());
        }
    }

    let choice = rfd::MessageDialog::new()
        .set_title(title)
        .set_description(format!(
            "{text}\n\nYes = Save, No = Discard, Cancel = keep editing."
        ))
        .set_level(rfd::MessageLevel::Warning)
        .set_buttons(rfd::MessageButtons::YesNoCancel)
        .show();
    match choice {
        rfd::MessageDialogResult::Yes => Ok("save".into()),
        rfd::MessageDialogResult::No => Ok("discard".into()),
        _ => Err(DialogResult::Cancelled),
    }
}

pub async fn unsaved_changes_dialog(
    state: &Arc<AppState>,
    title: &str,
    text: &str,
) -> Result<String, DialogResult> {
    if e2e_enabled() {
        if let Ok(forced) = std::env::var("EXCALIDRAW_E2E_UNSAVED_CHOICE") {
            return map_unsaved_choice(forced.trim());
        }
    }
    #[cfg(target_os = "linux")]
    {
        return crate::dialogs_linux::linux_unsaved_changes_dialog(state, title, text).await;
    }
    #[cfg(not(target_os = "linux"))]
    {
        let title = title.to_string();
        let text = text.to_string();
        match run_on_main(state, move || unsaved_changes_dialog_inner(&title, &text)).await {
            Ok(inner) => inner,
            Err(detail) => Err(DialogResult::Unavailable { detail }),
        }
    }
}

pub fn suggested_image_export_path(
    document_path: Option<&str>,
    home: &Path,
    filename: &str,
) -> String {
    if let Some(doc) = document_path {
        let p = PathBuf::from(doc);
        if let Some(dir) = p.parent() {
            return dir.join(filename).to_string_lossy().into_owned();
        }
    }
    home.join(filename).to_string_lossy().into_owned()
}
