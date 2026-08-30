#![allow(linker_messages)]

mod commands;
mod state;
mod utils;

use tauri::{menu::Menu, Manager};
use tauri::menu::MenuItem;
use tauri::tray::TrayIconBuilder;

fn load_tray_icon() -> Result<tauri::image::Image<'static>, Box<dyn std::error::Error>> {
    let bytes = include_bytes!("../icons/icon.png");
    Ok(tauri::image::Image::from_bytes(bytes)?)
}

fn setting_bool(state: &state::AppState, key: &str, default: bool) -> bool {
    let conn = match state.db.lock() {
        Ok(guard) => guard,
        Err(_) => return default,
    };
    let raw: Option<String> = match conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        [key],
        |row| row.get(0),
    ) {
        Ok(value) => value,
        Err(_) => return default,
    };
    let Some(raw) = raw else { return default };
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return default;
    };
    parsed
        .get("advanced")
        .and_then(|v| v.get(key))
        .and_then(|v| v.as_bool())
        .unwrap_or(default)
}

fn load_minimize_to_tray(state: &state::AppState) -> bool {
    setting_bool(state, "minimizeToTray", false)
}

fn load_start_minimized(state: &state::AppState) -> bool {
    setting_bool(state, "startMinimized", false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::AppleScript,
            None::<Vec<&str>>,
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

            // System tray icon and close-to-tray behavior.
            let tray_state = app.state::<state::AppState>();
            let show_i = MenuItem::with_id(app, "show", "Show Black One", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;
            TrayIconBuilder::new()
                .icon(load_tray_icon()?)
                .menu(&menu)
                .tooltip("Black One")
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| {
                    let handle = tray.app_handle();
                    let Some(window) = handle.get_webview_window("main") else {
                        return;
                    };
                    match event {
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            ..
                        }
                        | tauri::tray::TrayIconEvent::DoubleClick {
                            button: tauri::tray::MouseButton::Left,
                            ..
                        } => {
                            let is_visible = window.is_visible().unwrap_or(true);
                            let is_minimized = window.is_minimized().unwrap_or(false);
                            if is_visible && !is_minimized {
                                let _ = window.hide();
                            } else {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Right,
                            ..
                        } => {
                            // The attached menu is shown automatically on most platforms;
                            // on Windows we ensure the window is available first.
                            let _ = window.show();
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            let window_close = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let state = window_close.app_handle().state::<state::AppState>();
                    if load_minimize_to_tray(&state) {
                        api.prevent_close();
                        let _ = window_close.hide();
                    }
                }
            });

            if load_start_minimized(&tray_state) {
                let _ = window.hide();
            }

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
            commands::file_system::read_memory_file,
            commands::file_system::write_memory_file,
            commands::file_system::delete_memory_file,
            commands::shell::execute_shell_command,
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
            commands::terminal::register_terminal_channel,
            commands::terminal::create_terminal,
            commands::terminal::write_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal,
            commands::terminal::list_terminals,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Black One");
}
