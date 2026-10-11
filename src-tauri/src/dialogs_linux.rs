#[cfg(target_os = "linux")]
use crate::dialogs::{DialogResult, map_unsaved_choice};
#[cfg(target_os = "linux")]
use crate::dialogs_main::{assert_gtk_main_thread, is_gtk_main_thread};
#[cfg(target_os = "linux")]
use gtk::prelude::*;
#[cfg(target_os = "linux")]
use gtk::{ButtonsType, DialogFlags, MessageDialog, MessageType, ResponseType};
#[cfg(target_os = "linux")]
use std::sync::Once;

#[cfg(target_os = "linux")]
static GTK_INIT: Once = Once::new();

#[cfg(target_os = "linux")]
fn ensure_gtk_initialized() -> Result<(), DialogResult> {
    assert_gtk_main_thread("linux_unsaved_changes_dialog");
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
pub fn linux_unsaved_changes_dialog(
    title: &str,
    text: &str,
) -> Result<String, DialogResult> {
    ensure_gtk_initialized()?;
    debug_assert!(is_gtk_main_thread());

    let dialog = MessageDialog::new(
        None::<&gtk::Window>,
        DialogFlags::MODAL,
        MessageType::Question,
        ButtonsType::None,
        text,
    );
    dialog.set_title(title);
    dialog.add_button("Save", ResponseType::Accept);
    dialog.add_button("Cancel", ResponseType::Cancel);
    dialog.add_button("Discard", ResponseType::Reject);

    let response = dialog.run();
    dialog.close();

    let choice = match response {
        ResponseType::Accept => "save",
        ResponseType::Reject => "discard",
        _ => "cancel",
    };
    map_unsaved_choice(choice)
}
