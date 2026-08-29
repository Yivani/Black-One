use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::lock_db;
use crate::state::AppState;
use crate::utils::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRow {
    pub id: String,
    pub name: String,
    /// Serialized as "type" (serde strips the raw-identifier prefix).
    pub r#type: String,
    pub base_url: String,
    #[serde(default)]
    pub api_key_encrypted: Option<String>,
    pub is_enabled: bool,
    #[serde(default)]
    pub models: Option<String>,
}

#[tauri::command]
pub fn list_providers(state: State<'_, AppState>) -> Result<Vec<ProviderRow>, AppError> {
    let conn = lock_db(&state)?;
    let mut stmt = conn.prepare(
        "SELECT id, name, type, base_url, api_key_encrypted, is_enabled, models \
         FROM providers ORDER BY name ASC",
    )?;
    let providers = stmt
        .query_map([], |row| {
            Ok(ProviderRow {
                id: row.get(0)?,
                name: row.get(1)?,
                r#type: row.get(2)?,
                base_url: row.get(3)?,
                api_key_encrypted: row.get(4)?,
                is_enabled: row.get(5)?,
                models: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(providers)
}

#[tauri::command]
pub fn upsert_provider(state: State<'_, AppState>, provider: ProviderRow) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT OR REPLACE INTO providers (id, name, type, base_url, api_key_encrypted, is_enabled, models) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            provider.id,
            provider.name,
            provider.r#type,
            provider.base_url,
            provider.api_key_encrypted,
            provider.is_enabled,
            provider.models,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn delete_provider(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM providers WHERE id = ?1", params![id])?;
    Ok(())
}
