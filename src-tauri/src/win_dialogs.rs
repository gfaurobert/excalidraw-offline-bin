//! Native rfd dialogs for Info menu and skill installer (Windows).
//!
//! Harness multi-select uses a modeless Win32 checklist (`win32_harness_checklist`).

use crate::app_state::AppState;
use crate::dialogs_main::run_on_main;
#[cfg(windows)]
use crate::win32_async;
#[cfg(windows)]
use crate::win32_harness_checklist;
use crate::e2e::e2e_enabled;
use crate::skill_dialog_common::{
    e2e_pause_ms, e2e_skill_cancelled, e2e_sleep_pause, open_url_in_browser, ChoiceOption,
    DialogError, DialogResult,
};

fn info_dialog_sync(title: &str, text: &str, link_url: Option<&str>) -> DialogResult<()> {
    if e2e_skill_cancelled() {
        return Err(DialogError::Cancelled);
    }
    if e2e_enabled()
        && e2e_pause_ms() == 0
        && std::env::var("EXCALIDRAW_E2E_INFO_AUTOOK")
            .map(|v| v == "1")
            .unwrap_or(false)
    {
        return Ok(());
    }
    let pause = e2e_pause_ms();
    if pause > 0 {
        e2e_sleep_pause();
        return Ok(());
    }

    let mut message = text.to_string();
    if let Some(url) = link_url {
        message.push_str("\n\n");
        message.push_str(url);
    }

    let dialog = rfd::MessageDialog::new()
        .set_title(title)
        .set_description(&message)
        .set_level(rfd::MessageLevel::Info);

    let result = if link_url.is_some() {
        dialog
            .set_buttons(rfd::MessageButtons::OkCancelCustom(
                "OK".into(),
                "Open in browser".into(),
            ))
            .show()
    } else {
        dialog.set_buttons(rfd::MessageButtons::Ok).show()
    };

    match result {
        rfd::MessageDialogResult::Cancel if link_url.is_some() => {
            if let Some(url) = link_url {
                open_url_in_browser(url);
            }
            Ok(())
        }
        rfd::MessageDialogResult::Custom(_) if link_url.is_some() => {
            if let Some(url) = link_url {
                open_url_in_browser(url);
            }
            Ok(())
        }
        rfd::MessageDialogResult::Ok | rfd::MessageDialogResult::Custom(_) => Ok(()),
        _ => Ok(()),
    }
}

pub async fn info_dialog(
    state: &Arc<AppState>,
    title: &str,
    text: &str,
    link_url: Option<&str>,
) -> DialogResult<()> {
    let title = title.to_string();
    let text = text.to_string();
    let link = link_url.map(|s| s.to_string());
    run_on_main(state, move || info_dialog_sync(&title, &text, link.as_deref()))
        .await
        .map_err(|detail| DialogError::Unavailable { detail })?
}

fn confirm_dialog_sync(title: &str, text: &str) -> DialogResult<bool> {
    if e2e_skill_cancelled() {
        return Err(DialogError::Cancelled);
    }
    if e2e_enabled() {
        if let Ok(v) = std::env::var("EXCALIDRAW_E2E_SKILL_OVERWRITE") {
            return Ok(v == "yes" || v == "1");
        }
    }
    if e2e_pause_ms() > 0 {
        e2e_sleep_pause();
        if e2e_enabled() {
            return Ok(std::env::var("EXCALIDRAW_E2E_SKILL_OVERWRITE")
                .map(|v| v == "yes" || v == "1")
                .unwrap_or(false));
        }
    }

    let result = rfd::MessageDialog::new()
        .set_title(title)
        .set_description(text)
        .set_level(rfd::MessageLevel::Warning)
        .set_buttons(rfd::MessageButtons::YesNo)
        .show();

    match result {
        rfd::MessageDialogResult::Yes => Ok(true),
        rfd::MessageDialogResult::No => Ok(false),
        _ => Err(DialogError::Cancelled),
    }
}

pub async fn confirm_dialog(
    state: &Arc<AppState>,
    title: &str,
    text: &str,
) -> DialogResult<bool> {
    let title = title.to_string();
    let text = text.to_string();
    run_on_main(state, move || confirm_dialog_sync(&title, &text))
        .await
        .map_err(|detail| DialogError::Unavailable { detail })?
}

