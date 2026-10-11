//! Native GTK3 dialogs for Info menu and skill installer (Linux only).

use crate::app_state::AppState;
use crate::gtk_async;
use rfd::AsyncFileDialog;
use std::sync::{Arc, Mutex};
use crate::skill_dialog_common::{
    e2e_pause_ms, e2e_skill_cancelled, e2e_sleep_pause, open_url_in_browser, ChoiceOption,
    DialogError, DialogResult,
};
use gtk::prelude::*;
use gtk::{
    Align, Box as GtkBox, ButtonsType, CheckButton, Dialog, DialogFlags, MessageDialog,
    MessageType, Orientation, ResponseType, ScrolledWindow,
};
use std::sync::Once;
use std::thread;
use std::time::Duration;

static GTK_INIT: Once = Once::new();

fn ensure_gtk() -> Result<(), DialogError> {
    let mut init_err: Option<String> = None;
    GTK_INIT.call_once(|| {
        if let Err(e) = gtk::init() {
            init_err = Some(format!("gtk init failed: {e}"));
        }
    });
    if let Some(detail) = init_err {
        return Err(DialogError::Unavailable { detail });
    }
    Ok(())
}

fn active_radio_label(dialog: &Dialog) -> Option<String> {
    let area = dialog.content_area();
    for child in area.children() {
        if let Ok(box_) = child.downcast::<GtkBox>() {
            for row in box_.children() {
                if let Ok(rb) = row.downcast::<gtk::RadioButton>() {
                    if rb.is_active() {
                        return rb.label().map(|s| s.to_string());
                    }
                }
            }
        }
    }
    None
}

