use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State};

const QUICK_CHAT_WIDTH: f64 = 720.0;
const QUICK_CHAT_HEIGHT: f64 = 150.0;
const QUICK_CHAT_EXPANDED_HEIGHT: f64 = 480.0;
const QUICK_CHAT_MARGIN: i32 = 24;

#[cfg(target_os = "windows")]
mod global_shortcut {
    use super::toggle_quick_chat;
    use std::{
        ffi::c_void,
        mem::zeroed,
        sync::mpsc::{self, Receiver, RecvTimeoutError, Sender},
        thread,
        time::Duration,
    };
    use tauri::AppHandle;

    const HOTKEY_ID: i32 = 1;
    const MOD_ALT: u32 = 0x0001;
    const MOD_CONTROL: u32 = 0x0002;
    const MOD_SHIFT: u32 = 0x0004;
    const MOD_NOREPEAT: u32 = 0x4000;
    const PM_REMOVE: u32 = 0x0001;
    const WM_HOTKEY: u32 = 0x0312;

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Point {
        x: i32,
        y: i32,
    }

    #[repr(C)]
    struct Message {
        hwnd: *mut c_void,
        message: u32,
        w_param: usize,
        l_param: isize,
        time: u32,
        point: Point,
        private: u32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn PeekMessageW(
            message: *mut Message,
            window: *mut c_void,
            min: u32,
            max: u32,
            remove: u32,
        ) -> i32;
        fn RegisterHotKey(window: *mut c_void, id: i32, modifiers: u32, key: u32) -> i32;
        fn UnregisterHotKey(window: *mut c_void, id: i32) -> i32;
    }

    enum ShortcutCommand {
        Set(String, Sender<Result<(), String>>),
    }

    pub struct ShortcutManager(Sender<ShortcutCommand>);

    impl ShortcutManager {
        pub fn new(app: AppHandle) -> Self {
            let (sender, receiver) = mpsc::channel();
            thread::spawn(move || run_loop(app, receiver));
            Self(sender)
        }

        pub fn set(&self, binding: String) -> Result<(), String> {
            let (reply_sender, reply_receiver) = mpsc::channel();
            self.0
                .send(ShortcutCommand::Set(binding, reply_sender))
                .map_err(|_| "The global shortcut worker stopped.".to_string())?;
            reply_receiver
                .recv()
                .map_err(|_| "The global shortcut worker did not respond.".to_string())?
        }
    }

