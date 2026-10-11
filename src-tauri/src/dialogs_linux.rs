#[cfg(target_os = "linux")]
use crate::dialogs::{DialogResult, map_unsaved_choice};
#[cfg(target_os = "linux")]
use gtk::prelude::*;
#[cfg(target_os = "linux")]
use gtk::{ButtonsType, DialogFlags, MessageDialog, MessageType, ResponseType};

#[cfg(target_os = "linux")]
pub fn linux_unsaved_changes_dialog(
    title: &str,
    text: &str,
) -> Result<String, DialogResult> {
    gtk::init().map_err(|e| DialogResult::Unavailable {
        detail: format!("gtk init failed: {e}"),
    })?;

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
