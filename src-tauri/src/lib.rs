mod app_state;
mod cli_export;
mod dialogs;
mod dialogs_main;
#[cfg(target_os = "linux")]
mod dialogs_linux;
mod embedded_dist;
mod e2e;
#[cfg(target_os = "linux")]
mod gtk_async;
#[cfg(target_os = "linux")]
mod gtk_dialogs;
mod install_skill;
mod skill_dialog_common;
mod skill_dialogs;
#[cfg(any(target_os = "linux", target_os = "windows"))]
mod skill_install_flow;
#[cfg(windows)]
mod win_dialogs;
mod desktop_log;
mod export;
mod http_server;
mod local_http;
mod menu;
mod quit_flow;
pub mod paths;
mod recent;
mod scene;

use app_state::AppState;
use http_server::start_http_server;
use menu::{build_menu, handle_menu_click};
use paths::{recent_file_path, resolve_dist_dir_for_app};
use recent::RecentStore;
use std::sync::Arc;
use quit_flow::request_application_quit;
use std::time::Duration;
use tauri::{Listener, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};

pub use cli_export::run_cli_export;
pub use export::{
    parse_export_cli, print_export_help, print_top_level_help, wants_export_help,
    wants_top_level_help,
};

fn warm_webview_navigation(win: tauri::WebviewWindow, app_url: String) {
    // WebView2 can show a blank page if the first navigation races the listener; retry navigations.
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(600));
        for attempt in 1..=5 {
            desktop_log::info(&format!("webview navigation attempt {attempt} for {app_url}"));
            if attempt > 1 {
                if let Ok(url) = Url::parse(&app_url) {
                    let _ = win.navigate(url);
                }
                std::thread::sleep(Duration::from_millis(600));
            }
        }
    });
}

pub fn run_gui(startup_open: Option<std::path::PathBuf>) {
    desktop_log::init();
    let recent = RecentStore::load(recent_file_path());
    let state = AppState::new(recent);

    let rt = std::sync::Arc::new(tokio::runtime::Runtime::new().expect("tokio runtime"));

    let state_menu = state.clone();
    let state_events = state.clone();
    let state_setup = state.clone();
    let rt_setup = rt.clone();
    tauri::Builder::default()
        .menu(move |app| build_menu(app, &state_menu))
        .on_menu_event(move |app, event| {
            handle_menu_click(app, &state_events, event.id().as_ref());
        })
        .setup(move |app| {
            #[cfg(target_os = "linux")]
            {
                if gtk::init().is_err() {
                    desktop_log::error("gtk::init failed in setup");
                }
            }
            dialogs_main::mark_gtk_main_thread();
            #[cfg(target_os = "linux")]
            if std::env::var("EXCALIDRAW_E2E_MAIN_LOOP_HEARTBEAT")
                .ok()
                .as_deref()
                == Some("1")
            {
                gtk::glib::timeout_add_seconds(1, move || {
                    desktop_log::info("main-loop-heartbeat");
                    gtk::glib::ControlFlow::Continue
                });
            }
            *state_setup.app_handle.lock() = Some(app.handle().clone());
            let dist = resolve_dist_dir_for_app(app.handle());
            let index_ok = dist.join("index.html").is_file();
            desktop_log::info(&format!(
                "dist_dir={} index.html={index_ok}",
                dist.display()
            ));
            let port = rt_setup.block_on(start_http_server(state_setup.clone(), dist));
            if let Err(e) = rt_setup.block_on(local_http::wait_until_http_ready(port)) {
                desktop_log::error(&format!("HTTP warmup failed: {e}"));
            }
            let app_url = format!("http://127.0.0.1:{port}/");
            desktop_log::info(&format!("app url {app_url}"));
            eprintln!("[desktop] app url {app_url}");
            let _ = std::io::Write::flush(&mut std::io::stderr());
            let url = app_url.parse().expect("app url");
            let win =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                    .title("Excalidraw Offline")
                    .inner_size(1280.0, 800.0)
                    .visible(false)
                    .build()?;
            warm_webview_navigation(win.clone(), app_url.clone());
            let win_events = win.clone();
            win_events.listen("tauri://error", |event| {
                desktop_log::error(&format!("webview error: {}", event.payload()));
            });
            win.show()?;
            win.set_focus()?;
            if let Some(path) = startup_open {
                state_setup.enqueue_ui(app_state::UiCommand::Open {
                    path: Some(path.to_string_lossy().into_owned()),
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let Some(app_state) = window.app_handle().try_state::<Arc<AppState>>() else {
                    return;
                };
                if *app_state.allow_close.lock() {
                    return;
                }
                api.prevent_close();
                request_application_quit(window.app_handle(), &app_state);
            }
        })
        .manage(state)
        .run(tauri::generate_context!())
        .expect("tauri run");
}
