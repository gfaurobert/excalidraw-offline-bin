#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use excalidraw_offline_lib::{
    parse_export_cli, print_export_help, print_top_level_help, run_cli_export, run_gui,
    wants_export_help, wants_top_level_help,
};
use std::env;
use excalidraw_offline_lib::paths::resolve_open_path;
use std::path::Path;

/// The release exe uses the GUI subsystem, so a console that runs the CLI
/// (`export`, `--help`) gives it no stdout/stderr. Attach to the parent console
/// in that case so paths, `--json` output and errors are visible.
#[cfg(windows)]
fn attach_parent_console() {
    use windows::Win32::System::Console::{
        AttachConsole, GetStdHandle, ATTACH_PARENT_PROCESS, STD_OUTPUT_HANDLE,
    };
    // SAFETY: plain Win32 calls without pointers; a failed attach is ignored.
    unsafe {
        let has_stdout = GetStdHandle(STD_OUTPUT_HANDLE)
            .map(|h| !h.is_invalid() && !h.0.is_null())
            .unwrap_or(false);
        if !has_stdout {
            let _ = AttachConsole(ATTACH_PARENT_PROCESS);
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    #[cfg(windows)]
    if wants_top_level_help(&args) || args.iter().skip(1).any(|a| a == "export") {
        attach_parent_console();
    }
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
