#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use excalidraw_offline_lib::{
    parse_export_cli, print_export_help, print_top_level_help, run_cli_export, run_gui,
    wants_export_help, wants_top_level_help,
};
use std::env;
use excalidraw_offline_lib::paths::resolve_open_path;
use std::path::Path;

fn main() {
    let args: Vec<String> = env::args().collect();
    if wants_top_level_help(&args) {
        print_top_level_help();
        return;
    }
    if wants_export_help(&args) {
        print_export_help();
        return;
    }

    let cwd = env::current_dir().unwrap_or_else(|_| Path::new(".").to_path_buf());
    match parse_export_cli(&args, &cwd) {
        Ok(Some(command)) => {
            let code = run_cli_export(command);
            std::process::exit(code);
        }
        Ok(None) => {
            let open = args
                .iter()
                .find(|a| a.to_lowercase().ends_with(".excalidraw"))
                .map(|p| resolve_open_path(p, &cwd));
            run_gui(open);
        }
        Err(msg) if msg == "__HELP_EXPORT__" => {
            print_export_help();
        }
        Err(msg) => {
            eprintln!("{msg}");
            std::process::exit(1);
        }
    }
}
