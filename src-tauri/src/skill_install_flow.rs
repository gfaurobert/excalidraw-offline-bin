use crate::app_state::{AppState, UiCommand};
use crate::dialogs::dialog_backend_label;
use crate::install_skill::{
    existing_dests, install_skill_to, install_skill_to_many,
    parse_harness_id, resolve_bundled_skill_dir, resolve_harness_install_dests,
    resolve_install_target, HarnessId, InstallMode, DEFAULT_HARNESS_IDS, HARNESS_TARGET_OPTIONS,
    SKILL_ID,
};
use crate::paths::home_dir;
use crate::skill_dialogs::{self, ChoiceOption, DialogError};
use std::path::PathBuf;
use std::sync::Arc;

const INSTALL_SKILL_OPTIONS: &[(&str, &str)] = &[
    ("global", "Global (user) — install under your home directory"),
    ("project", "Project — pick a project root folder"),
    ("custom", "Custom — pick any folder"),
];

fn harness_options_for_dialog() -> Vec<ChoiceOption> {
    HARNESS_TARGET_OPTIONS
        .iter()
        .map(|o| ChoiceOption {
            id: crate::install_skill::harness_id_str(o.id).to_string(),
            label: o.label.to_string(),
        })
        .collect()
}

fn default_harness_id_strings() -> Vec<String> {
    DEFAULT_HARNESS_IDS
        .iter()
        .map(|h| crate::install_skill::harness_id_str(*h).to_string())
        .collect()
}

fn parse_mode(id: &str) -> Option<InstallMode> {
    match id {
        "global" => Some(InstallMode::Global),
        "project" => Some(InstallMode::Project),
        "custom" => Some(InstallMode::Custom),
        _ => None,
    }
}

fn status(state: &Arc<AppState>, message: impl Into<String>) {
    state.enqueue_ui(UiCommand::Status {
        message: message.into(),
    });
}

