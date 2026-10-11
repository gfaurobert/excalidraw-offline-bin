use crate::e2e::e2e_enabled;
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
    if command_exists("zenity") {
        "zenity (GTK)"
    } else {
        "rfd (GTK native)"
    }
}

fn command_exists(name: &str) -> bool {
    Command::new("which")
        .arg(name)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
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

fn run_zenity_save(default_path: &Path) -> DialogResult {
    let default = default_path.to_string_lossy().replace('\\', "/");
    let output = Command::new("zenity")
        .args([
            "--file-selection",
            "--save",
            "--confirm-overwrite",
            "--title=Save Excalidraw file",
            &format!("--filename={default}"),
            "--file-filter=Excalidraw | *.excalidraw",
            "--file-filter=All files | *",
        ])
        .output();
    match output {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if text.is_empty() {
                DialogResult::Cancelled
            } else {
                DialogResult::Ok {
                    path: ensure_excalidraw_ext(&text),
                }
            }
        }
        Ok(o) if o.status.code() == Some(1) => DialogResult::Cancelled,
        Ok(o) => DialogResult::Unavailable {
            detail: String::from_utf8_lossy(&o.stderr).into_owned(),
        },
        Err(e) => DialogResult::Unavailable {
            detail: e.to_string(),
        },
    }
}

fn run_zenity_open() -> DialogResult {
    let output = Command::new("zenity")
        .args([
            "--file-selection",
            "--title=Open Excalidraw file",
            "--file-filter=Excalidraw | *.excalidraw",
            "--file-filter=All files | *",
        ])
        .output();
    match output {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if text.is_empty() {
                DialogResult::Cancelled
            } else {
                DialogResult::Ok { path: text }
            }
        }
        Ok(o) if o.status.code() == Some(1) => DialogResult::Cancelled,
        Ok(o) => DialogResult::Unavailable {
            detail: String::from_utf8_lossy(&o.stderr).into_owned(),
        },
        Err(e) => DialogResult::Unavailable {
            detail: e.to_string(),
        },
    }
}