fn choice_dialog_sync(
    title: &str,
    text: &str,
    options: &[ChoiceOption],
    default_id: &str,
) -> DialogResult<String> {
    if options.is_empty() {
        return Err(DialogError::Unavailable {
            detail: "no options".into(),
        });
    }
    if e2e_skill_cancelled() {
        return Err(DialogError::Cancelled);
    }
    if e2e_enabled() && e2e_pause_ms() == 0 {
        if let Ok(mode) = std::env::var("EXCALIDRAW_E2E_SKILL_MODE") {
            if mode == "cancel" {
                return Err(DialogError::Cancelled);
            }
            if options.iter().any(|o| o.id == mode) {
                return Ok(mode);
            }
        }
    }
    if e2e_pause_ms() > 0 {
        e2e_sleep_pause();
        if let Ok(mode) = std::env::var("EXCALIDRAW_E2E_SKILL_MODE") {
            if options.iter().any(|o| o.id == mode) {
                return Ok(mode);
            }
        }
        if let Some(o) = options.iter().find(|o| o.id == default_id) {
            return Ok(o.id.clone());
        }
    }

    if options.len() >= 3 {
        let body = format!(
            "{text}\n\n{}\n{}\n{}\n\nChoose Global, Project, or Custom.",
            options[0].label, options[1].label, options[2].label
        );
        let result = rfd::MessageDialog::new()
            .set_title(title)
            .set_description(&body)
            .set_level(rfd::MessageLevel::Info)
            .set_buttons(rfd::MessageButtons::YesNoCancelCustom(
                "Global".into(),
                "Project".into(),
                "Custom".into(),
            ))
            .show();
        return match result {
            rfd::MessageDialogResult::Yes => Ok(options[0].id.clone()),
            rfd::MessageDialogResult::No => Ok(options[1].id.clone()),
            rfd::MessageDialogResult::Cancel | rfd::MessageDialogResult::Custom(_) => {
                Ok(options[2].id.clone())
            }
            _ => Err(DialogError::Cancelled),
        };
    }

    let mut body = format!("{text}\n\n");
    for (i, opt) in options.iter().enumerate() {
        body.push_str(&format!("{}. {}\n", i + 1, opt.label));
    }
    let result = rfd::MessageDialog::new()
        .set_title(title)
        .set_description(&body)
        .set_buttons(rfd::MessageButtons::OkCancel)
        .show();
    if result == rfd::MessageDialogResult::Ok {
        Ok(default_id.to_string())
    } else {
        Err(DialogError::Cancelled)
    }
}

pub async fn choice_dialog(
    state: &Arc<AppState>,
    title: &str,
    text: &str,
    options: &[ChoiceOption],
    default_id: &str,
) -> DialogResult<String> {
    let title = title.to_string();
    let text = text.to_string();
    let options = options.to_vec();
    let default_id = default_id.to_string();
    run_on_main(state, move || choice_dialog_sync(&title, &text, &options, &default_id))
        .await
        .map_err(|detail| DialogError::Unavailable { detail })?
}

fn harness_selection_from_e2e(options: &[ChoiceOption]) -> Option<DialogResult<Vec<String>>> {
    if e2e_skill_cancelled() {
        return Some(Err(DialogError::Cancelled));
    }
    if e2e_enabled() && e2e_pause_ms() == 0 {
        if let Ok(raw) = std::env::var("EXCALIDRAW_E2E_SKILL_HARNESS") {
            if raw == "cancel" {
                return Some(Err(DialogError::Cancelled));
            }
            let ids: Vec<String> = if raw == "all" {
                options.iter().map(|o| o.id.clone()).collect()
            } else {
                raw.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            };
            if !ids.is_empty() {
                return Some(Ok(ids));
            }
        }
    }
    if e2e_pause_ms() > 0 {
        e2e_sleep_pause();
        if let Ok(raw) = std::env::var("EXCALIDRAW_E2E_SKILL_HARNESS") {
            if raw == "cancel" {
                return Some(Err(DialogError::Cancelled));
            }
            let ids: Vec<String> = if raw == "all" {
                options.iter().map(|o| o.id.clone()).collect()
            } else {
                raw.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            };
            if !ids.is_empty() {
                return Some(Ok(ids));
            }
        }
    }
    None
}

pub async fn multi_select_checklist_dialog(
    state: &Arc<AppState>,
    title: &str,
    text: &str,
    options: &[ChoiceOption],
    default_checked_ids: &[&str],
) -> DialogResult<Vec<String>> {
    if options.is_empty() {
        return Err(DialogError::Unavailable {
            detail: "no options".into(),
        });
    }
    if let Some(result) = harness_selection_from_e2e(options) {
        return result;
    }

    let title = title.to_string();
    let text = text.to_string();
    let options = options.to_vec();
    let defaults: Vec<String> = default_checked_ids.iter().map(|s| s.to_string()).collect();
    let default_refs: Vec<String> = defaults;

    win32_async::run_dialog(state, move |tx| {
        let default_id_refs: Vec<&str> = default_refs.iter().map(|s| s.as_str()).collect();
        win32_harness_checklist::show_harness_checklist(
            &title,
            &text,
            &options,
            &default_id_refs,
            tx,
        );
    })
    .await
    .map_err(|detail| DialogError::Unavailable { detail })?
}

fn open_directory_dialog_sync(title: &str, start: &std::path::Path) -> DialogResult<String> {
    if e2e_skill_cancelled() {
        return Err(DialogError::Cancelled);
    }
    if e2e_enabled() {
        if let Ok(p) = std::env::var("EXCALIDRAW_E2E_SKILL_PROJECT") {
            if !p.trim().is_empty() {
                return Ok(p);
            }
        }
    }
    if e2e_pause_ms() > 0 {
        e2e_sleep_pause();
        if let Ok(p) = std::env::var("EXCALIDRAW_E2E_SKILL_PROJECT") {
            if !p.trim().is_empty() {
                return Ok(p);
            }
        }
    }

    let mut dialog = rfd::FileDialog::new().set_title(title);
    if start.is_dir() {
        dialog = dialog.set_directory(start);
    }
    match dialog.pick_folder() {
        Some(p) => Ok(p.to_string_lossy().into_owned()),
        None => Err(DialogError::Cancelled),
    }
}

pub async fn open_directory_dialog(
    state: &Arc<AppState>,
    title: &str,
    start: &std::path::Path,
) -> DialogResult<String> {
    let title = title.to_string();
    let start = start.to_path_buf();
    run_on_main(state, move || open_directory_dialog_sync(&title, &start))
        .await
        .map_err(|detail| DialogError::Unavailable { detail })?
}
