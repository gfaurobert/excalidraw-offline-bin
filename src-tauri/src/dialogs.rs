use crate::app_state::AppState;
use crate::e2e::e2e_enabled;
use crate::paths::{ensure_excalidraw_ext, home_dir};
use rfd::FileDialog;
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
        return "rfd (GTK3 native)";
    }
    #[cfg(target_os = "windows")]
    {
        return "rfd (Win32 native)";
    }
    #[cfg(target_os = "macos")]
    {
        return "rfd (AppKit native)";
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

/// Open dialog from menu (already on GTK main thread).
pub fn open_excalidraw_dialog_on_menu(_state: &Arc<AppState>) -> DialogResult {
    open_excalidraw_dialog_inner()
}

pub fn open_excalidraw_dialog(state: &Arc<AppState>) -> DialogResult {
    // rfd GTK backend runs the dialog on the thread that calls it; HTTP handlers
    // must not block the Tauri main loop waiting on run_on_main_thread.
    let _ = state;
    open_excalidraw_dialog_inner()
}

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

pub fn save_excalidraw_dialog_on_menu(
    _state: &Arc<AppState>,
    default_name_or_path: &str,
) -> DialogResult {
    save_excalidraw_dialog_inner(default_name_or_path)
}

pub fn save_excalidraw_dialog(state: &Arc<AppState>, default_name_or_path: &str) -> DialogResult {
    let _ = state;
    save_excalidraw_dialog_inner(default_name_or_path)
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

pub fn save_image_export_dialog(state: &Arc<AppState>, suggested_path: &str) -> DialogResult {
    let _ = state;
    save_image_export_dialog_inner(suggested_path)
}

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

pub fn open_image_dialog(state: &Arc<AppState>) -> DialogResult {
    let _ = state;
    open_image_dialog_inner()
}

pub(crate) fn map_unsaved_choice(choice: &str) -> Result<String, DialogResult> {
    if choice == "cancel" {
        Err(DialogResult::Cancelled)
    } else {
        Ok(choice.to_string())
    }
}

fn unsaved_changes_dialog_inner(title: &str, text: &str) -> Result<String, DialogResult> {
    if e2e_enabled() {
        if let Ok(forced) = std::env::var("EXCALIDRAW_E2E_UNSAVED_CHOICE") {
            return map_unsaved_choice(forced.trim());
        }
    }

    #[cfg(target_os = "linux")]
    {
        return crate::dialogs_linux::linux_unsaved_changes_dialog(title, text);
    }

    #[cfg(not(target_os = "linux"))]
    {
        let choice = MessageDialog::new()
            .set_title(title)
            .set_description(format!(
                "{text}\n\nYes = Save, No = Discard, Cancel = keep editing."
            ))
            .set_level(MessageLevel::Warning)
            .set_buttons(MessageButtons::YesNoCancel)
            .show();
        match choice {
            rfd::MessageDialogResult::Yes => Ok("save".into()),
            rfd::MessageDialogResult::No => Ok("discard".into()),
            _ => Err(DialogResult::Cancelled),
        }
    }
}

pub fn unsaved_changes_dialog_on_menu(
    _state: &Arc<AppState>,
    title: &str,
    text: &str,
) -> Result<String, DialogResult> {
    unsaved_changes_dialog_inner(title, text)
}

pub fn unsaved_changes_dialog(
    state: &Arc<AppState>,
    title: &str,
    text: &str,
) -> Result<String, DialogResult> {
    let _ = state;
    unsaved_changes_dialog_inner(title, text)
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
