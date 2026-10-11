use crate::app_state::{AppState, UiCommand, UiMode};
use crate::quit_flow::request_application_quit;
use crate::dialogs::{open_excalidraw_dialog, save_excalidraw_dialog, DialogResult};
use crate::recent::recent_display_labels;
use std::sync::Arc;
use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Wry};

const CLEAR_RECENT_ID: &str = "clear-recent";

pub fn refresh_menu(state: &Arc<AppState>) {
    let Some(app) = state.app_handle.lock().clone() else {
        return;
    };
    let recent_paths = state.recent.list();
    let _ = apply_menu(&app, state, &recent_paths);
}

pub fn build_menu(app: &AppHandle, state: &Arc<AppState>) -> tauri::Result<Menu<Wry>> {
    let recent_paths = state.recent.list();
    apply_menu(app, state, &recent_paths)
}

pub fn apply_menu(
    app: &AppHandle,
    state: &Arc<AppState>,
    recent_paths: &[String],
) -> tauri::Result<Menu<Wry>> {
    let ui_mode = state.ui_mode.lock().clone();
    let current_path = state.current_path.lock().clone();
    let reload_enabled = matches!(ui_mode, UiMode::Canvas) && current_path.is_some();
    let canvas_enabled = matches!(ui_mode, UiMode::Canvas);

    let labels = recent_display_labels(recent_paths);
    let mut recent_entries: Vec<MenuItem<Wry>> = Vec::new();
    if recent_paths.is_empty() {
        recent_entries.push(MenuItem::with_id(
            app,
            "recent-empty",
            "(No recent files)",
            false,
            None::<&str>,
        )?);
    } else {
        for (i, path) in recent_paths.iter().enumerate() {
            let id = format!("recent:{path}");
            recent_entries.push(MenuItem::with_id(
                app,
                id,
                &labels[i],
                true,
                None::<&str>,
            )?);
        }
    }
    let clear_item = MenuItem::with_id(
        app,
        CLEAR_RECENT_ID,
        "Clear Recent",
        !recent_paths.is_empty(),
        None::<&str>,
    )?;
    let sep = PredefinedMenuItem::separator(app)?;

    let mut recent_refs: Vec<&dyn IsMenuItem<Wry>> = Vec::new();
    for item in &recent_entries {
        recent_refs.push(item);
    }
    recent_refs.push(&sep);
    recent_refs.push(&clear_item);

    let recent_sub = Submenu::with_items(app, "Open Recent", true, &recent_refs)?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(app, "new", "New", true, Some("Ctrl+N"))?,
            &MenuItem::with_id(app, "open", "Open…", true, Some("Ctrl+O"))?,
            &recent_sub,
            &MenuItem::with_id(app, "close", "Close", true, Some("Ctrl+W"))?,
            &MenuItem::with_id(
                app,
                "reload",
                "Reload",
                reload_enabled,
                Some("Ctrl+R"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "save", "Save", canvas_enabled, Some("Ctrl+S"))?,
            &MenuItem::with_id(
                app,
                "save-as",
                "Save As…",
                canvas_enabled,
                Some("Ctrl+Shift+S"),
            )?,
            &MenuItem::with_id(app, "quit", "Quit", true, Some("Ctrl+Q"))?,
        ],
    )?;

    let skills_menu = Submenu::with_items(
        app,
        "Skills",
        true,
        &[&MenuItem::with_id(
            app,
            "skills-install-sketching",
            "Install excalidraw-sketching skill",
            true,
            None::<&str>,
        )?],
    )?;

    let info_menu = Submenu::with_items(
        app,
        "Info",
        true,
        &[
            &MenuItem::with_id(app, "info-runtime", "Runtime", true, None::<&str>)?,
            &MenuItem::with_id(app, "info-assets", "Assets", true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                "info-about-app",
                "About Excalidraw Offline",
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                "info-about-excalidraw",
                "About Excalidraw",
                true,
                None::<&str>,
            )?,
        ],
    )?;

    let menu = Menu::with_items(app, &[&file_menu, &skills_menu, &info_menu])?;
    app.set_menu(menu.clone())?;
    Ok(menu)
}

fn picker_unavailable() -> String {
    "File picker unavailable (native dialog failed)".to_string()
}

