//! System tray: status badge, menu, and window show/hide behaviour.
//!
//! The tray is the app's face while the window is hidden, so it carries the
//! same activity vocabulary the workspace switcher uses — running, waiting on
//! an approval, failed, finished — as a coloured dot composited onto the app
//! icon plus a matching line at the top of the menu.

use std::sync::Mutex;

use serde::Deserialize;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};

use crate::utils::AppError;

/// Emitted to the webview when a tray menu entry is chosen. The payload is the
/// menu id, so the frontend routes it without a command per entry.
pub const TRAY_ACTION_EVENT: &str = "tray://action";

const TRAY_ID: &str = "black-one";
const BASE_TOOLTIP: &str = "Black One";

/// Activity levels the tray can display, mirroring `WorkspaceActivity` on the
/// frontend. `idle` deliberately has no badge so a quiet app looks quiet.
const BADGE_COLORS: [(&str, [u8; 3]); 4] = [
    ("waiting", [245, 158, 11]),
    ("running", [59, 130, 246]),
    ("error", [239, 68, 68]),
    ("done", [34, 197, 94]),
];

fn badge_color(activity: &str) -> Option<[u8; 3]> {
    BADGE_COLORS
        .iter()
        .find(|(name, _)| *name == activity)
        .map(|(_, color)| *color)
}

/// Handles kept alive so the tray can be updated after it is built.
struct TrayHandles {
    icon: TrayIcon<Wry>,
    status: MenuItem<Wry>,
    toggle: MenuItem<Wry>,
    base: Image<'static>,
    /// Pre-composited badge variants, built once at startup.
    badges: Vec<(&'static str, Image<'static>)>,
    activity: String,
}

#[derive(Default)]
pub struct TrayState(Mutex<Option<TrayHandles>>);

/// Status pushed from the webview whenever workspace activity changes.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStatus {
    /// One of `idle` | `running` | `waiting` | `error` | `done`.
    pub activity: String,
    /// Short human line, e.g. "2 running · 1 needs approval".
    pub summary: String,
}

// ----------------------------------------------------------------- icon badge

fn blend(dst: u8, src: u8, alpha: f32) -> u8 {
    (dst as f32 * (1.0 - alpha) + src as f32 * alpha).round() as u8
}

/// Draws a status dot into the bottom-right corner of the app icon.
///
/// The dot is ringed in near-black so it stays legible against both light and
/// dark tray backgrounds, and its edge is anti-aliased so it does not look like
/// a staircase once the shell scales the icon down to 16px.
fn with_badge(base: &Image<'_>, color: [u8; 3]) -> Image<'static> {
    let width = base.width();
    let height = base.height();
    let mut pixels = base.rgba().to_vec();
    if width == 0 || height == 0 {
        return Image::new_owned(pixels, width, height);
    }

    let side = width.min(height) as f32;
    let radius = side * 0.21;
    let cx = width as f32 - radius - side * 0.035;
    let cy = height as f32 - radius - side * 0.035;
    let ring = radius * 0.72;

    // Only walk the badge's bounding box; the rest of the icon is untouched.
    let x0 = (cx - radius).floor().max(0.0) as u32;
    let x1 = ((cx + radius).ceil() as u32).min(width);
    let y0 = (cy - radius).floor().max(0.0) as u32;
    let y1 = ((cy + radius).ceil() as u32).min(height);

    for y in y0..y1 {
        for x in x0..x1 {
            let dx = x as f32 + 0.5 - cx;
            let dy = y as f32 + 0.5 - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist > radius {
                continue;
            }
            let (r, g, b) = if dist > ring {
                (12, 12, 16)
            } else {
                (color[0], color[1], color[2])
            };
            let alpha = (radius - dist).clamp(0.0, 1.0);
            let idx = ((y * width + x) * 4) as usize;
            if idx + 3 >= pixels.len() {
                continue;
            }
            pixels[idx] = blend(pixels[idx], r, alpha);
            pixels[idx + 1] = blend(pixels[idx + 1], g, alpha);
            pixels[idx + 2] = blend(pixels[idx + 2], b, alpha);
            // The badge sits over transparent corners too, so raise opacity.
            pixels[idx + 3] = blend(pixels[idx + 3], 255, alpha);
        }
    }

    Image::new_owned(pixels, width, height)
}

fn load_base_icon() -> Result<Image<'static>, Box<dyn std::error::Error>> {
    let bytes = include_bytes!("../../icons/icon.png");
    let decoded = Image::from_bytes(bytes)?;
    // `from_bytes` borrows the input; own the pixels so the image outlives setup.
    Ok(Image::new_owned(
        decoded.rgba().to_vec(),
        decoded.width(),
        decoded.height(),
    ))
}

// -------------------------------------------------------------- window helpers

pub fn show_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    refresh_toggle_label(app);
}

pub fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    refresh_toggle_label(app);
}

fn main_window_visible(app: &AppHandle) -> bool {
    app.get_webview_window("main")
        .map(|window| {
            window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false)
        })
        .unwrap_or(false)
}

/// Keeps the single show/hide entry honest about what it will do next.
pub fn refresh_toggle_label(app: &AppHandle) {
    let visible = main_window_visible(app);
    let Some(state) = app.try_state::<TrayState>() else {
        return;
    };
    let Ok(guard) = state.0.lock() else { return };
    let Some(handles) = guard.as_ref() else { return };
    let _ = handles.toggle.set_text(if visible {
        "Hide to tray"
    } else {
        "Show Black One"
    });
}

