use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use super::lock_db;
use crate::state::AppState;
use crate::utils::AppError;

const SESSION_COLUMNS: &str = "id, title, description, created_at, updated_at, archived, \
     pinned, folder_id, model_id, system_prompt, message_count, metadata";

const MESSAGE_COLUMNS: &str = "id, session_id, role, content, created_at, tokens_used, \
     model_id, parent_id, status, citations, attachments, metadata";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRow {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub archived: bool,
    pub pinned: bool,
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default)]
    pub model_id: Option<String>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    pub message_count: i64,
    #[serde(default)]
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageRow {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: i64,
    #[serde(default)]
    pub tokens_used: Option<i64>,
    #[serde(default)]
    pub model_id: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
    pub status: String,
    #[serde(default)]
    pub citations: Option<String>,
    #[serde(default)]
    pub attachments: Option<String>,
    #[serde(default)]
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderRow {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    pub created_at: i64,
    pub sort_order: i64,
}

fn session_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SessionRow> {
    Ok(SessionRow {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        archived: row.get(5)?,
        pinned: row.get(6)?,
        folder_id: row.get(7)?,
        model_id: row.get(8)?,
        system_prompt: row.get(9)?,
        message_count: row.get(10)?,
        metadata: row.get(11)?,
    })
}

fn message_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<MessageRow> {
    Ok(MessageRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        role: row.get(2)?,
        content: row.get(3)?,
        created_at: row.get(4)?,
        tokens_used: row.get(5)?,
        model_id: row.get(6)?,
        parent_id: row.get(7)?,
        status: row.get(8)?,
        citations: row.get(9)?,
        attachments: row.get(10)?,
        metadata: row.get(11)?,
    })
}

fn write_session(
    conn: &Connection,
    session: &SessionRow,
    or_replace: bool,
) -> Result<(), AppError> {
    let verb = if or_replace {
        "INSERT OR REPLACE"
    } else {
        "INSERT"
    };
    let sql = format!(
        "{verb} INTO sessions ({SESSION_COLUMNS}) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
    );
    conn.execute(
        &sql,
        params![
            session.id,
            session.title,
            session.description,
            session.created_at,
            session.updated_at,
            session.archived,
            session.pinned,
            session.folder_id,
            session.model_id,
            session.system_prompt,
            session.message_count,
            session.metadata,
        ],
    )?;
    Ok(())
}

fn write_message(
    conn: &Connection,
    message: &MessageRow,
    or_replace: bool,
) -> Result<(), AppError> {
    let verb = if or_replace {
        "INSERT OR REPLACE"
    } else {
        "INSERT"
    };
    let sql = format!(
        "{verb} INTO messages ({MESSAGE_COLUMNS}) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
    );
    conn.execute(
        &sql,
        params![
            message.id,
            message.session_id,
            message.role,
            message.content,
            message.created_at,
            message.tokens_used,
            message.model_id,
            message.parent_id,
            message.status,
            message.citations,
            message.attachments,
            message.metadata,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn list_sessions(
    state: State<'_, AppState>,
    include_archived: bool,
) -> Result<Vec<SessionRow>, AppError> {
    let conn = lock_db(&state)?;
    let sql = if include_archived {
        format!("SELECT {SESSION_COLUMNS} FROM sessions ORDER BY updated_at DESC")
    } else {
        format!(
            "SELECT {SESSION_COLUMNS} FROM sessions WHERE archived = 0 ORDER BY updated_at DESC"
        )
    };
    let mut stmt = conn.prepare(&sql)?;
    let sessions = stmt
        .query_map([], session_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(sessions)
}

#[tauri::command]
pub fn create_session(state: State<'_, AppState>, session: SessionRow) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    write_session(&conn, &session, false)
}

#[tauri::command]
pub fn update_session(state: State<'_, AppState>, session: SessionRow) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    write_session(&conn, &session, true)
}

#[tauri::command]
pub fn delete_session(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM messages WHERE session_id = ?1", params![id])?;
    conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn list_messages(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<MessageRow>, AppError> {
    let conn = lock_db(&state)?;
    let sql = format!(
        "SELECT {MESSAGE_COLUMNS} FROM messages WHERE session_id = ?1 ORDER BY created_at ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let messages = stmt
        .query_map(params![session_id], message_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(messages)
}

#[tauri::command]
pub fn add_message(state: State<'_, AppState>, message: MessageRow) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    write_message(&conn, &message, false)
}

#[tauri::command]
pub fn update_message(state: State<'_, AppState>, message: MessageRow) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    write_message(&conn, &message, true)
}

#[tauri::command]
pub fn delete_messages_from(
    state: State<'_, AppState>,
    session_id: String,
    message_id: String,
) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    let created_at: i64 = conn
        .query_row(
            "SELECT created_at FROM messages WHERE id = ?1",
            params![message_id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("message {message_id}"))
            }
            other => AppError::Rusqlite(other),
        })?;
    conn.execute(
        "DELETE FROM messages WHERE session_id = ?1 AND created_at >= ?2",
        params![session_id, created_at],
    )?;
    Ok(())
}

#[tauri::command]
pub fn list_folders(state: State<'_, AppState>) -> Result<Vec<FolderRow>, AppError> {
    let conn = lock_db(&state)?;
    let mut stmt = conn.prepare(
        "SELECT id, name, color, created_at, sort_order FROM folders ORDER BY sort_order ASC",
    )?;
    let folders = stmt
        .query_map([], |row| {
            Ok(FolderRow {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(folders)
}

#[tauri::command]
pub fn create_folder(state: State<'_, AppState>, folder: FolderRow) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT INTO folders (id, name, color, created_at, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            folder.id,
            folder.name,
            folder.color,
            folder.created_at,
            folder.sort_order
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn update_folder(state: State<'_, AppState>, folder: FolderRow) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT OR REPLACE INTO folders (id, name, color, created_at, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![folder.id, folder.name, folder.color, folder.created_at, folder.sort_order],
    )?;
    Ok(())
}

#[tauri::command]
pub fn delete_folder(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let conn = lock_db(&state)?;
    conn.execute(
        "UPDATE sessions SET folder_id = NULL WHERE folder_id = ?1",
        params![id],
    )?;
    conn.execute("DELETE FROM folders WHERE id = ?1", params![id])?;
    Ok(())
}