async fn install_sketching_skill_async(state: &Arc<AppState>) {
    let home = home_dir();
    let choice_opts: Vec<ChoiceOption> = INSTALL_SKILL_OPTIONS
        .iter()
        .map(|(id, label)| ChoiceOption {
            id: id.to_string(),
            label: label.to_string(),
        })
        .collect();

    let mode_id = match skill_dialogs::choice_dialog(
        state,
        "Install skill",
        "Where should excalidraw-sketching be installed?",
        &choice_opts,
        "global",
    )
    .await
    {
        Ok(id) => id,
        Err(DialogError::Cancelled) => {
            status(state, "Skill install cancelled");
            return;
        }
        Err(DialogError::Unavailable { detail }) => {
            let _ = skill_dialogs::info_dialog(
                state,
                "Install skill",
                &format!("Cannot show install options: {detail}"),
                None,
            )
            .await;
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
        match skill_dialogs::open_directory_dialog(state, title, &home).await {
            Ok(p) => picked = Some(PathBuf::from(p)),
            Err(DialogError::Cancelled) => {
                status(state, "Skill install cancelled");
                return;
            }
            Err(DialogError::Unavailable { detail }) => {
                let _ = skill_dialogs::info_dialog(
                    state,
                    "Install skill",
                    &format!("Cannot pick folder: {detail}"),
                    None,
                )
                .await;
                return;
            }
        }
    }

    let dests: Vec<PathBuf> = match mode {
        InstallMode::Custom => match resolve_install_target(mode, &home, picked.as_deref()) {
            Ok(p) => vec![p],
            Err(e) => {
                let _ = skill_dialogs::info_dialog(state, "Install skill", &e, None).await;
                return;
            }
        },
        InstallMode::Global | InstallMode::Project => {
            let scope = if mode == InstallMode::Global {
                "Which agent tools should receive the skill? (Global)"
            } else {
                "Which agent tools should receive the skill? (Project)"
            };
            let harness_opts = harness_options_for_dialog();
            let default_strings = default_harness_id_strings();
            let defaults: Vec<&str> = default_strings
                .iter()
                .map(|s| s.as_str())
                .collect();
            let selected_ids = match skill_dialogs::multi_select_checklist_dialog(
                state,
                "Install skill — targets",
                scope,
                &harness_opts,
                &defaults,
            )
            .await
            {
                Ok(ids) => ids,
                Err(DialogError::Cancelled) => {
                    status(state, "Skill install cancelled");
                    return;
                }
                Err(DialogError::Unavailable { detail }) => {
                    let _ = skill_dialogs::info_dialog(
                        state,
                        "Install skill",
                        &format!("Cannot show target list: {detail}"),
                        None,
                    )
                    .await;
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
                    let _ = skill_dialogs::info_dialog(state, "Install skill", &e, None).await;
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
        match skill_dialogs::confirm_dialog(
            state,
            "Overwrite skill?",
            &format!(
                "Skill already exists at:\n{list}\n\nReplace at all listed locations?"
            ),
        )
        .await
        {
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
                let _ = skill_dialogs::info_dialog(
                    state,
                    "Install skill",
                    &format!("Cannot confirm overwrite: {detail}"),
                    None,
                )
                .await;
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
            let _ = skill_dialogs::info_dialog(
                state,
                "Install skill",
                &format!("Installed {SKILL_ID} to:\n{listing}"),
                None,
            )
            .await;
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
            let _ = skill_dialogs::info_dialog(
                state,
                "Install skill",
                &format!("Install failed:\n{detail}"),
                None,
            )
            .await;
            status(state, "Skill install failed");
        }
    }
}

pub fn run_install_sketching_skill(state: &Arc<AppState>) {
    let state = state.clone();
    tauri::async_runtime::spawn(async move {
        install_sketching_skill_async(&state).await;
    });
}

pub fn run_info_runtime(state: &Arc<AppState>) {
    let state = state.clone();
    tauri::async_runtime::spawn(async move {
        let text = format!(
            "Ready · dialog: {}+http\nHome: {}\nBundled skill: {}",
            dialog_backend_label(),
            home_dir().display(),
            resolve_bundled_skill_dir().display(),
        );
        if skill_dialogs::info_dialog(&state, "Runtime", &text, None)
            .await
            .is_err()
        {
            status(
                &state,
                "Info dialog unavailable or cancelled".to_string(),
            );
        }
    });
}

pub fn run_info_assets(state: &Arc<AppState>) {
    let state = state.clone();
    tauri::async_runtime::spawn(async move {
        if skill_dialogs::info_dialog(
            &state,
            "Assets",
            "Images save into assets/ next to the .excalidraw file.",
            None,
        )
        .await
        .is_err()
        {
            status(
                &state,
                "Info dialog unavailable or cancelled".to_string(),
            );
        }
    });
}

pub fn run_info_about_app(state: &Arc<AppState>) {
    let state = state.clone();
    tauri::async_runtime::spawn(async move {
        let version = env!("CARGO_PKG_VERSION");
        let text = format!(
            "Excalidraw Offline\nVersion: {version}\n\n\
         A Tauri desktop wrapper around @excalidraw/excalidraw for offline local files."
        );
        if skill_dialogs::info_dialog(
            &state,
            "About Excalidraw Offline",
            &text,
            Some("https://github.com/gfaurobert/excalidraw-offline-bin"),
        )
        .await
        .is_err()
        {
            status(
                &state,
                "Info dialog unavailable or cancelled".to_string(),
            );
        }
    });
}

pub fn run_info_about_excalidraw(state: &Arc<AppState>) {
    let state = state.clone();
    tauri::async_runtime::spawn(async move {
        let text = "Excalidraw\nRelease: 0.18.0-4ce38fb\n\n\
         Upstream @excalidraw/excalidraw packaged by this app.";
        if skill_dialogs::info_dialog(
            &state,
            "About Excalidraw",
            text,
            Some("https://github.com/excalidraw/excalidraw"),
        )
        .await
        .is_err()
        {
            status(
                &state,
                "Info dialog unavailable or cancelled".to_string(),
            );
        }
    });
}