// ------------------------------------------------------------------- building

/// Builds the tray icon and menu, and stores the handles needed to update them.
pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let status = MenuItem::with_id(app, "status", "Idle", false, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "Hide to tray", true, None::<&str>)?;
    let quick_chat = MenuItem::with_id(app, "quick-chat", "Quick Chat", true, None::<&str>)?;
    let new_chat = MenuItem::with_id(app, "new-chat", "New chat", true, None::<&str>)?;
    let command_center =
        MenuItem::with_id(app, "command-center", "Command Center", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let updates = MenuItem::with_id(app, "updates", "Check for updates…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Black One", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &status,
            &PredefinedMenuItem::separator(app)?,
            &toggle,
            &quick_chat,
            &PredefinedMenuItem::separator(app)?,
            &new_chat,
            &command_center,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &updates,
            &quit,
        ],
    )?;

    let base = load_base_icon()?;
    let badges = BADGE_COLORS
        .iter()
        .map(|(name, color)| (*name, with_badge(&base, *color)))
        .collect::<Vec<_>>();

    let icon = TrayIconBuilder::with_id(TRAY_ID)
        .icon(base.clone())
        .menu(&menu)
        .tooltip(BASE_TOOLTIP)
        // Windows and Linux convention: left click opens the app, right click
        // opens the menu. Showing the menu on both makes the icon feel dead.
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| on_menu_event(app, event.id().as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            }
            | TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    let state = app.state::<TrayState>();
    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(TrayHandles {
            icon,
            status,
            toggle,
            base,
            badges,
            activity: "idle".to_string(),
        });
    }
    refresh_toggle_label(app);
    Ok(())
}

fn on_menu_event(app: &AppHandle, id: &str) {
    match id {
        "toggle" => {
            if main_window_visible(app) {
                hide_main_window(app);
            } else {
                show_main_window(app);
            }
        }
        "quit" => app.exit(0),
        "quick-chat" => super::quick_chat::toggle_from_tray(app),
        // Everything else is a view the webview owns; wake the window first so
        // the action lands somewhere the user can see.
        other => {
            show_main_window(app);
            let _ = app.emit(TRAY_ACTION_EVENT, other.to_string());
        }
    }
}

// -------------------------------------------------------------------- command

#[tauri::command]
pub fn set_tray_status(app: AppHandle, status: TrayStatus) -> Result<(), AppError> {
    let state = app.state::<TrayState>();
    let mut guard = state
        .0
        .lock()
        .map_err(|e| AppError::InvalidInput(e.to_string()))?;
    let Some(handles) = guard.as_mut() else {
        return Ok(());
    };

    let summary = if status.summary.trim().is_empty() {
        "Idle".to_string()
    } else {
        status.summary.trim().to_string()
    };
    handles.status.set_text(&summary)?;
    handles
        .icon
        .set_tooltip(Some(format!("{BASE_TOOLTIP} — {summary}")))?;

    // Repainting the icon is the expensive part, so only do it on a change.
    if handles.activity != status.activity {
        let next = match badge_color(&status.activity) {
            Some(_) => handles
                .badges
                .iter()
                .find(|(name, _)| *name == status.activity)
                .map(|(_, image)| image.clone())
                .unwrap_or_else(|| handles.base.clone()),
            None => handles.base.clone(),
        };
        handles.icon.set_icon(Some(next))?;
        handles.activity = status.activity;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(width: u32, height: u32) -> Image<'static> {
        Image::new_owned(vec![0u8; (width * height * 4) as usize], width, height)
    }

    #[test]
    fn every_named_activity_has_a_color() {
        for name in ["waiting", "running", "error", "done"] {
            assert!(badge_color(name).is_some(), "{name} has no badge color");
        }
    }

    #[test]
    fn idle_has_no_badge_so_a_quiet_app_looks_quiet() {
        assert!(badge_color("idle").is_none());
        assert!(badge_color("").is_none());
    }

    #[test]
    fn the_badge_only_touches_the_bottom_right_corner() {
        let base = solid(64, 64);
        let badged = with_badge(&base, [255, 0, 0]);
        assert_eq!(badged.width(), 64);
        assert_eq!(badged.height(), 64);

        let pixels = badged.rgba();
        let at = |x: u32, y: u32| {
            let i = ((y * 64 + x) * 4) as usize;
            [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]
        };
        assert_eq!(at(2, 2), [0, 0, 0, 0], "top-left must be untouched");
        assert_eq!(at(2, 61), [0, 0, 0, 0], "bottom-left must be untouched");
        assert_ne!(at(50, 50), [0, 0, 0, 0], "the dot must be drawn");
    }

    #[test]
    fn the_badge_center_carries_the_status_color() {
        let badged = with_badge(&solid(64, 64), [255, 0, 0]);
        let pixels = badged.rgba();
        // Center of the dot: side*0.21 radius, inset side*0.035 from the edge.
        let cx = 64.0 - 64.0 * 0.21 - 64.0 * 0.035;
        let i = (((cx as u32) * 64 + (cx as u32)) * 4) as usize;
        assert_eq!(pixels[i], 255, "red channel");
        assert_eq!(pixels[i + 1], 0, "green channel");
        assert_eq!(pixels[i + 3], 255, "the dot is opaque");
    }

    #[test]
    fn a_zero_sized_icon_does_not_panic() {
        let badged = with_badge(&solid(0, 0), [255, 0, 0]);
        assert_eq!(badged.width(), 0);
    }
}
