use crate::paths::desktop_log_dir;
use chrono::Utc;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

fn log_path() -> PathBuf {
    LOG_PATH
        .get_or_init(|| {
            let dir = desktop_log_dir();
            let _ = fs::create_dir_all(&dir);
            dir.join(format!(
                "excalidraw-offline-{}.log",
                Utc::now().format("%Y%m%d")
            ))
        })
        .clone()
}

pub fn init() {
    let path = log_path();
    let _ = fs::create_dir_all(path.parent().unwrap_or(std::path::Path::new(".")));
    info(&format!("logging to {}", path.display()));
}

fn write_line(level: &str, message: &str) {
    let line = format!("{} [{level}] {message}\n", Utc::now().to_rfc3339());
    let _ = std::io::stderr().write_all(line.as_bytes());
    let _ = std::io::stdout().write_all(line.as_bytes());
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_path()) {
        let _ = f.write_all(line.as_bytes());
    }
}

pub fn info(message: &str) {
    write_line("INFO", message);
}

pub fn warn(message: &str) {
    write_line("WARN", message);
}

pub fn error(message: &str) {
    write_line("ERROR", message);
}
