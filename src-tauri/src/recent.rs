use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const RECENT_MAX: usize = 10;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct RecentFile {
    paths: Vec<String>,
}

pub struct RecentStore {
    path: PathBuf,
    inner: Mutex<Vec<String>>,
}

impl RecentStore {
    pub fn load(path: PathBuf) -> Self {
        let paths = std::fs::read_to_string(&path)
            .ok()
            .and_then(|t| serde_json::from_str::<RecentFile>(&t).ok())
            .map(|r| r.paths)
            .unwrap_or_default();
        Self {
            path,
            inner: Mutex::new(paths),
        }
    }

    fn persist(&self) {
        let paths = self.inner.lock().clone();
        let payload = RecentFile { paths };
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(text) = serde_json::to_string_pretty(&payload) {
            let _ = std::fs::write(&self.path, format!("{text}\n"));
        }
    }

    pub fn list(&self) -> Vec<String> {
        self.inner.lock().clone()
    }

    pub fn touch(&self, path: &str) {
        let mut list = self.inner.lock();
        list.retain(|p| p != path);
        list.insert(0, path.to_string());
        if list.len() > RECENT_MAX {
            list.truncate(RECENT_MAX);
        }
        drop(list);
        self.persist();
    }

    pub fn remove(&self, path: &str) {
        self.inner.lock().retain(|p| p != path);
        self.persist();
    }
}

pub fn recent_display_labels(paths: &[String]) -> Vec<String> {
    paths
        .iter()
        .map(|p| {
            let pb = PathBuf::from(p);
            pb.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(p)
                .to_string()
        })
        .collect()
}
