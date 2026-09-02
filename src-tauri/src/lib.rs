#![allow(linker_messages)]

mod commands;
mod state;
mod utils;

use tauri::Manager;

/// The frontend persists every settings section inside one JSON row under this
/// key, so a single setting is read by fetching that row and walking into its
/// section — not by looking for a row named after the setting, which never
/// existed and silently sent every lookup to its default.
const SETTINGS_ROW_KEY: &str = "app:settings";

/// Reads `<section>.<key>` out of the persisted settings blob.
///
/// Split from the database access so the walk is testable without a Tauri app.
fn bool_from_settings(
    settings: &serde_json::Value,
    section: &str,
    key: &str,
    default: bool,
) -> bool {
    settings
        .get(section)
        .and_then(|value| value.get(key))
        .and_then(|value| value.as_bool())
        .unwrap_or(default)
}

fn load_settings_json(state: &state::AppState) -> Option<serde_json::Value> {
    let conn = state.db.lock().ok()?;
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [SETTINGS_ROW_KEY],
            |row| row.get(0),
        )
        .ok()?;
    serde_json::from_str(&raw?).ok()
}

fn setting_bool(state: &state::AppState, section: &str, key: &str, default: bool) -> bool {
    match load_settings_json(state) {
        Some(settings) => bool_from_settings(&settings, section, key, default),
        None => default,
    }
}

fn load_minimize_to_tray(state: &state::AppState) -> bool {
    // Matches the frontend default, so a fresh install behaves the same on both
    // sides of the bridge.
    setting_bool(state, "advanced", "minimizeToTray", true)
}

fn load_start_minimized(state: &state::AppState) -> bool {
    setting_bool(state, "advanced", "startMinimized", false)
}

fn load_auto_start_wanted(state: &state::AppState) -> bool {
    setting_bool(state, "advanced", "autoStartWithOs", false)
}

/// Passed to the OS launch-at-login entry so the app can tell an automatic
/// startup from one the user asked for.
const AUTOSTART_ARG: &str = "--autostart";

fn launched_by_autostart() -> bool {
    std::env::args().any(|arg| arg == AUTOSTART_ARG)
}

/// Brings the OS launch-at-login entry back in line with the saved preference.
///
/// The registry key (or LaunchAgent, or .desktop file) points at an absolute
/// path, so reinstalling or moving the app leaves the setting on and the entry
/// broken. Re-registering on every start is cheap and fixes that silently.
fn reconcile_autostart(app: &tauri::AppHandle, state: &state::AppState) {
    use tauri_plugin_autostart::ManagerExt;
    let wanted = load_auto_start_wanted(state);
    let manager = app.autolaunch();
    let enabled = manager.is_enabled().unwrap_or(false);
    if wanted && !enabled {
        let _ = manager.enable();
    } else if !wanted && enabled {
        let _ = manager.disable();
    }
}

