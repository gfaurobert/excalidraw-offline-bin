//! Native GTK3 dialogs for Info menu and skill installer (Linux only).

use crate::dialogs_main::{assert_gtk_main_thread, is_gtk_main_thread};
use crate::e2e::e2e_enabled;
use gtk::prelude::*;
use gtk::{
    Align, Box as GtkBox, ButtonsType, CheckButton, Dialog, DialogFlags, MessageDialog,
    MessageType, Orientation, ResponseType, ScrolledWindow,
};
use std::process::Command;
use std::sync::Once;
use std::thread;
use std::time::Duration;

static GTK_INIT: Once = Once::new();

#[derive(Debug)]
pub enum DialogError {
    Cancelled,
    Unavailable { detail: String },
}

pub type DialogResult<T> = Result<T, DialogError>;

pub struct ChoiceOption {
    pub id: String,
    pub label: String,
}

fn ensure_gtk() -> Result<(), DialogError> {
    assert_gtk_main_thread("gtk_dialogs");
    let mut init_err: Option<String> = None;
    GTK_INIT.call_once(|| {
        if let Err(e) = gtk::init() {
            init_err = Some(format!("gtk init failed: {e}"));
        }
    });
    if let Some(detail) = init_err {
        return Err(DialogError::Unavailable { detail });
    }
    debug_assert!(is_gtk_main_thread());
    Ok(())
}

