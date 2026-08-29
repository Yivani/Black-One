use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database error: {0}")]
    Rusqlite(#[from] rusqlite::Error),
    #[error("keyring error: {0}")]
    Keyring(String),
    #[error("http error: {0}")]
    Http(String),
    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("pty error: {0}")]
    Pty(String),
}

impl From<anyhow::Error> for AppError {
    fn from(error: anyhow::Error) -> Self {
        AppError::Pty(error.to_string())
    }
}

// Tauri commands require errors to be serializable; send them as plain strings.
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
