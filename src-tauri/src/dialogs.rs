use crate::paths::{ensure_excalidraw_ext, home_dir};
use rfd::{FileDialog, MessageButtons, MessageDialog, MessageLevel};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug)]
pub enum DialogResult {
    Ok { path: String },
    Cancelled,
    Unavailable { detail: String },
}

pub fn dialog_backend_label() -> &'static str {
    "rfd (GTK native)"
}

fn default_path(name_or_path: &str) -> PathBuf {
    if name_or_path.contains('/') || name_or_path.contains('\\') {
        PathBuf::from(name_or_path)
    } else {
        home_dir().join(name_or_path)
    }
}

pub fn open_excalidraw_dialog() -> DialogResult {
    if let Ok(forced) = std::env::var("EXCALIDRAW_FORCE_OPEN_PATH") {
        let t = forced.trim();
        if !t.is_empty() {
            return DialogResult::Ok { path: t.to_string() };
        }
    }
    let file = FileDialog::new()
        .set_title("Open Excalidraw file")
        .add_filter("Excalidraw", &["excalidraw"])
        .pick_file();
    match file {
        Some(p) => DialogResult::Ok {
            path: p.to_string_lossy().into_owned(),
        },
        None => DialogResult::Cancelled,
    }
}

pub fn save_excalidraw_dialog(default_name_or_path: &str) -> DialogResult {
    if let Ok(forced) = std::env::var("EXCALIDRAW_FORCE_SAVE_PATH") {
        let t = forced.trim();
        if !t.is_empty() {
            return DialogResult::Ok {
                path: ensure_excalidraw_ext(t),
            };
        }
    }
    let default_path = default_path(default_name_or_path);
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

pub fn save_image_export_dialog(suggested_path: &str) -> DialogResult {
    let default_path = PathBuf::from(suggested_path.replace('\\', "/"));
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

pub fn open_image_dialog() -> DialogResult {
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

pub fn unsaved_changes_dialog(title: &str, text: &str) -> Result<String, DialogResult> {
    if Command::new("which").arg("zenity").output().ok().is_some_and(|o| o.status.success()) {
        let status = Command::new("zenity")
            .args([
                "--question",
                &format!("--title={title}"),
                &format!("--text={text}"),
                "--ok-label=Save",
                "--cancel-label=Cancel",
                "--extra-button=Discard",
            ])
            .status();
        if let Ok(s) = status {
            match s.code() {
                Some(0) => return Ok("save".into()),
                Some(2) => return Ok("discard".into()),
                Some(1) | None => return Err(DialogResult::Cancelled),
                _ => {}
            }
        }
    }

    let choice = MessageDialog::new()
        .set_title(title)
        .set_description(format!(
            "{text}\n\nClick Yes to Save, No to Discard, or Cancel."
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
