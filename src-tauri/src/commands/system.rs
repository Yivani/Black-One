use serde::Serialize;
use tauri::{Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;

use super::lock_db;
use crate::state::AppState;
use crate::utils::AppError;

const RELEASES_URL: &str = "https://api.github.com/repos/black-one/black-one/releases/latest";
const MAX_NOTES_LEN: usize = 4000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: &'static str,
    pub commit_sha: &'static str,
    pub platform: &'static str,
    pub arch: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub status: String,
    pub latest: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION"),
        commit_sha: option_env!("BLACK_ONE_COMMIT").unwrap_or("dev"),
        platform: std::env::consts::OS,
        arch: std::env::consts::ARCH,
    }
}

fn wipe_database(state: &State<'_, AppState>, app: &tauri::AppHandle) -> Result<(), AppError> {
    let conn = lock_db(state)?;
    conn.execute_batch(
        "DELETE FROM messages;
         DELETE FROM sessions;
         DELETE FROM folders;
         DELETE FROM settings;
         DELETE FROM providers;",
    )?;
    drop(conn);
    super::file_system::delete_memory_file(app.clone())?;

    Ok(())
}

#[tauri::command]
pub fn clear_all_data(state: State<'_, AppState>, app: tauri::AppHandle) -> Result<(), AppError> {
    wipe_database(&state, &app)
}

#[tauri::command]
pub fn factory_reset(state: State<'_, AppState>, app: tauri::AppHandle) -> Result<(), AppError> {
    wipe_database(&state, &app)
}

#[tauri::command]
pub fn check_for_updates() -> Result<UpdateCheckResult, AppError> {
    let current_version = env!("CARGO_PKG_VERSION");

    // ureq treats 4xx/5xx as Err(StatusCode) by default, so the 404 case
    // (repository has no published releases) arrives on the error arm.
    let response = match ureq::get(RELEASES_URL)
        .header("User-Agent", "black-one")
        .call()
    {
        Ok(response) => response,
        Err(ureq::Error::StatusCode(404)) => {
            return Ok(UpdateCheckResult {
                status: "up-to-date".to_string(),
                latest: None,
                notes: Some("No published releases yet.".to_string()),
            });
        }
        Err(e) => {
            return Ok(UpdateCheckResult {
                status: "error".to_string(),
                latest: None,
                notes: Some(e.to_string()),
            });
        }
    };

    let status_code = response.status().as_u16();
    if status_code == 404 {
        return Ok(UpdateCheckResult {
            status: "up-to-date".to_string(),
            latest: None,
            notes: Some("No published releases yet.".to_string()),
        });
    }
    if !(200..300).contains(&status_code) {
        return Ok(UpdateCheckResult {
            status: "error".to_string(),
            latest: None,
            notes: Some(format!("GitHub API returned status {status_code}.")),
        });
    }

    let body = response
        .into_body()
        .read_to_string()
        .map_err(|e| AppError::Http(e.to_string()))?;
    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| AppError::Http(format!("invalid release payload: {e}")))?;

    let tag = json.get("tag_name").and_then(|v| v.as_str());
    let notes = json
        .get("body")
        .and_then(|v| v.as_str())
        .map(|body| body.chars().take(MAX_NOTES_LEN).collect::<String>());

    match tag {
        Some(tag) if tag != format!("v{current_version}") && tag != current_version => {
            Ok(UpdateCheckResult {
                status: "available".to_string(),
                latest: Some(tag.to_string()),
                notes,
            })
        }
        _ => Ok(UpdateCheckResult {
            status: "up-to-date".to_string(),
            latest: tag.map(str::to_string),
            notes,
        }),
    }
}

#[tauri::command]
pub fn open_data_folder(app: tauri::AppHandle) -> Result<(), AppError> {
    let dir = app.path().app_data_dir()?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(std::io::Error::other)?;
    Ok(())
}

#[tauri::command]
pub fn set_auto_start(enabled: bool, app: tauri::AppHandle) -> Result<(), AppError> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
    } else {
        manager.disable().map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
    }
    Ok(())
}

#[tauri::command]
pub fn is_auto_start_enabled(app: tauri::AppHandle) -> Result<bool, AppError> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))
}
