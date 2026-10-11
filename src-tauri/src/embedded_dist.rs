use include_dir::{include_dir, Dir};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

static EMBEDDED_FRONTEND: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../frontend/dist");

fn extract_dir(dir: &Dir<'_>, dest: &Path) -> io::Result<()> {
    for entry in dir.entries() {
        match entry {
            include_dir::DirEntry::Dir(sub) => {
                let sub_dest = dest.join(sub.path());
                fs::create_dir_all(&sub_dest)?;
                extract_dir(sub, &sub_dest)?;
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

/// Materialize bundled frontend to a stable temp directory (release fallback on Windows).
pub fn materialize_embedded_dist() -> io::Result<PathBuf> {
    let base = std::env::temp_dir().join(format!(
        "excalidraw-offline-web-{}",
        env!("CARGO_PKG_VERSION")
    ));
    if base.join("index.html").is_file() {
        return Ok(base);
    }
    if base.exists() {
        fs::remove_dir_all(&base)?;
    }
    fs::create_dir_all(&base)?;
    extract_dir(&EMBEDDED_FRONTEND, &base)?;
    Ok(base)
}
