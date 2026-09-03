use tauri::ipc::Channel;
use tauri::State;

use crate::state::app_state::AppState;
use crate::state::terminal_store::{TerminalEvent, TerminalSummary};
use crate::utils::AppError;

#[tauri::command]
pub fn register_terminal_channel(
    state: State<'_, AppState>,
    channel: Channel<TerminalEvent>,
) -> Result<(), AppError> {
    state.terminals.register_channel(channel)
}

#[tauri::command]
pub fn create_terminal(
    state: State<'_, AppState>,
    cwd: Option<String>,
    shell: Option<String>,
) -> Result<TerminalSummary, AppError> {
    state.terminals.create(cwd, shell)
}

#[tauri::command]
pub fn write_terminal(
    state: State<'_, AppState>,
    id: String,
    data: String,
) -> Result<(), AppError> {
    state.terminals.write(&id, &data)
}

#[tauri::command]
pub fn resize_terminal(
    state: State<'_, AppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), AppError> {
    state.terminals.resize(&id, cols, rows)
}

#[tauri::command]
pub fn close_terminal(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.terminals.close(&id)
}

#[tauri::command]
pub fn list_terminals(state: State<'_, AppState>) -> Result<Vec<TerminalSummary>, AppError> {
    state.terminals.list()
}

/// Names the program holding a terminal, or null when it is at its prompt.
#[tauri::command]
pub fn terminal_busy(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, AppError> {
    state.terminals.busy(&id)
}
