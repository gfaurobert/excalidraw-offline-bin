use std::path::{Path, PathBuf};

pub const SKILL_ID: &str = "excalidraw-sketching";

pub const SKILL_INSTALL_ENTRIES: &[&str] = &["SKILL.md", "references"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallMode {
    Global,
    Project,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HarnessId {
    Agents,
    Claude,
    Kiro,
    Cline,
    All,
}

pub struct HarnessOption {
    pub id: HarnessId,
    pub label: &'static str,
}

pub const HARNESS_TARGET_OPTIONS: &[HarnessOption] = &[
    HarnessOption {
        id: HarnessId::Agents,
        label: ".agents/skills (Codex, Cursor, GitHub Copilot, Gemini CLI, OpenCode, Amp, Goose, Roo Code, Windsurf)",
    },
    HarnessOption {
        id: HarnessId::Claude,
        label: "Claude Code",
    },
    HarnessOption {
        id: HarnessId::Kiro,
        label: "Kiro",
    },
    HarnessOption {
        id: HarnessId::Cline,
        label: "Cline",
    },
    HarnessOption {
        id: HarnessId::All,
        label: "All",
    },
];

pub const DEFAULT_HARNESS_IDS: &[HarnessId] = &[HarnessId::Agents, HarnessId::Claude];

pub fn harness_id_str(id: HarnessId) -> &'static str {
    match id {
        HarnessId::Agents => "agents",
        HarnessId::Claude => "claude",
        HarnessId::Kiro => "kiro",
        HarnessId::Cline => "cline",
        HarnessId::All => "all",
    }
}

pub fn parse_harness_id(s: &str) -> Option<HarnessId> {
    match s.trim() {
        "agents" => Some(HarnessId::Agents),
        "claude" => Some(HarnessId::Claude),
        "kiro" => Some(HarnessId::Kiro),
        "cline" => Some(HarnessId::Cline),
        "all" => Some(HarnessId::All),
        _ => None,
    }
}

fn normalize_root(picked: &str) -> PathBuf {
    let t = picked.trim().trim_end_matches(['/', '\\']);
    if t.is_empty() {
        PathBuf::from("/")
    } else {
        PathBuf::from(t)
    }
}

pub fn harness_skills_dir(harness: HarnessId, root: &Path) -> PathBuf {
    match harness {
        HarnessId::Agents => root.join(".agents").join("skills"),
        HarnessId::Claude => root.join(".claude").join("skills"),
        HarnessId::Kiro => root.join(".kiro").join("skills"),
        HarnessId::Cline => root.join(".cline").join("skills"),
        HarnessId::All => unreachable!("concrete harness only"),
    }
}

pub fn expand_harness_selection(selected: &[HarnessId]) -> Vec<HarnessId> {
    if selected.contains(&HarnessId::All) {
        return vec![
            HarnessId::Agents,
            HarnessId::Claude,
            HarnessId::Kiro,
            HarnessId::Cline,
        ];
    }
    let mut out = Vec::new();
    for id in selected {
        if *id == HarnessId::All {
            continue;
        }
        if !out.contains(id) {
            out.push(*id);
        }
    }
    out
}

pub fn resolve_harness_install_dests(
    mode: InstallMode,
    home: &Path,
    harness_ids: &[HarnessId],
    project_root: Option<&Path>,
) -> Result<Vec<PathBuf>, String> {
    let root = match mode {
        InstallMode::Global => home.to_path_buf(),
        InstallMode::Project => {
            let Some(p) = project_root else {
                return Err("picked path required for project install".into());
            };
            if p.as_os_str().is_empty() {
                return Err("picked path required for project install".into());
            }
            normalize_root(p.to_string_lossy().as_ref())
        }
        InstallMode::Custom => unreachable!("custom uses resolve_install_target"),
    };
    let expanded = expand_harness_selection(harness_ids);
    Ok(expanded
        .into_iter()
        .map(|h| harness_skills_dir(h, &root).join(SKILL_ID))
        .collect())
}

pub fn resolve_install_target(
    mode: InstallMode,
    home: &Path,
    picked: Option<&Path>,
) -> Result<PathBuf, String> {
    match mode {
        InstallMode::Global => Ok(home.join(".agents").join("skills").join(SKILL_ID)),
        InstallMode::Project | InstallMode::Custom => {
            let Some(p) = picked else {
                return Err("picked path required for project/custom install".into());
            };
            let root = normalize_root(p.to_string_lossy().as_ref());
            if mode == InstallMode::Project {
                Ok(root.join(".agents").join("skills").join(SKILL_ID))
            } else {
                Ok(root.join(SKILL_ID))
            }
        }
    }
}

pub fn resolve_bundled_skill_dir() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidates = vec![
                dir.join("resources/skills/excalidraw-sketching"),
                dir.join("../resources/skills/excalidraw-sketching"),
                dir.join("../lib/excalidraw-offline/resources/skills/excalidraw-sketching"),
                dir.join("../skills/excalidraw-sketching"),
            ];
            #[cfg(windows)]
            {
                candidates.insert(0, dir.join("skills/excalidraw-sketching"));
                if let Some(res) = std::env::var_os("RESOURCE") {
                    candidates.push(
                        PathBuf::from(res).join("skills/excalidraw-sketching"),
                    );
                }
            }
            for c in candidates {
                let p = c.canonicalize().unwrap_or(c);
                if p.join("SKILL.md").is_file() {
                    return p;
                }
            }
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../skills/excalidraw-sketching")
}