/// Tells the user where the window went the first time close hides it.
///
/// Without this, "minimize to tray" reads as "the app quit" and people relaunch
/// into a second instance that the single-instance plugin just bounces.
fn announce_tray_once(app: &tauri::AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static ANNOUNCED: AtomicBool = AtomicBool::new(false);
    if ANNOUNCED.swap(true, Ordering::SeqCst) {
        return;
    }
    use tauri_plugin_notification::NotificationExt;
    let _ = app
        .notification()
        .builder()
        .title("Black One is still running")
        .body("Find it in the system tray. Right-click the icon for options.")
        .show();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::cli::CliManager::default())
        .manage(commands::tray::TrayState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch should surface the running window, not start a
            // second copy — and the tray's show/hide entry has to follow.
            commands::tray::show_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_ARG]),
        ))
        .setup(|app| {
            let state = state::session_store::init(app)?;
            app.manage(state);
            app.manage(commands::quick_chat::ShortcutManager::new(app.handle().clone()));

            let builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Black One")
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 560.0)
            .center()
            .initialization_script(
                r#"(() => {
                const FALLBACK_ID = 'black-one-fallback';
                const REPO_URL = 'https://github.com/black-one/black-one';

                function escapeHtml(text) {
                  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
                  return String(text).replace(/[&<>"']/g, (c) => map[c] ?? c);
                }

                function getDetails(value) {
                  if (value instanceof Error) return { message: value.message, stack: value.stack || '' };
                  return { message: String(value || 'Unknown error'), stack: '' };
                }

                function copyText(text) {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).catch(() => {});
                    return;
                  }
                  const textarea = document.createElement('textarea');
                  textarea.value = text;
                  textarea.style.position = 'fixed';
                  textarea.style.opacity = '0';
                  document.body.appendChild(textarea);
                  textarea.select();
                  try { document.execCommand('copy'); } catch {}
                  textarea.remove();
                }

                function showFallback(message, stack) {
                  if (document.getElementById(FALLBACK_ID)) return;
                  const root = document.getElementById('root');
                  if (root) root.style.display = 'none';

                  const container = document.createElement('div');
                  container.id = FALLBACK_ID;
                  container.style.cssText = 'display:flex;flex-direction:column;height:100vh;width:100vw;overflow:hidden;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#09090b;color:#fafafa;';
                  container.innerHTML = `
                    <div style="display:flex;height:48px;flex-shrink:0;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);padding:0 16px;">
                      <div style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:#ef4444;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 11 2-2-2-2"/><path d="M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>
                        <span>Black One encountered an error</span>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <button id="black-one-reload" style="display:inline-flex;align-items:center;gap:6px;height:28px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:transparent;padding:0 10px;font-size:12px;color:#e4e4e7;cursor:pointer;">Reload</button>
                        <button id="black-one-close" style="display:inline-flex;align-items:center;gap:6px;height:28px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:transparent;padding:0 10px;font-size:12px;color:#e4e4e7;cursor:pointer;">Close</button>
                      </div>
                    </div>
                    <div style="flex:1;min-height:0;overflow:auto;padding:24px 32px;">
                      <h1 style="margin:0 0 12px;font-size:18px;font-weight:600;">Something went wrong</h1>
                      <p style="margin:0 0 16px;max-width:640px;font-size:14px;line-height:1.5;color:#a1a1aa;">
                        The app failed to start. The details below can help diagnose the problem. You can reload, close the window, or copy the error.
                      </p>
                      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">
                        <button id="black-one-copy" style="display:inline-flex;align-items:center;gap:6px;height:32px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:transparent;padding:0 12px;font-size:13px;color:#e4e4e7;cursor:pointer;">Copy error</button>
                        <button id="black-one-report" style="display:inline-flex;align-items:center;gap:6px;height:32px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:transparent;padding:0 12px;font-size:13px;color:#e4e4e7;cursor:pointer;">Report issue</button>
                      </div>
                      <div style="margin-bottom:8px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;">Error details</div>
                      <pre style="margin:0;min-height:200px;overflow:auto;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(255,255,255,0.03);padding:16px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:#d4d4d8;">${escapeHtml(message)}\n\n${escapeHtml(stack || '(no stack trace)')}</pre>
                    </div>
                  `;
                  document.body.appendChild(container);

                  document.getElementById('black-one-reload').addEventListener('click', () => location.reload());
                  document.getElementById('black-one-close').addEventListener('click', () => {
                    if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
                      window.__TAURI_INTERNALS__.invoke('plugin:window|close').catch(() => window.close());
                    } else {
                      window.close();
                    }
                  });
                  document.getElementById('black-one-copy').addEventListener('click', () => copyText(message + '\n\n' + (stack || '')));
                  document.getElementById('black-one-report').addEventListener('click', () => {
                    if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
                      window.__TAURI_INTERNALS__.invoke('plugin:opener|open_url', { url: REPO_URL }).catch(() => window.open(REPO_URL, '_blank'));
                    } else {
                      window.open(REPO_URL, '_blank');
                    }
                  });
                }

                function report(value) {
                  const { message, stack } = getDetails(value);
                  const render = () => showFallback(message, stack);
                  if (document.body) render();
                  else addEventListener('DOMContentLoaded', render, { once: true });
                }

                addEventListener('error', (event) => {
                  const value = event.error ? event.error : (event.message || `Failed to load ${event.target?.src || event.target?.href || 'resource'}`);
                  report(value);
                }, true);
                addEventListener('unhandledrejection', (event) => report(event.reason));
                addEventListener('DOMContentLoaded', () => setTimeout(() => {
                  if (!document.getElementById('root')?.hasChildNodes()) report('The application bundle loaded, but React did not start.');
                }, 2000), { once: true });
              })();"#,
            );

            // macOS and Windows/Linux need different decoration configs, so the
            // main window is created programmatically instead of via tauri.conf.json.
            // `hidden_title`/`title_bar_style` are macOS-only builder methods,
            // hence the `#[cfg]` split instead of a runtime `cfg!` branch.
            #[cfg(target_os = "macos")]
            let builder = builder
                .decorations(true)
                .hidden_title(true)
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .transparent(true);

            #[cfg(not(target_os = "macos"))]
            let builder = builder.decorations(false);

            let window = builder.build()?;

            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::UnderWindowBackground,
                    None,
                    None,
                )
                .expect("failed to apply window vibrancy");
            }

            #[cfg(not(target_os = "macos"))]
            let _ = &window;

            let tray_state = app.state::<state::AppState>();

            // System tray. The menu, status badge, and click behaviour all
            // live in `commands::tray` so this stays a wiring step.
            commands::tray::init(app.handle())?;

            let window_close = window.clone();
            window.on_window_event(move |event| match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let handle = window_close.app_handle();
                    let state = handle.state::<state::AppState>();
                    if load_minimize_to_tray(&state) {
                        api.prevent_close();
                        commands::tray::hide_main_window(&handle);
                        announce_tray_once(&handle);
                    }
                }
                // Keep the tray's show/hide entry in step with the window.
                tauri::WindowEvent::Focused(_) => {
                    commands::tray::refresh_toggle_label(&window_close.app_handle());
                }
                _ => {}
            });

            // Launch-at-login exists to put the app in the tray, so a startup
            // triggered by the OS never steals focus.
            if launched_by_autostart() || load_start_minimized(&tray_state) {
                let _ = window.hide();
                commands::tray::refresh_toggle_label(app.handle());
            }

            // Re-register autostart if the user asked for it but the OS entry
            // is gone — reinstalls and app moves silently drop it otherwise.
            reconcile_autostart(app.handle(), &tray_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::list_sessions,
            commands::chat::create_session,
            commands::chat::update_session,
            commands::chat::delete_session,
            commands::chat::list_messages,
            commands::chat::add_message,
            commands::chat::update_message,
            commands::chat::delete_messages_from,
            commands::chat::list_folders,
            commands::chat::create_folder,
            commands::chat::update_folder,
            commands::chat::delete_folder,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::store_api_key,
            commands::settings::get_api_key,
            commands::settings::delete_api_key,
            commands::file_system::read_file_text,
            commands::file_system::read_dir_entries,
            commands::file_system::write_file_text,
            commands::file_system::create_dir_command,
            commands::file_system::delete_file,
            commands::file_system::delete_dir,
            commands::file_system::rename_file,
            commands::file_system::allow_media_preview,
            commands::file_system::get_data_dir,
            commands::file_system::pick_sound_file,
            commands::file_system::pick_workspace_folder,
            commands::file_system::path_within_roots,
            commands::file_system::read_memory_file,
            commands::file_system::write_memory_file,
            commands::file_system::delete_memory_file,
            commands::shell::execute_shell_command,
            commands::cli::list_cli_tool_statuses,
            commands::cli::list_cli_jobs,
            commands::cli::run_cli_operation,
            commands::cli::cancel_cli_operation,
            commands::git::git_status,
            commands::git::git_init,
            commands::git::git_stage_all,
            commands::git::git_commit,
            commands::git::git_set_remote,
            commands::git::git_push,
            commands::git::git_diff,
            commands::models::list_providers,
            commands::models::upsert_provider,
            commands::models::delete_provider,
            commands::quick_chat::set_quick_chat_shortcut,
            commands::quick_chat::resize_quick_chat,
            commands::quick_chat::hide_quick_chat,
            commands::quick_chat::submit_quick_chat,
            commands::system::get_cwd,
            commands::system::get_app_info,
            commands::system::clear_all_data,
            commands::system::factory_reset,
            commands::system::check_for_updates,
            commands::system::relaunch_app,
            commands::system::open_data_folder,
            commands::system::set_auto_start,
            commands::system::is_auto_start_enabled,
            commands::system::was_auto_started,
            commands::tray::set_tray_status,
            commands::terminal::register_terminal_channel,
            commands::terminal::create_terminal,
            commands::terminal::write_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal,
            commands::terminal::list_terminals,
            commands::terminal::terminal_busy,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Black One");
}

