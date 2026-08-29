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
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'memory')),
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

const MEMORY_ROLE_MIGRATION: &str = "
BEGIN;
ALTER TABLE messages RENAME TO messages_old;

CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'memory')),
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

INSERT INTO messages SELECT * FROM messages_old;

DROP TABLE messages_old;

CREATE INDEX idx_messages_session_created
    ON messages (session_id, created_at);

COMMIT;
";

/// Recreates the messages table if it was created with the old role CHECK
/// constraint that did not include 'memory'. Existing data is preserved.
fn migrate_memory_role(conn: &Connection) -> Result<(), AppError> {
    let version: i32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 1 {
        let sql: String = conn.query_row(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'messages'",
            [],
            |row| row.get(0),
        )?;
        if !sql.contains("'memory'") {
            conn.execute_batch(MEMORY_ROLE_MIGRATION)?;
        }
        conn.pragma_update(None, "user_version", 1)?;
    }
    Ok(())
}

/// Opens (creating if needed) the SQLite database in the app data directory,
/// applies pragmas and migrations, and returns the managed app state.
pub fn init(app: &tauri::App) -> Result<AppState, AppError> {
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;

    let conn = Connection::open(data_dir.join("black-one.db"))?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute_batch(MIGRATIONS)?;
    migrate_memory_role(&conn)?;

    Ok(AppState {
        db: std::sync::Mutex::new(conn),
        terminals: crate::state::terminal_store::TerminalManager::new(),
    })
}
