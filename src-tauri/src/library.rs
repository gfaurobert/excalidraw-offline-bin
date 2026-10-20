use serde_json::{json, Value};
use std::path::{Path, PathBuf};

const LIBRARY_MIME: &str = "application/vnd.excalidrawlib+json";
const LIBRARY_VERSION: u32 = 2;
const LIBRARY_SOURCE: &str = "excalidraw-offline";

pub struct LibraryStore {
    path: PathBuf,
}

impl LibraryStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn load(&self) -> Result<Value, String> {
        let text = match std::fs::read_to_string(&self.path) {
            Ok(t) => t,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Ok(json!([]));
            }
            Err(e) => return Err(e.to_string()),
        };
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Ok(json!([]));
        }
        let parsed: Value =
            serde_json::from_str(trimmed).map_err(|e| format!("invalid library JSON: {e}"))?;
        extract_library_items(parsed)
    }

    pub fn save(&self, library_items: &Value) -> Result<(), String> {
        if !library_items.is_array() {
            return Err("libraryItems must be a JSON array".into());
        }
        let payload = json!({
            "type": LIBRARY_MIME,
            "version": LIBRARY_VERSION,
            "source": LIBRARY_SOURCE,
            "libraryItems": library_items,
        });
        let text = serde_json::to_string_pretty(&payload)
            .map_err(|e| e.to_string())?
            + "\n";
        atomic_write(&self.path, text.as_bytes())
    }
}

fn extract_library_items(parsed: Value) -> Result<Value, String> {
    if parsed.is_array() {
        return Ok(parsed);
    }
    if let Some(items) = parsed.get("libraryItems") {
        if items.is_array() {
            return Ok(items.clone());
        }
    }
    if let Some(items) = parsed.get("library") {
        if items.is_array() {
            return Ok(items.clone());
        }
    }
    Err("library file missing libraryItems array".into())
}

fn atomic_write(path: &Path, contents: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        e.to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_library_path() -> PathBuf {
        let n = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "exoff-library-test-{}-{}.excalidrawlib",
            std::process::id(),
            n
        ))
    }

    #[test]
    fn save_and_load_roundtrip() {
        let path = temp_library_path();
        let store = LibraryStore::new(path.clone());
        let items = json!([{
            "id": "item-1",
            "status": "published",
            "elements": [{"id": "el-1", "type": "rectangle"}]
        }]);
        store.save(&items).expect("save");
        let loaded = store.load().expect("load");
        assert_eq!(loaded, items);
        let disk = std::fs::read_to_string(&path).expect("read file");
        assert!(disk.contains(LIBRARY_MIME));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn missing_file_returns_empty_array() {
        let path = temp_library_path();
        let store = LibraryStore::new(path);
        let loaded = store.load().expect("load");
        assert_eq!(loaded, json!([]));
    }

    #[test]
    fn rejects_non_array_save() {
        let path = temp_library_path();
        let store = LibraryStore::new(path.clone());
        let err = store.save(&json!({"not": "array"})).unwrap_err();
        assert!(err.contains("array"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn load_legacy_library_wrapper() {
        let path = temp_library_path();
        std::fs::write(
            &path,
            r#"{"library":[{"id":"x","status":"published","elements":[]}]}"#,
        )
        .unwrap();
        let store = LibraryStore::new(path.clone());
        let loaded = store.load().expect("load");
        assert_eq!(loaded.as_array().unwrap().len(), 1);
        let _ = std::fs::remove_file(&path);
    }
}
