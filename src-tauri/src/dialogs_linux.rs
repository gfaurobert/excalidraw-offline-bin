#[cfg(target_os = "linux")]
use crate::app_state::AppState;
#[cfg(target_os = "linux")]
use crate::dialogs::{map_unsaved_choice, DialogResult};
#[cfg(target_os = "linux")]
use crate::gtk_async;
#[cfg(target_os = "linux")]
use gtk::prelude::*;
#[cfg(target_os = "linux")]
use gtk::{ButtonsType, DialogFlags, MessageDialog, MessageType, ResponseType};
#[cfg(target_os = "linux")]
use std::sync::{Arc, Once};

#[cfg(target_os = "linux")]
static GTK_INIT: Once = Once::new();

#[cfg(target_os = "linux")]
fn ensure_gtk_initialized() -> Result<(), DialogResult> {
    let mut init_err: Option<String> = None;
    GTK_INIT.call_once(|| {
        if let Err(e) = gtk::init() {
            init_err = Some(format!("gtk init failed: {e}"));
        }
    });
    if let Some(detail) = init_err {
        return Err(DialogResult::Unavailable { detail });
    }
    Ok(())
}

#[cfg(target_os = "linux")]
pub async fn linux_unsaved_changes_dialog(
    state: &Arc<AppState>,
    title: &str,
    text: &str,
) -> Result<String, DialogResult> {
    let _ = ensure_gtk_initialized();

    let title = title.to_string();
    let text = text.to_string();
    let response = gtk_async::wait_dialog_response(state, move |tx| {
        let dialog = MessageDialog::new(
            None::<&gtk::Window>,
            DialogFlags::MODAL,
            MessageType::Question,
            ButtonsType::None,
            &text,
        );
        dialog.set_title(&title);
        dialog.add_button("Save", ResponseType::Accept);
        dialog.add_button("Cancel", ResponseType::Cancel);
        dialog.add_button("Discard", ResponseType::Reject);
        let tx = std::sync::Mutex::new(Some(tx));
        dialog.connect_response(move |d, r| {
            if let Ok(mut guard) = tx.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(r);
                }
            }
            d.close();
        });
        dialog.show_all();
    })
    .await
    .map_err(|detail| DialogResult::Unavailable { detail })?;

    let choice = match response {
        ResponseType::Accept => "save",
        ResponseType::Reject => "discard",
        _ => "cancel",
    };
    map_unsaved_choice(choice)
}