    fn run_loop(app: AppHandle, receiver: Receiver<ShortcutCommand>) {
        let mut registered: Option<(u32, u32)> = None;
        loop {
            let mut message: Message = unsafe { zeroed() };
            while unsafe {
                PeekMessageW(
                    &mut message,
                    std::ptr::null_mut(),
                    WM_HOTKEY,
                    WM_HOTKEY,
                    PM_REMOVE,
                )
            } != 0
            {
                if message.w_param == HOTKEY_ID as usize {
                    toggle_quick_chat(&app);
                }
            }

            match receiver.recv_timeout(Duration::from_millis(25)) {
                Ok(ShortcutCommand::Set(binding, reply)) => {
                    let parsed = if binding.trim().is_empty() {
                        Ok(None)
                    } else {
                        parse_binding(&binding).map(Some)
                    };
                    let result = parsed.and_then(|next| {
                        // Remember the previous binding so we can roll back on failure.
                        let previous = registered.take();
                        if previous.is_some() {
                            unsafe { UnregisterHotKey(std::ptr::null_mut(), HOTKEY_ID) };
                        }
                        if let Some((modifiers, key)) = next {
                            if unsafe {
                                RegisterHotKey(
                                    std::ptr::null_mut(),
                                    HOTKEY_ID,
                                    modifiers | MOD_NOREPEAT,
                                    key,
                                )
                            } == 0
                            {
                                // Roll back to the previous binding when possible.
                                if let Some((old_modifiers, old_key)) = previous {
                                    if unsafe {
                                        RegisterHotKey(
                                            std::ptr::null_mut(),
                                            HOTKEY_ID,
                                            old_modifiers | MOD_NOREPEAT,
                                            old_key,
                                        )
                                    } != 0
                                    {
                                        registered = previous;
                                    }
                                }
                                return Err(
                                    "That shortcut is already used by Windows or another app."
                                        .to_string(),
                                );
                            }
                        }
                        registered = next;
                        Ok(())
                    });
                    let _ = reply.send(result);
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
        if registered.is_some() {
            unsafe { UnregisterHotKey(std::ptr::null_mut(), HOTKEY_ID) };
        }
    }

    fn parse_binding(binding: &str) -> Result<(u32, u32), String> {
        let mut modifiers = 0;
        let mut key = None;
        for part in binding
            .split('+')
            .map(str::trim)
            .filter(|part| !part.is_empty())
        {
            match part.to_ascii_lowercase().as_str() {
                "mod" | "ctrl" | "control" => modifiers |= MOD_CONTROL,
                "alt" => modifiers |= MOD_ALT,
                "shift" => modifiers |= MOD_SHIFT,
                token if key.is_none() => key = virtual_key(token),
                _ => return Err(format!("Unsupported global shortcut: {binding}")),
            }
        }
        if modifiers == 0 {
            return Err("Quick Chat needs Ctrl, Alt, or Shift in its shortcut.".to_string());
        }
        key.map(|key| (modifiers, key))
            .ok_or_else(|| format!("Unsupported global shortcut: {binding}"))
    }

    fn virtual_key(token: &str) -> Option<u32> {
        if token.len() == 1 {
            let byte = token.as_bytes()[0].to_ascii_uppercase();
            if byte.is_ascii_alphanumeric() {
                return Some(byte as u32);
            }
        }
        if let Some(number) = token
            .strip_prefix('f')
            .and_then(|value| value.parse::<u32>().ok())
        {
            if (1..=24).contains(&number) {
                return Some(0x70 + number - 1);
            }
        }
        match token {
            "space" => Some(0x20),
            "up" => Some(0x26),
            "down" => Some(0x28),
            "left" => Some(0x25),
            "right" => Some(0x27),
            "comma" | "," => Some(0xBC),
            "slash" | "/" => Some(0xBF),
            "[" => Some(0xDB),
            "]" => Some(0xDD),
            _ => None,
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn parses_configurable_shortcuts() {
            assert_eq!(
                parse_binding("Mod+Shift+Space"),
                Ok((MOD_CONTROL | MOD_SHIFT, 0x20))
            );
            assert_eq!(
                parse_binding("Ctrl+Alt+K"),
                Ok((MOD_CONTROL | MOD_ALT, b'K' as u32))
            );
            assert!(parse_binding("Space").is_err());
            assert!(parse_binding("Mod+NotAKey").is_err());
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod global_shortcut {
    use tauri::AppHandle;

    pub struct ShortcutManager;

    impl ShortcutManager {
        pub fn new(_: AppHandle) -> Self {
            Self
        }

        pub fn set(&self, _: String) -> Result<(), String> {
            Ok(())
        }
    }
}

pub use global_shortcut::ShortcutManager;

fn position_at_bottom(window: &tauri::WebviewWindow, height: u32) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else { return };
    let work = monitor.work_area();
    let x = work.position.x
        + (work
            .size
            .width
            .saturating_sub(window.outer_size().map_or(0, |s| s.width))
            / 2) as i32;
    let y = work.position.y + work.size.height.saturating_sub(height) as i32 - QUICK_CHAT_MARGIN;
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn toggle_quick_chat(app: &AppHandle) {
    let dispatch = app.clone();
    let app = app.clone();
    let _ = dispatch.run_on_main_thread(move || {
        if let Some(window) = app.get_webview_window("quick-chat") {
            if window.is_visible().unwrap_or(false) {
                let _ = window.hide();
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }
                return;
            }

            if let Some(main) = app.get_webview_window("main") {
                let _ = main.hide();
            }
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("quick-chat-opened", ());
            return;
        }

        let window = tauri::WebviewWindowBuilder::new(
            &app,
            "quick-chat",
            tauri::WebviewUrl::App("index.html?window=quick-chat".into()),
        )
        .title("Black One Quick Chat")
        .inner_size(QUICK_CHAT_WIDTH, QUICK_CHAT_HEIGHT)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .transparent(true)
        .shadow(false)
        .visible(false)
        .build();

        if let Ok(window) = window {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.hide();
            }
            let height = window
                .outer_size()
                .map_or(QUICK_CHAT_HEIGHT as u32, |size| size.height);
            position_at_bottom(&window, height);
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("quick-chat-opened", ());
        }
    });
}

/// Opens (or closes) the quick-chat window from the system tray menu.
pub fn toggle_from_tray(app: &AppHandle) {
    toggle_quick_chat(app);
}

#[tauri::command]
pub fn set_quick_chat_shortcut(
    binding: String,
    shortcut: State<'_, ShortcutManager>,
) -> Result<(), String> {
    shortcut.set(binding)
}

#[tauri::command]
pub fn resize_quick_chat(app: AppHandle, expanded: bool) -> Result<(), String> {
    let Some(window) = app.get_webview_window("quick-chat") else {
        return Ok(());
    };
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let old_size = window.outer_size().map_err(|error| error.to_string())?;
    let old_position = window.outer_position().map_err(|error| error.to_string())?;
    let target_height = ((if expanded {
        QUICK_CHAT_EXPANDED_HEIGHT
    } else {
        QUICK_CHAT_HEIGHT
    }) * scale) as u32;
    window
        .set_size(PhysicalSize::new(old_size.width, target_height))
        .map_err(|error| error.to_string())?;
    window
        .set_position(PhysicalPosition::new(
            old_position.x,
            old_position.y + old_size.height as i32 - target_height as i32,
        ))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn hide_quick_chat(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick-chat") {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn submit_quick_chat(app: AppHandle, payload: Value) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        main.show().map_err(|error| error.to_string())?;
        main.set_focus().map_err(|error| error.to_string())?;
    }
    app.emit_to("main", "quick-chat-submit", payload)
        .map_err(|error| error.to_string())?;
    hide_quick_chat(app)
}