fn path_exists(path: &Path) -> bool {
    path.exists()
}

fn copy_dir_recursive(source: &Path, dest: &Path) -> std::io::Result<()> {
    if dest.exists() {
        std::fs::remove_dir_all(dest)?;
    }
    std::fs::create_dir_all(dest)?;
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let from = entry.path();
        let to = dest.join(entry.file_name());
        if from.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if from.is_file() {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

pub fn copy_skill_content(source: &Path, dest: &Path) -> Result<(), String> {
    if dest.exists() {
        std::fs::remove_dir_all(dest).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for name in SKILL_INSTALL_ENTRIES {
        let from = source.join(name);
        if !from.exists() {
            continue;
        }
        let to = dest.join(name);
        if from.is_file() {
            std::fs::copy(&from, &to).map_err(|e| e.to_string())?;
        } else if from.is_dir() {
            copy_dir_recursive(&from, &to).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn assert_skill_source(source: &Path) -> Result<(), String> {
    let skill_md = source.join("SKILL.md");
    if !skill_md.is_file() {
        return Err(format!("Bundled skill missing at {} (no SKILL.md)", source.display()));
    }
    if source.file_name().and_then(|n| n.to_str()) != Some(SKILL_ID) {
        return Err(format!(
            "Expected skill folder named {SKILL_ID}, got {}",
            source.display()
        ));
    }
    Ok(())
}

pub fn install_skill_to(source: &Path, dest: &Path) -> Result<(), String> {
    assert_skill_source(source)?;
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    copy_skill_content(source, dest)
}

pub fn install_skill_to_many(source: &Path, dests: &[PathBuf]) -> Result<Vec<PathBuf>, String> {
    if dests.is_empty() {
        return Err("no destinations".into());
    }
    assert_skill_source(source)?;
    let mut installed = Vec::new();
    for dest in dests {
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        copy_skill_content(source, dest)?;
        installed.push(dest.clone());
    }
    Ok(installed)
}

pub fn existing_dests(dests: &[PathBuf]) -> Vec<PathBuf> {
    dests.iter().filter(|d| path_exists(d)).cloned().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_all() {
        let e = expand_harness_selection(&[HarnessId::All]);
        assert_eq!(e.len(), 4);
    }

    #[test]
    fn global_dests() {
        let home = PathBuf::from("/home/alice");
        let dests = resolve_harness_install_dests(
            InstallMode::Global,
            &home,
            &[HarnessId::Agents, HarnessId::Claude],
            None,
        )
        .unwrap();
        assert_eq!(
            dests[0],
            PathBuf::from("/home/alice/.agents/skills/excalidraw-sketching")
        );
        assert_eq!(
            dests[1],
            PathBuf::from("/home/alice/.claude/skills/excalidraw-sketching")
        );
    }
}
