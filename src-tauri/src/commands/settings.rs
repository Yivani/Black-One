use rusqlite::{params, OptionalExtension};
use tauri::State;

use super::lock_db;
use crate::state::AppState;
use crate::utils::AppError;

const KEYRING_SERVICE: &str = "black-one";

#[tauri::command]
pub fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, AppError> {
    let conn = lock_db(&state)?;
    let value = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()?;
    Ok(value)
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

#[tauri::command]
pub fn store_api_key(provider_id: String, key: String) -> Result<(), AppError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &provider_id)
        .map_err(|e| AppError::Keyring(e.to_string()))?;
    entry
        .set_password(&key)
        .map_err(|e| AppError::Keyring(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn get_api_key(provider_id: String) -> Result<Option<String>, AppError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &provider_id)
        .map_err(|e| AppError::Keyring(e.to_string()))?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keyring(e.to_string())),
    }
}

#[tauri::command]
pub fn delete_api_key(provider_id: String) -> Result<(), AppError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &provider_id)
        .map_err(|e| AppError::Keyring(e.to_string()))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Keyring(e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::KEYRING_SERVICE;

    #[test]
    fn api_keys_round_trip_through_the_native_store() {
        let provider_id = format!("black-one-test-{}", uuid::Uuid::new_v4());
        let entry = keyring::Entry::new(KEYRING_SERVICE, &provider_id)
            .expect("native credential entry should be available");

        entry
            .set_password("credential-round-trip")
            .expect("credential should be stored");
        assert_eq!(
            entry.get_password().expect("credential should be readable"),
            "credential-round-trip"
        );
        entry
            .delete_credential()
            .expect("test credential should be removed");
    }
}
