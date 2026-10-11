//! Modeless Win32 harness checklist (BS_AUTOCHECKBOX + OK/Cancel) on the UI thread.

use crate::skill_dialog_common::{ChoiceOption, DialogError, DialogResult};
use std::cell::RefCell;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Graphics::Gdi::{GetStockObject, DEFAULT_GUI_FONT};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Controls::{IsDlgButtonChecked, BST_CHECKED};
use windows::Win32::UI::HiDpi::{
    SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, LoadCursorW, RegisterClassW,
    SendMessageW, SetForegroundWindow, SetWindowPos, ShowWindow, CS_HREDRAW, CS_VREDRAW,
    CW_USEDEFAULT, HMENU, IDC_ARROW, IDCANCEL, IDOK, SW_SHOW, WINDOW_EX_STYLE, WINDOW_STYLE,
    WM_COMMAND, WM_CREATE, WM_SETFONT, WS_CAPTION, WS_CHILD, WS_OVERLAPPED, WS_SYSMENU,
    WS_TABSTOP, WS_VISIBLE, BS_AUTOCHECKBOX, BS_DEFPUSHBUTTON, BS_PUSHBUTTON, HWND_TOP,
    SWP_NOMOVE, SWP_NOZORDER, WNDCLASSW,
};

const CLASS_NAME: &str = "ExcalidrawHarnessChecklist";
const ID_CAPTION: i32 = 100;
const ID_CHECK_BASE: i32 = 200;
const IDOK_LOCAL: i32 = 1;
const IDCANCEL_LOCAL: i32 = 2;

thread_local! {
    static DIALOG_CTX: RefCell<Option<DialogCtx>> = RefCell::new(None);
}

struct DialogCtx {
    caption: String,
    options: Vec<ChoiceOption>,
    default_checked: HashSet<String>,
    tx: Option<tokio::sync::oneshot::Sender<DialogResult<Vec<String>>>>,
}

static CLASS_REGISTERED: AtomicBool = AtomicBool::new(false);
static DPI_AWARE: AtomicBool = AtomicBool::new(false);

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn ensure_dpi_aware() {
    if DPI_AWARE.swap(true, Ordering::Relaxed) {
        return;
    }
    unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
}

fn scale(dpi: u32, px: i32) -> i32 {
    ((px as f64) * (dpi as f64 / 96.0)).round() as i32
}

fn system_dpi() -> u32 {
    unsafe {
        use windows::Win32::UI::HiDpi::GetDpiForSystem;
        let dpi = GetDpiForSystem();
        if dpi == 0 { 96 } else { dpi }
    }
}

fn ensure_window_class() -> windows::core::Result<()> {
    if CLASS_REGISTERED.load(Ordering::Acquire) {
        return Ok(());
    }
    unsafe {
        let instance = GetModuleHandleW(None)?;
        let wc = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(wnd_proc),
            hInstance: instance.into(),
            hCursor: LoadCursorW(None, IDC_ARROW)?,
            lpszClassName: PCWSTR(wide(CLASS_NAME).as_ptr()),
            ..Default::default()
        };
        if RegisterClassW(&wc) == 0 {
            // Already registered by a prior call in-process.
        }
    }
    CLASS_REGISTERED.store(true, Ordering::Release);
    Ok(())
}

unsafe fn apply_gui_font(hwnd: HWND) {
    let font = GetStockObject(DEFAULT_GUI_FONT);
    let _ = SendMessageW(hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(1));
}

unsafe fn create_control(
    class: &str,
    text: &str,
    style: WINDOW_STYLE,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    parent: HWND,
    id: i32,
) -> HWND {
    let hwnd = CreateWindowExW(
        WINDOW_EX_STYLE(0),
        PCWSTR(wide(class).as_ptr()),
        PCWSTR(wide(text).as_ptr()),
        style,
        x,
        y,
        w,
        h,
        parent,
        HMENU(id as isize),
        GetModuleHandleW(None).expect("module"),
        None,
    )
    .expect("CreateWindowExW control");
    apply_gui_font(hwnd);
    hwnd
}

unsafe fn finish_dialog(hwnd: HWND, result: DialogResult<Vec<String>>) {
    if let Some(ctx) = DIALOG_CTX.with(|c| c.borrow_mut().take()) {
        if let Some(tx) = ctx.tx {
            let _ = tx.send(result);
        }
    }
    if hwnd.0 != 0 {
        let _ = DestroyWindow(hwnd);
    }
}

unsafe fn collect_checked_ids(hwnd: HWND, options: &[ChoiceOption]) -> DialogResult<Vec<String>> {
    let mut ids = Vec::new();
    for (i, opt) in options.iter().enumerate() {
        let id = ID_CHECK_BASE + i as i32;
        if IsDlgButtonChecked(hwnd, id) == BST_CHECKED {
            ids.push(opt.id.clone());
        }
    }
    if ids.is_empty() {
        Err(DialogError::Cancelled)
    } else {
        Ok(ids)
    }
}