fn active_checklist_ids(dialog: &Dialog, options: &[ChoiceOption]) -> Vec<String> {
    let mut ids = Vec::new();
    let area = dialog.content_area();
    for child in area.children() {
        if let Ok(outer) = child.downcast::<GtkBox>() {
            for outer_child in outer.children() {
                if let Ok(scroll) = outer_child.downcast::<ScrolledWindow>() {
                    if let Some(list) = scroll.child() {
                        if let Ok(list_box) = list.downcast::<GtkBox>() {
                            for row in list_box.children() {
                                if let Ok(cb) = row.downcast::<CheckButton>() {
                                    if cb.is_active() {
                                        if let Some(label) = cb.label() {
                                            if let Some(opt) =
                                                options.iter().find(|o| o.label == label.as_str())
                                            {
                                                ids.push(opt.id.clone());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    ids
}

fn wire_dialog_response<D, R>(
    dialog: &D,
    tx: tokio::sync::oneshot::Sender<R>,
    map: impl Fn(ResponseType, &Dialog) -> R + Send + Sync + 'static,
) where
    D: IsA<Dialog> + Clone + 'static,
    R: Send + 'static,
{
    let tx = Mutex::new(Some(tx));
    let map = Arc::new(map);
    let dialog = dialog.clone();
    dialog.connect_response(move |d, resp| {
        if let Ok(mut guard) = tx.lock() {
            if let Some(sender) = guard.take() {
                let value = map(resp, d.as_ref());
                let _ = sender.send(value);
            }
        }
    });
}

use crate::e2e::e2e_enabled;

pub async fn info_dialog(
    state: &Arc<AppState>,
    title: &str,
    text: &str,
    link_url: Option<&str>,
) -> DialogResult<()> {
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

    let title = title.to_string();
    let text = text.to_string();
    let link = link_url.map(|s| s.to_string());
    if pause > 0 {
        let dialog = MessageDialog::new(
            None::<&gtk::Window>,
            DialogFlags::MODAL,
            MessageType::Info,
            ButtonsType::Ok,
            &text,
        );
        dialog.set_title(&title);
        dialog.show_all();
        e2e_sleep_pause();
        dialog.response(ResponseType::Ok);
        dialog.close();
    } else {
        let _ = gtk_async::wait_dialog_response(state, move |tx| {
            let dialog = MessageDialog::new(
                None::<&gtk::Window>,
                DialogFlags::MODAL,
                MessageType::Info,
                ButtonsType::Ok,
                &text,
            );
            dialog.set_title(&title);
            if let Some(url) = link {
                dialog.add_button("Open in browser", ResponseType::Apply);
                let url = url.clone();
                wire_dialog_response(&dialog, tx, move |r, _| {
                    if r == ResponseType::Apply {
                        open_url_in_browser(&url);
                    }
                    r
                });
            } else {
                wire_dialog_response(&dialog, tx, |r, _| r);
            }
            dialog.show_all();
        })
        .await;
    }
    Ok(())
}

pub async fn confirm_dialog(
    state: &Arc<AppState>,
    title: &str,
    text: &str,
) -> DialogResult<bool> {
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
    let title = title.to_string();
    let text = text.to_string();
    let response = if pause > 0 {
        let dialog = MessageDialog::new(
            None::<&gtk::Window>,
            DialogFlags::MODAL,
            MessageType::Question,
            ButtonsType::YesNo,
            &text,
        );
        dialog.set_title(&title);
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
            ResponseType::No
        }
    } else {
        gtk_async::wait_dialog_response(state, move |tx| {
            let dialog = MessageDialog::new(
                None::<&gtk::Window>,
                DialogFlags::MODAL,
                MessageType::Question,
                ButtonsType::YesNo,
                &text,
            );
            dialog.set_title(&title);
            wire_dialog_response(&dialog, tx, |r, _| r);
            dialog.show_all();
        })
        .await
        .unwrap_or(ResponseType::Cancel)
    };
    match response {
        ResponseType::Yes => Ok(true),
        ResponseType::No => Ok(false),
        _ => Err(DialogError::Cancelled),
    }
}

pub async fn choice_dialog(
    state: &Arc<AppState>,
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
    if pause > 0 {
        if let Ok(mode) = std::env::var("EXCALIDRAW_E2E_SKILL_MODE") {
            if options.iter().any(|o| o.id == mode) {
                return Ok(mode);
            }
        }
        return options
            .iter()
            .find(|o| o.id == default_id)
            .map(|o| o.id.clone())
            .ok_or(DialogError::Cancelled);
    }

    let title = title.to_string();
    let text = text.to_string();
    let options: Vec<ChoiceOption> = options.to_vec();
    let default_id = default_id.to_string();

    let options_for_map = options.clone();
    let picked = gtk_async::run_dialog(state, move |tx| {
        let dialog = Dialog::new();
        dialog.set_title(&title);
        dialog.set_modal(true);
        dialog.add_button("Cancel", ResponseType::Cancel);
        dialog.add_button("OK", ResponseType::Accept);
        let vbox = GtkBox::new(Orientation::Vertical, 8);
        vbox.set_margin_start(12);
        vbox.set_margin_end(12);
        vbox.set_margin_top(8);
        vbox.set_margin_bottom(8);
        vbox.pack_start(&gtk::Label::new(Some(&text)), false, false, 0);
        let mut first: Option<gtk::RadioButton> = None;
        for opt in &options {
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
            vbox.pack_start(&rb, false, false, 0);
        }
        dialog.content_area().pack_start(&vbox, true, true, 0);
        let options_for_map = options_for_map.clone();
        wire_dialog_response(&dialog, tx, move |r, d| {
            if r != ResponseType::Accept {
                return None;
            }
            active_radio_label(d).and_then(|label| {
                options_for_map
                    .iter()
                    .find(|o| o.label == label)
                    .map(|o| o.id.clone())
            })
        });
        dialog.show_all();
    })
    .await;

    match picked {
        Ok(Some(id)) => Ok(id),
        _ => Err(DialogError::Cancelled),
    }
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
    let title = title.to_string();
    let text = text.to_string();
    let options = options.to_vec();
    let checked: std::collections::HashSet<String> =
        default_checked_ids.iter().map(|s| s.to_string()).collect();

    if pause > 0 {
        if let Ok(raw) = std::env::var("EXCALIDRAW_E2E_SKILL_HARNESS") {
            if raw == "cancel" {
                return Err(DialogError::Cancelled);
            }
            let ids: Vec<String> = if raw == "all" {
                options.iter().map(|o| o.id.clone()).collect()
            } else {
                raw.split(',').map(|s| s.trim().to_string()).collect()
            };
            if !ids.is_empty() {
                return Ok(ids);
            }
        }
    }

    let options_for_map = options.clone();
    let picked = gtk_async::run_dialog(state, move |tx| {
        let dialog = Dialog::new();
        dialog.set_title(&title);
        dialog.set_modal(true);
        dialog.add_button("Cancel", ResponseType::Cancel);
        dialog.add_button("OK", ResponseType::Accept);
        dialog.set_default_size(920, 500);
        let outer = GtkBox::new(Orientation::Vertical, 8);
        outer.set_margin_start(12);
        outer.set_margin_end(12);
        outer.set_margin_top(8);
        outer.set_margin_bottom(8);
        outer.pack_start(&gtk::Label::new(Some(&text)), false, false, 0);
        let scroll = ScrolledWindow::new(None::<&gtk::Adjustment>, None::<&gtk::Adjustment>);
        let list = GtkBox::new(Orientation::Vertical, 4);
        for opt in &options {
            let cb = CheckButton::with_label(&opt.label);
            cb.set_active(checked.contains(&opt.id));
            cb.set_halign(Align::Start);
            list.pack_start(&cb, false, false, 0);
        }
        scroll.add(&list);
        outer.pack_start(&scroll, true, true, 0);
        dialog.content_area().pack_start(&outer, true, true, 0);
        let options_for_map = options_for_map.clone();
        wire_dialog_response(&dialog, tx, move |r, d| {
            if r != ResponseType::Accept {
                return None;
            }
            let ids = active_checklist_ids(d, &options_for_map);
            if ids.is_empty() { None } else { Some(ids) }
        });
        dialog.show_all();
    })
    .await;

    let ids = picked.ok().flatten().ok_or(DialogError::Cancelled)?;
    if ids.is_empty() {
        return Err(DialogError::Cancelled);
    }
    Ok(ids)
}

pub async fn open_directory_dialog(
    _state: &Arc<AppState>,
    title: &str,
    start: &std::path::Path,
) -> DialogResult<String> {
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

    let mut dialog = AsyncFileDialog::new().set_title(title);
    if start.is_dir() {
        dialog = dialog.set_directory(start);
    }
    match dialog.pick_folder().await {
        Some(h) => Ok(h.path().to_string_lossy().into_owned()),
        None => Err(DialogError::Cancelled),
    }
}