fn e2e_pause_ms() -> u64 {
    if !e2e_enabled() {
        return 0;
    }
    std::env::var("EXCALIDRAW_E2E_DIALOG_PAUSE_MS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0)
}

fn e2e_skill_cancelled() -> bool {
    e2e_enabled()
        && std::env::var("EXCALIDRAW_E2E_SKILL_CANCEL")
            .map(|v| v == "1")
            .unwrap_or(false)
}

pub fn open_url_in_browser(url: &str) {
    let _ = Command::new("xdg-open").arg(url).spawn();
}

pub fn info_dialog(title: &str, text: &str, link_url: Option<&str>) -> DialogResult<()> {
    if e2e_skill_cancelled() {
        return Err(DialogError::Cancelled);
    }
    ensure_gtk()?;
    let pause = e2e_pause_ms();
    if e2e_enabled()
        && pause == 0
        && std::env::var("EXCALIDRAW_E2E_INFO_AUTOOK")
            .map(|v| v == "1")
            .unwrap_or(false)
    {
        return Ok(());
    }

    let dialog = MessageDialog::new(
        None::<&gtk::Window>,
        DialogFlags::MODAL,
        MessageType::Info,
        ButtonsType::Ok,
        text,
    );
    dialog.set_title(title);
    if let Some(url) = link_url {
        dialog.add_button("Open in browser", ResponseType::Apply);
        let url = url.to_string();
        dialog.connect_response(move |d, r| {
            if r == ResponseType::Apply {
                open_url_in_browser(&url);
            }
            d.close();
        });
    }
    if pause > 0 {
        dialog.show_all();
        thread::sleep(Duration::from_millis(pause));
        dialog.response(ResponseType::Ok);
    } else {
        dialog.run();
        dialog.close();
    }
    Ok(())
}

pub fn confirm_dialog(title: &str, text: &str) -> DialogResult<bool> {
    if e2e_skill_cancelled() {
        return Err(DialogError::Cancelled);
    }
    ensure_gtk()?;
    if e2e_enabled() {
        if let Ok(v) = std::env::var("EXCALIDRAW_E2E_SKILL_OVERWRITE") {
            return Ok(v == "yes" || v == "1");
        }
    }
    let pause = e2e_pause_ms();
    let dialog = MessageDialog::new(
        None::<&gtk::Window>,
        DialogFlags::MODAL,
        MessageType::Question,
        ButtonsType::YesNo,
        text,
    );
    dialog.set_title(title);
    let response = if pause > 0 {
        dialog.show_all();
        thread::sleep(Duration::from_millis(pause));
        if e2e_enabled() {
            if std::env::var("EXCALIDRAW_E2E_SKILL_OVERWRITE")
                .map(|v| v == "yes" || v == "1")
                .unwrap_or(false)
            {
                ResponseType::Yes
            } else {
                ResponseType::No
            }
        } else {
            dialog.run()
        }
    } else {
        dialog.run()
    };
    dialog.close();
    match response {
        ResponseType::Yes => Ok(true),
        ResponseType::No => Ok(false),
        _ => Err(DialogError::Cancelled),
    }
}

pub fn choice_dialog(
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
    let pause = e2e_pause_ms();
    if e2e_enabled() && pause == 0 {
        if let Ok(mode) = std::env::var("EXCALIDRAW_E2E_SKILL_MODE") {
            if mode == "cancel" {
                return Err(DialogError::Cancelled);
            }
            if options.iter().any(|o| o.id == mode) {
                return Ok(mode);
            }
        }
    }

    ensure_gtk()?;
    let dialog = Dialog::new();
    dialog.set_title(title);
    dialog.set_modal(true);
    dialog.add_button("Cancel", ResponseType::Cancel);
    dialog.add_button("OK", ResponseType::Accept);
    let vbox = GtkBox::new(Orientation::Vertical, 8);
    vbox.set_margin_start(12);
    vbox.set_margin_end(12);
    vbox.set_margin_top(8);
    vbox.set_margin_bottom(8);
    vbox.pack_start(&gtk::Label::new(Some(text)), false, false, 0);

    let mut first: Option<gtk::RadioButton> = None;
    let mut id_for_button: Vec<(gtk::RadioButton, String)> = Vec::new();
    for opt in options {
        let rb = if let Some(ref f) = first {
            gtk::RadioButton::with_label_from_widget(f, &opt.label)
        } else {
            let b = gtk::RadioButton::with_label(&opt.label);
            first = Some(b.clone());
            b
        };
        if opt.id == default_id {
            rb.set_active(true);
        }
        id_for_button.push((rb.clone(), opt.id.clone()));
        vbox.pack_start(&rb, false, false, 0);
    }
    dialog.content_area().pack_start(&vbox, true, true, 0);
    dialog.show_all();

    let response = if pause > 0 {
        thread::sleep(Duration::from_millis(pause));
        if let Ok(mode) = std::env::var("EXCALIDRAW_E2E_SKILL_MODE") {
            for (rb, id) in &id_for_button {
                if id == &mode {
                    rb.set_active(true);
                    break;
                }
            }
        }
        dialog.response(ResponseType::Accept);
        ResponseType::Accept
    } else {
        dialog.run()
    };
    dialog.close();

    if response != ResponseType::Accept {
        return Err(DialogError::Cancelled);
    }
    for (rb, id) in id_for_button {
        if rb.is_active() {
            return Ok(id);
        }
    }
    Err(DialogError::Cancelled)
}

pub fn multi_select_checklist_dialog(
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
    if e2e_skill_cancelled() {
        return Err(DialogError::Cancelled);
    }
    let pause = e2e_pause_ms();
    if e2e_enabled() && pause == 0 {
        if let Ok(raw) = std::env::var("EXCALIDRAW_E2E_SKILL_HARNESS") {
            if raw == "cancel" {
                return Err(DialogError::Cancelled);
            }
            let ids: Vec<String> = raw
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            if !ids.is_empty() {
                return Ok(ids);
            }
        }
    }

    ensure_gtk()?;
    let dialog = Dialog::new();
    dialog.set_title(title);
    dialog.set_modal(true);
    dialog.add_button("Cancel", ResponseType::Cancel);
    dialog.add_button("OK", ResponseType::Accept);
    dialog.set_default_size(920, 500);

    let outer = GtkBox::new(Orientation::Vertical, 8);
    outer.set_margin_start(12);
    outer.set_margin_end(12);
    outer.set_margin_top(8);
    outer.set_margin_bottom(8);
    outer.pack_start(&gtk::Label::new(Some(text)), false, false, 0);

    let scroll = ScrolledWindow::new(None::<&gtk::Adjustment>, None::<&gtk::Adjustment>);
    let list = GtkBox::new(Orientation::Vertical, 4);
    let checked: std::collections::HashSet<String> =
        default_checked_ids.iter().map(|s| s.to_string()).collect();

    let mut checkboxes: Vec<(CheckButton, String)> = Vec::new();
    for opt in options {
        let cb = CheckButton::with_label(&opt.label);
        cb.set_active(checked.contains(&opt.id));
        cb.set_halign(Align::Start);
        checkboxes.push((cb.clone(), opt.id.clone()));
        list.pack_start(&cb, false, false, 0);
    }
    scroll.add(&list);
    outer.pack_start(&scroll, true, true, 0);
    dialog.content_area().pack_start(&outer, true, true, 0);
    dialog.show_all();

    let response = if pause > 0 {
        thread::sleep(Duration::from_millis(pause));
        if let Ok(raw) = std::env::var("EXCALIDRAW_E2E_SKILL_HARNESS") {
            let want: std::collections::HashSet<String> = if raw == "all" {
                ["agents", "claude", "kiro", "cline", "all"]
                    .into_iter()
                    .map(String::from)
                    .collect()
            } else {
                raw.split(',').map(|s| s.trim().to_string()).collect()
            };
            for (cb, id) in &checkboxes {
                cb.set_active(want.contains(id) || (want.contains("all") && id == "all"));
            }
        }
        dialog.response(ResponseType::Accept);
        ResponseType::Accept
    } else {
        dialog.run()
    };
    dialog.close();

    if response != ResponseType::Accept {
        return Err(DialogError::Cancelled);
    }
    let mut ids = Vec::new();
    for (cb, id) in checkboxes {
        if cb.is_active() {
            ids.push(id);
        }
    }
    if ids.is_empty() {
        return Err(DialogError::Cancelled);
    }
    Ok(ids)
}

pub fn open_directory_dialog(title: &str, start: &std::path::Path) -> DialogResult<String> {
    if e2e_skill_cancelled() {
        return Err(DialogError::Cancelled);
    }
    if e2e_enabled() {
        if let Ok(p) = std::env::var("EXCALIDRAW_E2E_SKILL_PROJECT") {
            if !p.trim().is_empty() {
                return Ok(p);
            }
        }
        if e2e_pause_ms() == 0
            && std::env::var("EXCALIDRAW_E2E_SKILL_MODE").ok().as_deref() != Some("project")
        {
            // global path: no folder pick
        }
    }
    let pause = e2e_pause_ms();
    if pause > 0 && e2e_enabled() {
        if let Ok(p) = std::env::var("EXCALIDRAW_E2E_SKILL_PROJECT") {
            thread::sleep(Duration::from_millis(pause));
            return Ok(p);
        }
    }

    use rfd::FileDialog;
    let mut dialog = FileDialog::new().set_title(title);
    if start.is_dir() {
        dialog = dialog.set_directory(start);
    }
    match dialog.pick_folder() {
        Some(p) => Ok(p.to_string_lossy().into_owned()),
        None => Err(DialogError::Cancelled),
    }
}
