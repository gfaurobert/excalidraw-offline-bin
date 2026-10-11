#[cfg(target_os = "linux")]
use crate::app_state::{AppState, UiCommand};
#[cfg(target_os = "linux")]
use crate::dialogs::dialog_backend_label;
#[cfg(target_os = "linux")]
use crate::gtk_dialogs::{self, ChoiceOption, DialogError};
#[cfg(target_os = "linux")]
use crate::install_skill::{
    existing_dests, install_skill_to, install_skill_to_many,
    parse_harness_id, resolve_bundled_skill_dir, resolve_harness_install_dests,
    resolve_install_target, HarnessId, InstallMode, DEFAULT_HARNESS_IDS, HARNESS_TARGET_OPTIONS,
    SKILL_ID,
};
#[cfg(target_os = "linux")]
use crate::paths::home_dir;
#[cfg(target_os = "linux")]
use std::path::PathBuf;
#[cfg(target_os = "linux")]
use std::sync::Arc;

#[cfg(target_os = "linux")]
const INSTALL_SKILL_OPTIONS: &[(&str, &str)] = &[
    ("global", "Global (user) — install under your home directory"),
    ("project", "Project — pick a project root folder"),
    ("custom", "Custom — pick any folder"),
];

#[cfg(target_os = "linux")]
fn harness_options_for_gtk() -> Vec<ChoiceOption> {
    HARNESS_TARGET_OPTIONS
        .iter()
        .map(|o| ChoiceOption {
            id: crate::install_skill::harness_id_str(o.id).to_string(),
            label: o.label.to_string(),
        })
        .collect()
}

#[cfg(target_os = "linux")]
fn default_harness_id_strings() -> Vec<String> {
    DEFAULT_HARNESS_IDS
        .iter()
        .map(|h| crate::install_skill::harness_id_str(*h).to_string())
        .collect()
}

#[cfg(target_os = "linux")]
fn parse_mode(id: &str) -> Option<InstallMode> {
    match id {
        "global" => Some(InstallMode::Global),
        "project" => Some(InstallMode::Project),
        "custom" => Some(InstallMode::Custom),
        _ => None,
    }
}

#[cfg(target_os = "linux")]
fn status(state: &Arc<AppState>, message: impl Into<String>) {
    state.enqueue_ui(UiCommand::Status {
        message: message.into(),
    });
}