#[cfg(test)]
mod tests {
    use super::bool_from_settings;
    use serde_json::json;

    fn settings() -> serde_json::Value {
        json!({
            "advanced": {
                "minimizeToTray": true,
                "startMinimized": false,
                "autoStartWithOs": true,
            },
            "general": { "trayStatus": false },
        })
    }

    #[test]
    fn reads_a_boolean_out_of_its_section() {
        assert!(bool_from_settings(&settings(), "advanced", "minimizeToTray", false));
        assert!(!bool_from_settings(&settings(), "advanced", "startMinimized", true));
        assert!(bool_from_settings(&settings(), "advanced", "autoStartWithOs", false));
        assert!(!bool_from_settings(&settings(), "general", "trayStatus", true));
    }

    #[test]
    fn a_missing_section_or_key_falls_back_to_the_default() {
        let settings = settings();
        assert!(bool_from_settings(&settings, "nope", "minimizeToTray", true));
        assert!(!bool_from_settings(&settings, "nope", "minimizeToTray", false));
        assert!(bool_from_settings(&settings, "advanced", "unknown", true));
    }

    #[test]
    fn a_setting_at_the_top_level_is_not_mistaken_for_a_section_member() {
        // Regression guard: settings live under a section, and a flat lookup
        // used to make every one of these silently return its default.
        let flat = json!({ "minimizeToTray": true });
        assert!(!bool_from_settings(&flat, "advanced", "minimizeToTray", false));
    }

    #[test]
    fn a_non_boolean_value_falls_back_rather_than_coercing() {
        let settings = json!({ "advanced": { "minimizeToTray": "yes" } });
        assert!(!bool_from_settings(&settings, "advanced", "minimizeToTray", false));
        assert!(bool_from_settings(&settings, "advanced", "minimizeToTray", true));
    }
}
