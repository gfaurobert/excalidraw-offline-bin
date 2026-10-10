use std::path::{Path, PathBuf};

pub fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

pub fn config_dir() -> PathBuf {
    if cfg!(target_os = "linux") {
        std::env::var("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home_dir().join(".config"))
            .join("excalidraw-offline")
    } else {
        home_dir().join(".config").join("excalidraw-offline")
    }
}

pub fn recent_file_path() -> PathBuf {
    config_dir().join("recent.json")
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

pub fn manifest_dist_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../frontend/dist")
}

pub fn resolve_dist_dir() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidates = [
                dir.join("../lib/excalidraw-offline/resources"),
                dir.join("../resources"),
                dir.join("resources"),
            ];
            for c in candidates {
                let p = c.canonicalize().unwrap_or(c);
                if p.join("index.html").is_file() {
                    return p;
                }
            }
        }
    }
    manifest_dist_dir()
}
