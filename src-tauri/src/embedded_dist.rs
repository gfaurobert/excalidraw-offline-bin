use include_dir::{include_dir, Dir};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io;
use std::path::{Path, PathBuf};

static EMBEDDED_FRONTEND: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../frontend/dist");

const EXTRACT_MARKER: &str = ".extract-v2";

fn hash_embedded_dir(dir: &Dir<'_>, hasher: &mut DefaultHasher) {
    for entry in dir.entries() {
        match entry {
            include_dir::DirEntry::Dir(sub) => hash_embedded_dir(sub, hasher),
            include_dir::DirEntry::File(file) => {
                file.path().hash(hasher);
                file.contents().hash(hasher);
            }
        }
    }
}

fn embedded_dist_fingerprint() -> String {
    let mut hasher = DefaultHasher::new();
    hash_embedded_dir(&EMBEDDED_FRONTEND, &mut hasher);
    format!("{:016x}", hasher.finish())
}

fn extract_dir(dir: &Dir<'_>, dest: &Path) -> io::Result<()> {
    for entry in dir.entries() {
        match entry {
            include_dir::DirEntry::Dir(sub) => {
                fs::create_dir_all(dest.join(sub.path()))?;
                extract_dir(sub, dest)?;
            }
            include_dir::DirEntry::File(file) => {
                if let Some(parent) = file.path().parent() {
                    fs::create_dir_all(dest.join(parent))?;
                }
                fs::write(dest.join(file.path()), file.contents())?;
            }
        }
    }
    Ok(())
}

fn cached_extract_is_valid(base: &Path, expected_fingerprint: &str) -> bool {
    if !base.join("index.html").is_file() {
        return false;
    }
    let marker = base.join(EXTRACT_MARKER);
    if !marker.is_file() {
        return false;
    }
    fs::read_to_string(marker)
        .ok()
        .is_some_and(|on_disk| on_disk.trim() == expected_fingerprint)
}

/// Materialize bundled frontend to a stable temp directory (release fallback on Windows).
pub fn materialize_embedded_dist() -> io::Result<PathBuf> {
    let base = std::env::temp_dir().join(format!(
        "excalidraw-offline-web-{}",
        env!("CARGO_PKG_VERSION")
    ));
    let fingerprint = embedded_dist_fingerprint();
    if cached_extract_is_valid(&base, &fingerprint) {
        return Ok(base);
    }
    if base.exists() {
        fs::remove_dir_all(&base)?;
    }
    fs::create_dir_all(&base)?;
    extract_dir(&EMBEDDED_FRONTEND, &base)?;
    fs::write(base.join(EXTRACT_MARKER), format!("{fingerprint}\n"))?;
    Ok(base)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn extract_dir_does_not_double_nested_paths() {
        let temp = std::env::temp_dir().join(format!(
            "excalidraw-offline-extract-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).unwrap();
        extract_dir(&EMBEDDED_FRONTEND, &temp).unwrap();
        assert!(
            temp.join("index.html").is_file(),
            "index.html should be at extract root"
        );
        if temp.join("assets").is_dir() {
            assert!(
                !temp.join("assets/assets").exists(),
                "assets must not be nested twice"
            );
        }
        let _ = fs::remove_dir_all(&temp);
    }
}
