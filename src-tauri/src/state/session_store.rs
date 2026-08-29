use rusqlite::Connection;
use tauri::Manager;

use crate::state::app_state::AppState;
use crate::utils::errors::AppError;

const MIGRATIONS: &str = "
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    folder_id TEXT,
    model_id TEXT,
    system_prompt TEXT,
    message_count INTEGER NOT NULL DEFAULT 0,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    tokens_used INTEGER,
    model_id TEXT,
    parent_id TEXT,
    status TEXT NOT NULL DEFAULT 'complete',
    citations TEXT,
    attachments TEXT,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created
    ON messages (session_id, created_at);

CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    created_at INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key_encrypted TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    models TEXT
);
";

/// Opens (creating if needed) the SQLite database in the app data directory,
/// applies pragmas and migrations, and returns the managed app state.
pub fn init(app: &tauri::App) -> Result<AppState, AppError> {
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;

    let conn = Connection::open(data_dir.join("black-one.db"))?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute_batch(MIGRATIONS)?;

    Ok(AppState {
        db: std::sync::Mutex::new(conn),
        terminals: crate::state::terminal_store::TerminalManager::new(),
    })
}
