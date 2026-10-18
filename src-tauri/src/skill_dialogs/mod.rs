pub use crate::skill_dialog_common::{ChoiceOption, DialogError};

#[cfg(target_os = "linux")]
pub use crate::gtk_dialogs::{
    choice_dialog, confirm_dialog, info_dialog, multi_select_checklist_dialog,
    open_directory_dialog,
};

#[cfg(target_os = "windows")]
pub use crate::win_dialogs::{
    choice_dialog, confirm_dialog, info_dialog, multi_select_checklist_dialog,
    open_directory_dialog,
};

#[cfg(target_os = "macos")]
pub use crate::mac_dialogs::{
    choice_dialog, confirm_dialog, info_dialog, multi_select_checklist_dialog,
    open_directory_dialog,
};
