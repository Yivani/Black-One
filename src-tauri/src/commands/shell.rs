use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::utils::AppError;

const SHELL_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_OUTPUT_BYTES: usize = 256 * 1024; // 256 KiB

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
}

fn is_path_inside(root: &str, target: &str) -> bool {
    let root_path = std::path::Path::new(root);
    let target_path = std::path::Path::new(target);
    let Ok(canonical_root) = std::fs::canonicalize(root_path) else {
        return false;
    };
    let Ok(canonical_target) = std::fs::canonicalize(target_path) else {
        let Some(parent) = target_path.parent() else {
            return false;
        };
        let Ok(canonical_parent) = std::fs::canonicalize(parent) else {
            return false;
        };
        return canonical_parent == canonical_root
            || canonical_parent.starts_with(&canonical_root);
    };
    canonical_target == canonical_root || canonical_target.starts_with(&canonical_root)
}

/// Executes a one-shot shell command with a timeout. Captures stdout/stderr.
/// If `roots` is provided, `cwd` must be inside one of them.
#[tauri::command]
pub fn execute_shell_command(
    command: String,
    cwd: Option<String>,
    roots: Option<Vec<String>>,
) -> Result<ShellResult, AppError> {
    let cwd = cwd.unwrap_or_else(|| ".".to_string());

    if let Some(roots) = roots {
        if !roots.iter().any(|root| is_path_inside(root, &cwd)) {
            return Err(AppError::InvalidInput(format!(
                "working directory is outside allowed folders: {cwd}"
            )));
        }
    }

    // Basic shell invocation using the OS default shell.
    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };

    let mut child = Command::new(shell)
        .arg(flag)
        .arg(&command)
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(AppError::Io)?;

    let stdout_pipe = child.stdout.take().ok_or_else(|| {
        AppError::InvalidInput("failed to capture stdout".to_string())
    })?;
    let stderr_pipe = child.stderr.take().ok_or_else(|| {
        AppError::InvalidInput("failed to capture stderr".to_string())
    })?;

    let (stdout_tx, stdout_rx) = mpsc::channel::<String>();
    let (stderr_tx, stderr_rx) = mpsc::channel::<String>();

    thread::spawn(move || {
        let _ = stdout_tx.send(read_limited(stdout_pipe));
    });
    thread::spawn(move || {
        let _ = stderr_tx.send(read_limited(stderr_pipe));
    });

    let start = std::time::Instant::now();
    let status = loop {
        match child.try_wait().map_err(AppError::Io)? {
            Some(status) => break status,
            None => {
                if start.elapsed() >= SHELL_TIMEOUT {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Ok(ShellResult {
                        stdout: stdout_rx.recv().unwrap_or_default(),
                        stderr: stderr_rx.recv().unwrap_or_default(),
                        exit_code: None,
                        timed_out: true,
                    });
                }
                thread::sleep(Duration::from_millis(50));
            }
        }
    };

    Ok(ShellResult {
        stdout: stdout_rx.recv().unwrap_or_default(),
        stderr: stderr_rx.recv().unwrap_or_default(),
        exit_code: status.code(),
        timed_out: false,
    })
}

fn read_limited(mut pipe: impl Read) -> String {
    let mut buffer = vec![0u8; MAX_OUTPUT_BYTES + 1];
    let bytes_read = match pipe.read(&mut buffer) {
        Ok(n) => n,
        Err(_) => return String::new(),
    };
    buffer.truncate(bytes_read);
    if buffer.len() > MAX_OUTPUT_BYTES {
        let mut text = String::from_utf8_lossy(&buffer[..MAX_OUTPUT_BYTES]).to_string();
        text.push_str("\n… output truncated");
        text
    } else {
        String::from_utf8_lossy(&buffer).to_string()
    }
}
