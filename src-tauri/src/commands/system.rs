use serde::Serialize;
use tauri::{Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;

use super::lock_db;
use crate::state::AppState;
use crate::utils::AppError;

const RELEASES_URL: &str = "https://api.github.com/repos/Yivani/Black-One/releases/latest";
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
pub struct ReleaseAsset {
    pub name: String,
    pub url: String,
    pub size: u64,
}

/// The latest published release, as GitHub describes it.
///
/// This command reports; it does not judge. Whether the release is newer than
/// what is running, and which file this machine should download, are decided
/// in `src/lib/updateCore.ts` where both rules are unit-tested.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    /// "ok" when a release was read, "none" when there are none, "error" otherwise.
    pub status: String,
    pub error: Option<String>,
    pub tag: Option<String>,
    pub name: Option<String>,
    pub notes: Option<String>,
    pub published_at: Option<String>,
    pub page_url: Option<String>,
    pub commit_sha: Option<String>,
    pub prerelease: bool,
    pub assets: Vec<ReleaseAsset>,
    pub current_version: String,
    pub platform: String,
    pub arch: String,
}

impl UpdateCheckResult {
    fn empty(status: &str) -> Self {
        Self {
            status: status.to_string(),
            error: None,
            tag: None,
            name: None,
            notes: None,
            published_at: None,
            page_url: None,
            commit_sha: None,
            prerelease: false,
            assets: Vec::new(),
            current_version: env!("CARGO_PKG_VERSION").to_string(),
            platform: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
        }
    }

    fn failed(message: impl Into<String>) -> Self {
        let mut result = Self::empty("error");
        result.error = Some(message.into());
        result
    }
}

/// Pulls the downloadable files out of a release payload.
///
/// Split out so the parsing is testable without a network call.
fn parse_assets(json: &serde_json::Value) -> Vec<ReleaseAsset> {
    json.get("assets")
        .and_then(|v| v.as_array())
        .map(|assets| {
            assets
                .iter()
                .filter_map(|asset| {
                    let name = asset.get("name")?.as_str()?.to_string();
                    let url = asset.get("browser_download_url")?.as_str()?.to_string();
                    let size = asset.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                    Some(ReleaseAsset { name, url, size })
                })
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_cwd() -> Result<String, AppError> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))
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

/// Reads the latest release from GitHub.
///
/// There is deliberately no download or install here. The installers are not
/// signed with an updater key, so the auto-update path could never complete —
/// what the user gets instead is the release notes and a link to the installer.
#[tauri::command]
pub fn check_for_updates() -> Result<UpdateCheckResult, AppError> {
    // ureq treats 4xx/5xx as Err(StatusCode) by default, so the 404 case
    // (repository has no published releases) arrives on the error arm.
    let response = match ureq::get(RELEASES_URL)
        .header("User-Agent", "black-one")
        .header("Accept", "application/vnd.github+json")
        .call()
    {
        Ok(response) => response,
        Err(ureq::Error::StatusCode(404)) => return Ok(UpdateCheckResult::empty("none")),
        Err(e) => return Ok(UpdateCheckResult::failed(e.to_string())),
    };

    let status_code = response.status().as_u16();
    if status_code == 404 {
        return Ok(UpdateCheckResult::empty("none"));
    }
    if !(200..300).contains(&status_code) {
        return Ok(UpdateCheckResult::failed(format!(
            "GitHub API returned status {status_code}."
        )));
    }

    let body = response
        .into_body()
        .read_to_string()
        .map_err(|e| AppError::Http(e.to_string()))?;
    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| AppError::Http(format!("invalid release payload: {e}")))?;

    let text = |key: &str| {
        json.get(key)
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|value| !value.is_empty())
    };

    let mut result = UpdateCheckResult::empty("ok");
    result.tag = text("tag_name");
    result.name = text("name");
    result.notes = text("body").map(|body| body.chars().take(MAX_NOTES_LEN).collect());
    result.published_at = text("published_at");
    result.page_url = text("html_url");
    result.commit_sha = text("target_commitish");
    result.prerelease = json
        .get("prerelease")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    result.assets = parse_assets(&json);
    if result.tag.is_none() {
        return Ok(UpdateCheckResult::empty("none"));
    }
    Ok(result)
}

#[tauri::command]
pub fn relaunch_app(app: tauri::AppHandle) {
    app.restart();
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

/// Whether this process was started by the OS launch-at-login entry rather
/// than by the user. The frontend uses it to skip focus-stealing first-run UI.
#[tauri::command]
pub fn was_auto_started() -> bool {
    std::env::args().any(|arg| arg == "--autostart")
}

#[tauri::command]
pub fn is_auto_start_enabled(app: tauri::AppHandle) -> Result<bool, AppError> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release_json() -> serde_json::Value {
        serde_json::json!({
            "tag_name": "v1.2.0",
            "assets": [
                {
                    "name": "Black.One_1.2.0_x64-setup.exe",
                    "browser_download_url": "https://example.test/setup.exe",
                    "size": 8_400_000u64
                },
                {
                    "name": "Black.One_1.2.0_x64-setup.exe.sig",
                    "browser_download_url": "https://example.test/setup.exe.sig",
                    "size": 200u64
                }
            ]
        })
    }

    #[test]
    fn reads_every_downloadable_file() {
        let assets = parse_assets(&release_json());
        assert_eq!(assets.len(), 2);
        assert_eq!(assets[0].name, "Black.One_1.2.0_x64-setup.exe");
        assert_eq!(assets[0].url, "https://example.test/setup.exe");
        assert_eq!(assets[0].size, 8_400_000);
    }

    #[test]
    fn a_release_without_assets_is_not_an_error() {
        assert!(parse_assets(&serde_json::json!({ "tag_name": "v1.2.0" })).is_empty());
        assert!(parse_assets(&serde_json::json!({ "assets": [] })).is_empty());
    }

    #[test]
    fn an_asset_missing_its_url_is_skipped_rather_than_offered() {
        // A half-written asset would otherwise become a download button that
        // leads nowhere.
        let json = serde_json::json!({
            "assets": [
                { "name": "broken.exe" },
                { "browser_download_url": "https://example.test/x.exe" },
                {
                    "name": "good.exe",
                    "browser_download_url": "https://example.test/good.exe"
                }
            ]
        });
        let assets = parse_assets(&json);
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].name, "good.exe");
        assert_eq!(assets[0].size, 0, "an unreported size is zero, not a failure");
    }

    #[test]
    fn the_result_always_says_what_is_running() {
        let result = UpdateCheckResult::empty("none");
        assert_eq!(result.current_version, env!("CARGO_PKG_VERSION"));
        assert_eq!(result.platform, std::env::consts::OS);
        assert!(result.error.is_none());

        let failed = UpdateCheckResult::failed("offline");
        assert_eq!(failed.status, "error");
        assert_eq!(failed.error.as_deref(), Some("offline"));
    }
}