unsafe extern "system" fn wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_CREATE => {
            let Some(params) = DIALOG_CTX.with(|c| {
                c.borrow().as_ref().map(|ctx| CreateParams {
                    caption: ctx.caption.clone(),
                    options: ctx.options.clone(),
                    default_checked: ctx.default_checked.clone(),
                })
            }) else {
                return LRESULT(-1);
            };
            let dpi = system_dpi();
            let margin = scale(dpi, 12);
            let width = scale(dpi, 640);
            let line = scale(dpi, 22);
            let caption_h = scale(dpi, 56);
            let btn_h = scale(dpi, 28);
            let btn_w = scale(dpi, 88);

            let _ = create_control(
                "STATIC",
                &params.caption,
                WS_CHILD | WS_VISIBLE,
                margin,
                margin,
                width - margin * 2,
                caption_h,
                hwnd,
                ID_CAPTION,
            );

            let mut y = margin + caption_h + scale(dpi, 8);
            for (i, opt) in params.options.iter().enumerate() {
                let id = ID_CHECK_BASE + i as i32;
                let cb = create_control(
                    "BUTTON",
                    &opt.label,
                    WS_CHILD | WS_VISIBLE | WS_TABSTOP | WINDOW_STYLE(BS_AUTOCHECKBOX.0),
                    margin,
                    y,
                    width - margin * 2,
                    line,
                    hwnd,
                    id,
                );
                if params.default_checked.contains(&opt.id) {
                    use windows::Win32::UI::WindowsAndMessaging::BM_SETCHECK;
                    let _ = SendMessageW(
                        cb,
                        BM_SETCHECK,
                        WPARAM(BST_CHECKED.0 as usize),
                        LPARAM(0),
                    );
                }
                y += line + scale(dpi, 4);
            }

            let ok_y = y + scale(dpi, 12);
            create_control(
                "BUTTON",
                "OK",
                WS_CHILD | WS_VISIBLE | WS_TABSTOP | WINDOW_STYLE(BS_DEFPUSHBUTTON.0),
                width - margin - btn_w * 2 - scale(dpi, 8),
                ok_y,
                btn_w,
                btn_h,
                hwnd,
                IDOK_LOCAL,
            );
            create_control(
                "BUTTON",
                "Cancel",
                WS_CHILD | WS_VISIBLE | WS_TABSTOP | WINDOW_STYLE(BS_PUSHBUTTON.0),
                width - margin - btn_w,
                ok_y,
                btn_w,
                btn_h,
                hwnd,
                IDCANCEL_LOCAL,
            );

            let total_h = ok_y + btn_h + margin;
            let _ = SetWindowPos(
                hwnd,
                HWND_TOP,
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                width,
                total_h,
                SWP_NOMOVE | SWP_NOZORDER,
            );
            apply_gui_font(hwnd);
            LRESULT(0)
        }
        WM_COMMAND => {
            let id = (wparam.0 & 0xffff) as i32;
            if id == IDOK_LOCAL || id == IDOK {
                let result = DIALOG_CTX.with(|c| {
                    c.borrow()
                        .as_ref()
                        .map(|ctx| collect_checked_ids(hwnd, &ctx.options))
                        .unwrap_or(Err(DialogError::Cancelled))
                });
                finish_dialog(hwnd, result);
                return LRESULT(0);
            }
            if id == IDCANCEL_LOCAL || id == IDCANCEL {
                finish_dialog(hwnd, Err(DialogError::Cancelled));
                return LRESULT(0);
            }
            LRESULT(0)
        }
        windows::Win32::UI::WindowsAndMessaging::WM_CLOSE => {
            finish_dialog(hwnd, Err(DialogError::Cancelled));
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

struct CreateParams {
    caption: String,
    options: Vec<ChoiceOption>,
    default_checked: HashSet<String>,
}

/// Show a modeless checklist; completes `tx` when the user dismisses the window.
fn fail_tx(
    tx: tokio::sync::oneshot::Sender<DialogResult<Vec<String>>>,
    err: DialogError,
) {
    let _ = tx.send(Err(err));
}

pub fn show_harness_checklist(
    title: &str,
    caption: &str,
    options: &[ChoiceOption],
    default_checked_ids: &[&str],
    tx: tokio::sync::oneshot::Sender<DialogResult<Vec<String>>>,
) {
    ensure_dpi_aware();
    if let Err(e) = ensure_window_class() {
        fail_tx(
            tx,
            DialogError::Unavailable {
                detail: format!("Win32 window class: {e}"),
            },
        );
        return;
    }

    let default_checked: HashSet<String> =
        default_checked_ids.iter().map(|s| (*s).to_string()).collect();

    DIALOG_CTX.with(|c| {
        *c.borrow_mut() = Some(DialogCtx {
            caption: caption.to_string(),
            options: options.to_vec(),
            default_checked,
            tx: Some(tx),
        });
    });

    let dpi = system_dpi();
    let margin = scale(dpi, 12);
    let width = scale(dpi, 640);
    let line = scale(dpi, 22);
    let caption_h = scale(dpi, 56);
    let btn_h = scale(dpi, 28);
    let option_count = options.len().max(1);
    let height = margin
        + caption_h
        + scale(dpi, 8)
        + (line + scale(dpi, 4)) * option_count as i32
        + scale(dpi, 12)
        + btn_h
        + margin;

    unsafe {
        let module = match GetModuleHandleW(None) {
            Ok(m) => m,
            Err(e) => {
                finish_dialog(
                    HWND::default(),
                    Err(DialogError::Unavailable {
                        detail: format!("GetModuleHandleW: {e}"),
                    }),
                );
                return;
            }
        };
        let hwnd = match CreateWindowExW(
            WINDOW_EX_STYLE(0),
            PCWSTR(wide(CLASS_NAME).as_ptr()),
            PCWSTR(wide(title).as_ptr()),
            WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            width,
            height,
            HWND::default(),
            HMENU::default(),
            module,
            None,
        ) {
            Ok(h) => h,
            Err(e) => {
                finish_dialog(
                    HWND::default(),
                    Err(DialogError::Unavailable {
                        detail: format!("CreateWindowExW: {e}"),
                    }),
                );
                return;
            }
        };

        apply_gui_font(hwnd);
        let _ = ShowWindow(hwnd, SW_SHOW);
        let _ = SetForegroundWindow(hwnd);
    }
}