pub fn open_excalidraw_dialog() -> DialogResult {
    if let Ok(forced) = std::env::var("EXCALIDRAW_FORCE_OPEN_PATH") {
        let t = forced.trim();
        if !t.is_empty() {
            return DialogResult::Ok { path: t.to_string() };
        }
    }
    if command_exists("zenity") {
        return run_zenity_open();
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

pub fn save_excalidraw_dialog(default_name_or_path: &str) -> DialogResult {
    if let Ok(forced) = std::env::var("EXCALIDRAW_FORCE_SAVE_PATH") {
        let t = forced.trim();
        if !t.is_empty() {
            return DialogResult::Ok {
                path: ensure_excalidraw_ext(t),
            };
        }
    }
    let default_path = resolve_default_save_path(default_name_or_path);
    if command_exists("zenity") {
        return run_zenity_save(&default_path);
    }
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
    let default_path = resolve_default_save_path(suggested_path);
    if command_exists("zenity") {
        let default = default_path.to_string_lossy().replace('\\', "/");
        let output = Command::new("zenity")
            .args([
                "--file-selection",
                "--save",
                "--confirm-overwrite",
                "--title=Export image",
                &format!("--filename={default}"),
                "--file-filter=PNG | *.png",
            ])
            .output();
        return match output {
            Ok(o) if o.status.success() => DialogResult::Ok {
                path: String::from_utf8_lossy(&o.stdout).trim().to_string(),
            },
            Ok(o) if o.status.code() == Some(1) => DialogResult::Cancelled,
            Ok(o) => DialogResult::Unavailable {
                detail: String::from_utf8_lossy(&o.stderr).into_owned(),
            },
            Err(e) => DialogResult::Unavailable { detail: e.to_string() },
        };
    }
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

/// zenity: 0 → save; 1 + stdout "Discard" → discard; 1 + empty stdout → cancel
pub fn parse_unsaved_zenity_outcome(code: i32, stdout: &str) -> Option<&'static str> {
    let out = stdout.trim();
    if code == 0 {
        return Some("save");
    }
    if code == 1 && out == "Discard" {
        return Some("discard");
    }
    if code == 1 {
        return Some("cancel");
    }
    None
}

/// kdialog --yesnocancel: 0 → save; 1 → discard; 2 → cancel
pub fn parse_unsaved_kdialog_outcome(code: i32) -> Option<&'static str> {
    match code {
        0 => Some("save"),
        1 => Some("discard"),
        2 => Some("cancel"),
        _ => None,
    }
}

fn map_unsaved_choice(choice: &str) -> Result<String, DialogResult> {
    if choice == "cancel" {
        Err(DialogResult::Cancelled)
    } else {
        Ok(choice.to_string())
    }
}

pub fn unsaved_changes_dialog(title: &str, text: &str) -> Result<String, DialogResult> {
    if e2e_enabled() {
        if let Ok(forced) = std::env::var("EXCALIDRAW_E2E_UNSAVED_CHOICE") {
            return map_unsaved_choice(forced.trim());
        }
    }

    if command_exists("zenity") {
        let output = Command::new("zenity")
            .args([
                "--question",
                &format!("--title={title}"),
                &format!("--text={text}"),
                "--ok-label=Save",
                "--cancel-label=Cancel",
                "--extra-button=Discard",
            ])
            .output();
        match output {
            Ok(o) => {
                let code = o.status.code().unwrap_or(-1);
                let stdout = String::from_utf8_lossy(&o.stdout);
                if let Some(choice) = parse_unsaved_zenity_outcome(code, &stdout) {
                    return map_unsaved_choice(choice);
                }
                return Err(DialogResult::Unavailable {
                    detail: format!(
                        "zenity unsaved dialog exit {code}: {}",
                        String::from_utf8_lossy(&o.stderr).trim()
                    ),
                });
            }
            Err(e) => {
                return Err(DialogResult::Unavailable {
                    detail: e.to_string(),
                });
            }
        }
    }

    if command_exists("kdialog") {
        let output = Command::new("kdialog")
            .args([
                "--title",
                title,
                "--yesnocancel",
                text,
                "--yes-label",
                "Save",
                "--no-label",
                "Discard",
                "--cancel-label",
                "Cancel",
            ])
            .output();
        match output {
            Ok(o) => {
                let code = o.status.code().unwrap_or(-1);
                if let Some(choice) = parse_unsaved_kdialog_outcome(code) {
                    return map_unsaved_choice(choice);
                }
                return Err(DialogResult::Unavailable {
                    detail: format!(
                        "kdialog unsaved dialog exit {code}: {}",
                        String::from_utf8_lossy(&o.stderr).trim()
                    ),
                });
            }
            Err(e) => {
                return Err(DialogResult::Unavailable {
                    detail: e.to_string(),
                });
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

#[cfg(test)]
mod tests {
    use super::{parse_unsaved_kdialog_outcome, parse_unsaved_zenity_outcome};

    #[test]
    fn parse_unsaved_zenity_outcome_matches_deno() {
        assert_eq!(parse_unsaved_zenity_outcome(0, ""), Some("save"));
        assert_eq!(parse_unsaved_zenity_outcome(1, "Discard"), Some("discard"));
        assert_eq!(parse_unsaved_zenity_outcome(1, ""), Some("cancel"));
        assert_eq!(parse_unsaved_zenity_outcome(5, ""), None);
    }

    #[test]
    fn parse_unsaved_kdialog_outcome_matches_deno() {
        assert_eq!(parse_unsaved_kdialog_outcome(0), Some("save"));
        assert_eq!(parse_unsaved_kdialog_outcome(1), Some("discard"));
        assert_eq!(parse_unsaved_kdialog_outcome(2), Some("cancel"));
        assert_eq!(parse_unsaved_kdialog_outcome(3), None);
    }
}
