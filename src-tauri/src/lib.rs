mod app_state;
mod cli_export;
mod dialogs;
mod export;
mod http_server;
mod menu;
pub mod paths;
mod recent;
mod scene;

use app_state::{AppState, UiCommand};
use http_server::start_http_server;
use menu::{build_menu, handle_menu_click};
use paths::{recent_file_path, resolve_dist_dir};
use recent::RecentStore;
use std::sync::Arc;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

pub use cli_export::run_cli_export;
pub use export::{
    parse_export_cli, print_export_help, print_top_level_help, wants_export_help,
    wants_top_level_help,
};

pub fn run_gui(startup_open: Option<std::path::PathBuf>) {
    let dist_dir = resolve_dist_dir();
    let recent = RecentStore::load(recent_file_path());
    let state = AppState::new(dist_dir, recent);

    let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
    let port = rt.block_on(start_http_server(state.clone()));
    let app_url = format!("http://127.0.0.1:{port}/");
    println!("[desktop] app url {app_url}");

    let state_menu = state.clone();
    let state_events = state.clone();
    let state_setup = state.clone();
    tauri::Builder::default()
        .menu(move |app| build_menu(app, &state_menu))
        .on_menu_event(move |app, event| {
            handle_menu_click(app, &state_events, event.id().as_ref());
        })
        .setup(move |app| {
            *state_setup.app_handle.lock() = Some(app.handle().clone());
            let url = app_url.parse().expect("app url");
            let win =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                    .title("Excalidraw Offline")
                    .inner_size(1280.0, 800.0)
                    .build()?;
            win.show()?;
            if let Some(path) = startup_open {
                state_setup.enqueue_ui(app_state::UiCommand::Open {
                    path: Some(path.to_string_lossy().into_owned()),
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if let Some(app_state) = window.try_state::<Arc<AppState>>() {
                    if !*app_state.allow_close.lock() {
                        api.prevent_close();
                        app_state.enqueue_ui(UiCommand::Quit);
                    }
                }
            }
        })
        .manage(state)
        .run(tauri::generate_context!())
        .expect("tauri run");
}
