pub mod chat;
pub mod cli;
pub mod file_system;
pub mod git;
pub mod models;
pub mod quick_chat;
pub mod settings;
pub mod shell;
pub mod system;
pub mod terminal;
pub mod tray;

use std::sync::MutexGuard;

use rusqlite::Connection;
use tauri::State;

use crate::state::AppState;
use crate::utils::AppError;

/// Locks the app-wide database connection, mapping a poisoned mutex to an error.
pub(crate) fn lock_db<'a>(
    state: &'a State<'_, AppState>,
) -> Result<MutexGuard<'a, Connection>, AppError> {
    state
        .db
        .lock()
        .map_err(|e| AppError::InvalidInput(e.to_string()))
}