#[cfg(target_os = "linux")]
pub fn run_install_sketching_skill(state: &Arc<AppState>) {
    let home = home_dir();
    let choice_opts: Vec<ChoiceOption> = INSTALL_SKILL_OPTIONS
        .iter()
        .map(|(id, label)| ChoiceOption {
            id: id.to_string(),
            label: label.to_string(),
        })
        .collect();

    let mode_id = match gtk_dialogs::choice_dialog(
        "Install skill",
        "Where should excalidraw-sketching be installed?",
        &choice_opts,
        "global",
    ) {
        Ok(id) => id,
        Err(DialogError::Cancelled) => {
            status(state, "Skill install cancelled");
            return;
        }
        Err(DialogError::Unavailable { detail }) => {
            let _ = gtk_dialogs::info_dialog(
                "Install skill",
                &format!("Cannot show install options: {detail}"),
                None,
            );
            return;
        }
    };

    let Some(mode) = parse_mode(&mode_id) else {
        status(state, "Skill install failed: unknown mode");
        return;
    };

    let mut picked: Option<PathBuf> = None;
    if matches!(mode, InstallMode::Project | InstallMode::Custom) {
        let title = if mode == InstallMode::Project {
            "Select project folder"
        } else {
            "Select destination folder"
        };
        match gtk_dialogs::open_directory_dialog(title, &home) {
            Ok(p) => picked = Some(PathBuf::from(p)),
            Err(DialogError::Cancelled) => {
                status(state, "Skill install cancelled");
                return;
            }
            Err(DialogError::Unavailable { detail }) => {
                let _ = gtk_dialogs::info_dialog(
                    "Install skill",
                    &format!("Cannot pick folder: {detail}"),
                    None,
                );
                return;
            }
        }
    }

    let dests: Vec<PathBuf> = match mode {
        InstallMode::Custom => match resolve_install_target(mode, &home, picked.as_deref()) {
            Ok(p) => vec![p],
            Err(e) => {
                let _ = gtk_dialogs::info_dialog("Install skill", &e, None);
                return;
            }
        },
        InstallMode::Global | InstallMode::Project => {
            let scope = if mode == InstallMode::Global {
                "Which agent tools should receive the skill? (Global)"
            } else {
                "Which agent tools should receive the skill? (Project)"
            };
            let harness_opts = harness_options_for_gtk();
            let default_strings = default_harness_id_strings();
            let defaults: Vec<&str> = default_strings
                .iter()
                .map(|s| s.as_str())
                .collect();
            let selected_ids = match gtk_dialogs::multi_select_checklist_dialog(
                "Install skill — targets",
                scope,
                &harness_opts,
                &defaults,
            ) {
                Ok(ids) => ids,
                Err(DialogError::Cancelled) => {
                    status(state, "Skill install cancelled");
                    return;
                }
                Err(DialogError::Unavailable { detail }) => {
                    let _ = gtk_dialogs::info_dialog(
                        "Install skill",
                        &format!("Cannot show target list: {detail}"),
                        None,
                );
                    return;
                }
            };
            let harness_ids: Vec<HarnessId> = selected_ids
                .iter()
                .filter_map(|s| parse_harness_id(s))
                .collect();
            match resolve_harness_install_dests(
                mode,
                &home,
                &harness_ids,
                picked.as_deref(),
            ) {
                Ok(d) => d,
                Err(e) => {
                    let _ = gtk_dialogs::info_dialog("Install skill", &e, None);
                    return;
                }
            }
        }
    };

    if dests.is_empty() {
        return;
    }

    let existing = existing_dests(&dests);
    if !existing.is_empty() {
        let list = existing
            .iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
            .join("\n");
        match gtk_dialogs::confirm_dialog(
            "Overwrite skill?",
            &format!(
                "Skill already exists at:\n{list}\n\nReplace at all listed locations?"
            ),
        ) {
            Ok(true) => {}
            Ok(false) => {
                status(state, "Skill install cancelled");
                return;
            }
            Err(DialogError::Cancelled) => {
                status(state, "Skill install cancelled");
                return;
            }
            Err(DialogError::Unavailable { detail }) => {
                let _ = gtk_dialogs::info_dialog(
                    "Install skill",
                    &format!("Cannot confirm overwrite: {detail}"),
                    None,
                );
                return;
            }
        }
    }

    let source = resolve_bundled_skill_dir();
    let result = if dests.len() == 1 {
        install_skill_to(&source, &dests[0]).map(|()| vec![dests[0].clone()])
    } else {
        install_skill_to_many(&source, &dests)
    };

    match result {
        Ok(paths) => {
            let listing = paths
                .iter()
                .map(|p| p.display().to_string())
                .collect::<Vec<_>>()
                .join("\n");
            let _ = gtk_dialogs::info_dialog(
                "Install skill",
                &format!("Installed {SKILL_ID} to:\n{listing}"),
                None,
            );
            status(
                state,
                format!(
                    "Skill installed ({}): {}",
                    paths.len(),
                    paths[0].display()
                ),
            );
        }
        Err(detail) => {
            let _ = gtk_dialogs::info_dialog(
                "Install skill",
                &format!("Install failed:\n{detail}"),
                None,
            );
            status(state, "Skill install failed");
        }
    }
}

#[cfg(target_os = "linux")]
pub fn run_info_runtime(state: &Arc<AppState>) {
    let text = format!("Ready · dialog: {}+http", dialog_backend_label());
    if gtk_dialogs::info_dialog("Runtime", &text, None).is_err() {
        status(
            state,
            "Info dialog unavailable or cancelled".to_string(),
        );
    }
}

#[cfg(target_os = "linux")]
pub fn run_info_assets(state: &Arc<AppState>) {
    if gtk_dialogs::info_dialog(
        "Assets",
        "Images save into assets/ next to the .excalidraw file.",
        None,
    )
    .is_err()
    {
        status(
            state,
            "Info dialog unavailable or cancelled".to_string(),
        );
    }
}

#[cfg(target_os = "linux")]
pub fn run_info_about_app(state: &Arc<AppState>) {
    let version = env!("CARGO_PKG_VERSION");
    let text = format!(
        "Excalidraw Offline\nVersion: {version}\n\n\
         A Tauri desktop wrapper around @excalidraw/excalidraw for offline local files."
    );
    if gtk_dialogs::info_dialog(
        "About Excalidraw Offline",
        &text,
        Some("https://github.com/gfaurobert/excalidraw-offline-bin"),
    )
    .is_err()
    {
        status(
            state,
            "Info dialog unavailable or cancelled".to_string(),
        );
    }
}

#[cfg(target_os = "linux")]
pub fn run_info_about_excalidraw(state: &Arc<AppState>) {
    let text = format!(
        "Excalidraw\nRelease: 0.18.0-4ce38fb\n\n\
         Upstream @excalidraw/excalidraw packaged by this app."
    );
    if gtk_dialogs::info_dialog(
        "About Excalidraw",
        &text,
        Some("https://github.com/excalidraw/excalidraw"),
    )
    .is_err()
    {
        status(
            state,
            "Info dialog unavailable or cancelled".to_string(),
        );
    }
}
