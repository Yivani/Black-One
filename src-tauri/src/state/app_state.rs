use std::sync::Mutex;

use rusqlite::Connection;

use crate::state::terminal_store::TerminalManager;

/// Shared application state managed by Tauri.
pub struct AppState {
    pub db: Mutex<Connection>,
    pub terminals: TerminalManager,
}