pub fn handle_menu_click(app: &AppHandle, state: &Arc<AppState>, id: &str) {
    if id.starts_with("recent:") {
        let path = id.strip_prefix("recent:").unwrap_or("").to_string();
        if std::path::Path::new(&path).is_file() {
            state.enqueue_ui(UiCommand::Open { path: Some(path) });
        } else {
            state.enqueue_ui(UiCommand::Status {
                message: format!("Recent file missing: {path}"),
            });
            state.recent.remove(&path);
            refresh_menu(state);
        }
        return;
    }

    match id {
        CLEAR_RECENT_ID => {
            for p in state.recent.list() {
                state.recent.remove(&p);
            }
            refresh_menu(state);
        }
        "new" => state.enqueue_ui(UiCommand::New),
        "open" => {
            state.enqueue_ui(UiCommand::Status {
                message: "Choose file to open…".into(),
            });
            let state = state.clone();
            tauri::async_runtime::spawn(async move {
                match open_excalidraw_dialog(&state).await {
                    DialogResult::Ok { path } => {
                        state.enqueue_ui(UiCommand::Open { path: Some(path) });
                    }
                    DialogResult::Cancelled => {
                        state.enqueue_ui(UiCommand::Status {
                            message: "Open cancelled".into(),
                        });
                    }
                    DialogResult::Unavailable { .. } => {
                        state.enqueue_ui(UiCommand::Status {
                            message: picker_unavailable(),
                        });
                    }
                }
            });
        }
        "save" => {
            let path = state.current_path.lock().clone();
            if let Some(p) = path {
                state.enqueue_ui(UiCommand::Save {
                    force_picker: false,
                    path: Some(p),
                });
            } else {
                state.enqueue_ui(UiCommand::Status {
                    message: "Choose save location…".into(),
                });
                let state = state.clone();
                tauri::async_runtime::spawn(async move {
                    match save_excalidraw_dialog(&state, "drawing.excalidraw").await {
                        DialogResult::Ok { path } => {
                            state.enqueue_ui(UiCommand::Save {
                                force_picker: false,
                                path: Some(path),
                            });
                        }
                        DialogResult::Cancelled => {
                            state.enqueue_ui(UiCommand::Status {
                                message: "Save cancelled".into(),
                        });
                        }
                        DialogResult::Unavailable { .. } => {
                            state.enqueue_ui(UiCommand::Status {
                                message: picker_unavailable(),
                            });
                        }
                    }
                });
            }
        }
        "save-as" => {
            state.enqueue_ui(UiCommand::Status {
                message: "Choose save location…".into(),
            });
            let suggested = state
                .current_path
                .lock()
                .clone()
                .unwrap_or_else(|| "drawing.excalidraw".into());
            let state = state.clone();
            tauri::async_runtime::spawn(async move {
                match save_excalidraw_dialog(&state, &suggested).await {
                    DialogResult::Ok { path } => {
                        state.enqueue_ui(UiCommand::Save {
                            force_picker: false,
                            path: Some(path),
                        });
                    }
                    DialogResult::Cancelled => {
                        state.enqueue_ui(UiCommand::Status {
                            message: "Save cancelled".into(),
                        });
                    }
                    DialogResult::Unavailable { .. } => {
                        state.enqueue_ui(UiCommand::Status {
                            message: picker_unavailable(),
                        });
                    }
                }
            });
        }
        "reload" => state.enqueue_ui(UiCommand::Reload),
        "close" => state.enqueue_ui(UiCommand::Close),
        "quit" => request_application_quit(app, state),
        "skills-install-sketching" => {
            #[cfg(target_os = "linux")]
            {
                crate::skill_install_flow::run_install_sketching_skill(state);
            }
            #[cfg(not(target_os = "linux"))]
            {
                state.enqueue_ui(UiCommand::Status {
                    message: "Skills install is supported on Linux only in this build".into(),
                });
            }
        }
        "info-runtime" => {
            #[cfg(target_os = "linux")]
            crate::skill_install_flow::run_info_runtime(state);
            #[cfg(not(target_os = "linux"))]
            state.enqueue_ui(UiCommand::Status {
                message: "Info menu is supported on Linux only in this build".into(),
            });
        }
        "info-assets" => {
            #[cfg(target_os = "linux")]
            crate::skill_install_flow::run_info_assets(state);
            #[cfg(not(target_os = "linux"))]
            state.enqueue_ui(UiCommand::Status {
                message: "Info menu is supported on Linux only in this build".into(),
            });
        }
        "info-about-app" => {
            #[cfg(target_os = "linux")]
            crate::skill_install_flow::run_info_about_app(state);
            #[cfg(not(target_os = "linux"))]
            state.enqueue_ui(UiCommand::Status {
                message: "Info menu is supported on Linux only in this build".into(),
            });
        }
        "info-about-excalidraw" => {
            #[cfg(target_os = "linux")]
            crate::skill_install_flow::run_info_about_excalidraw(state);
            #[cfg(not(target_os = "linux"))]
            state.enqueue_ui(UiCommand::Status {
                message: "Info menu is supported on Linux only in this build".into(),
            });
        }
        _ => {}
    }
}
