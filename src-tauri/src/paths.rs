use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

pub fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

pub fn desktop_log_dir() -> PathBuf {
    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home_dir())
            .join("ExcalidrawOffline")
            .join("logs")
    }
    #[cfg(not(windows))]
    {
        config_dir().join("logs")
    }
}

pub fn config_dir() -> PathBuf {
    if cfg!(target_os = "linux") {
        std::env::var("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home_dir().join(".config"))
            .join("excalidraw-offline")
    } else if cfg!(target_os = "macos") {
        home_dir()
            .join("Library")
            .join("Application Support")
            .join("excalidraw-offline")
    } else {
        home_dir().join(".config").join("excalidraw-offline")
    }
}

pub fn recent_file_path() -> PathBuf {
    config_dir().join("recent.json")
}

pub fn library_file_path() -> PathBuf {
    config_dir().join("library.excalidrawlib")
}

pub fn resolve_open_path(raw: &str, cwd: &Path) -> PathBuf {
    let path = PathBuf::from(raw);
    if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    }
}

pub fn ensure_excalidraw_ext(path: &str) -> String {
    if path.to_lowercase().ends_with(".excalidraw") {
        path.to_string()
    } else {
        format!("{path}.excalidraw")
    }
}

/// Dev-only fallback: the checkout's `frontend/dist` (live rebuilds without a cargo rebuild).
/// Release builds never look there, so packaged binaries carry no build path and always
/// serve their own embedded frontend.
fn manifest_dist_dir() -> Option<PathBuf> {
    #[cfg(debug_assertions)]
    {
        let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../frontend/dist");
        if dev.join("index.html").is_file() {
            return Some(dev);
        }
    }
    None
}

fn find_dist_with_index(root: &Path) -> Option<PathBuf> {
    if root.join("index.html").is_file() {
        return Some(root.to_path_buf());
    }
    let subdirs = [
        "dist",
        "web",
        "frontend",
        "resources",
        "_up_",
        "frontend/dist",
    ];
    for name in subdirs {
        let p = root.join(name);
        if p.join("index.html").is_file() {
            return Some(p);
        }
    }
    if let Ok(read) = fs::read_dir(root) {
        for entry in read.flatten() {
            let p = entry.path();
            if p.is_dir() && p.join("index.html").is_file() {
                return Some(p);
            }
        }
    }
    None
}

fn resolve_dist_from_exe() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    #[cfg(windows)]
    let bases = vec![
        dir.to_path_buf(),
        dir.join("resources"),
        dir.join("_up_"),
        dir.join("resources").join("_up_"),
        dir.join("resources").join("web"),
        dir.join("web"),
    ];
    #[cfg(not(windows))]
    let bases = vec![
        dir.to_path_buf(),
        dir.join("resources"),
        dir.join("_up_"),
        dir.join("resources").join("_up_"),
    ];
    for base in bases {
        if let Some(found) = find_dist_with_index(&base) {
            return Some(found);
        }
    }
    None
}

pub fn resolve_dist_dir_for_app(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(resource) = app.path().resource_dir() {
        if let Some(found) = find_dist_with_index(&resource) {
            eprintln!(
                "[desktop] frontend dist: {} (tauri resource_dir)",
                found.display()
            );
            return found;
        }
    }
    if let Some(found) = resolve_dist_from_exe() {
        eprintln!(
            "[desktop] frontend dist: {} (exe layout)",
            found.display()
        );
        return found;
    }
    if let Some(dev) = manifest_dist_dir() {
        eprintln!(
            "[desktop] frontend dist: {} (dev manifest)",
            dev.display()
        );
        return dev;
    }
    match crate::embedded_dist::materialize_embedded_dist() {
        Ok(p) => {
            eprintln!(
                "[desktop] frontend dist: {} (embedded extract)",
                p.display()
            );
            p
        }
        Err(e) => {
            eprintln!("[desktop] embedded frontend extract failed: {e}");
            std::env::temp_dir().join("excalidraw-offline-web")
        }
    }
}

/// Used by CLI export before Tauri starts (dev / CI).
pub fn resolve_dist_dir() -> PathBuf {
    if let Some(found) = resolve_dist_from_exe() {
        return found;
    }
    if let Some(dev) = manifest_dist_dir() {
        return dev;
    }
    crate::embedded_dist::materialize_embedded_dist()
        .unwrap_or_else(|_| std::env::temp_dir().join("excalidraw-offline-web"))
}
