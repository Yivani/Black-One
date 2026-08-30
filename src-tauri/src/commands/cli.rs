use std::collections::HashMap;
use std::io::Read;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::State;
use uuid::Uuid;

use crate::utils::AppError;

const JOB_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const MAX_OUTPUT_BYTES: usize = 256 * 1024;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Clone, Copy)]
struct CliSpec {
    id: &'static str,
    binary: &'static str,
    package: &'static str,
}

const CLI_TOOLS: [CliSpec; 5] = [
    CliSpec {
        id: "codex",
        binary: "codex",
        package: "@openai/codex",
    },
    CliSpec {
        id: "claude",
        binary: "claude",
        package: "@anthropic-ai/claude-code",
    },
    CliSpec {
        id: "gemini",
        binary: "gemini",
        package: "@google/gemini-cli",
    },
    CliSpec {
        id: "kimi",
        binary: "kimi",
        package: "@moonshot-ai/kimi-code",
    },
    CliSpec {
        id: "opencode",
        binary: "opencode",
        package: "opencode-ai",
    },
];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliToolStatus {
    id: String,
    installed: bool,
    managed_by_npm: bool,
    version: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliJob {
    id: String,
    tool_id: String,
    action: String,
    status: String,
    message: String,
    started_at: i64,
    finished_at: Option<i64>,
}

#[derive(Clone, Default)]
pub struct CliManager {
    jobs: Arc<Mutex<HashMap<String, CliJob>>>,
    cancellations: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

fn find_tool(id: &str) -> Result<CliSpec, AppError> {
    CLI_TOOLS
        .iter()
        .copied()
        .find(|tool| tool.id == id)
        .ok_or_else(|| AppError::InvalidInput(format!("unknown CLI tool: {id}")))
}

fn npm_args(tool: CliSpec, action: &str) -> Result<Vec<String>, AppError> {
    match action {
        "install" | "update" => Ok(vec![
            "install".into(),
            "-g".into(),
            format!("{}@latest", tool.package),
        ]),
        "uninstall" => Ok(vec!["uninstall".into(), "-g".into(), tool.package.into()]),
        _ => Err(AppError::InvalidInput(format!(
            "unknown CLI action: {action}"
        ))),
    }
}

fn npm_command(args: &[String]) -> Command {
    let mut command = if cfg!(target_os = "windows") {
        Command::new("npm.cmd")
    } else {
        Command::new("npm")
    };
    command.args(args);
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

fn read_limited(mut pipe: impl Read) -> String {
    let mut buffer = vec![0u8; MAX_OUTPUT_BYTES + 1];
    let bytes_read = match pipe.read(&mut buffer) {
        Ok(n) => n,
        Err(_) => return String::new(),
    };
    buffer.truncate(bytes_read.min(MAX_OUTPUT_BYTES));
    String::from_utf8_lossy(&buffer).to_string()
}

fn stop_child(child: &mut Child) {
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("taskkill");
        command.args(["/PID", &child.id().to_string(), "/T", "/F"]);
        command.creation_flags(CREATE_NO_WINDOW);
        let _ = command.output();
    }
    #[cfg(not(target_os = "windows"))]
    let _ = child.kill();
    let _ = child.wait();
}

fn failure_message(stdout: &str, stderr: &str, exit_code: Option<i32>) -> String {
    let detail = if stderr.trim().is_empty() {
        stdout
    } else {
        stderr
    };
    let last_line = detail.lines().rev().find(|line| !line.trim().is_empty());
    match last_line {
        Some(line) => line.trim().chars().take(240).collect(),
        None => format!("npm exited with code {}", exit_code.unwrap_or(-1)),
    }
}

fn run_job(args: Vec<String>, cancelled: Arc<AtomicBool>) -> (String, String) {
    let mut process = npm_command(&args);
    process.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = match process.spawn() {
        Ok(child) => child,
        Err(error) => return ("error".into(), format!("Failed to start npm: {error}")),
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_reader = thread::spawn(move || stdout.map(read_limited).unwrap_or_default());
    let stderr_reader = thread::spawn(move || stderr.map(read_limited).unwrap_or_default());
    let started = Instant::now();

    let status = loop {
        if cancelled.load(Ordering::Relaxed) {
            stop_child(&mut child);
            break None;
        }
        if started.elapsed() >= JOB_TIMEOUT {
            stop_child(&mut child);
            break Some(Err(
                "The npm operation timed out after 10 minutes.".to_string()
            ));
        }
        match child.try_wait() {
            Ok(Some(status)) => break Some(Ok(status)),
            Ok(None) => thread::sleep(Duration::from_millis(100)),
            Err(error) => break Some(Err(error.to_string())),
        }
    };

    let stdout = stdout_reader.join().unwrap_or_default();
    let stderr = stderr_reader.join().unwrap_or_default();
    match status {
        None => ("cancelled".into(), "Cancelled by user.".into()),
        Some(Err(error)) => ("error".into(), error),
        Some(Ok(status)) if status.success() => {
            ("finished".into(), "Completed successfully.".into())
        }
        Some(Ok(status)) => (
            "error".into(),
            failure_message(&stdout, &stderr, status.code()),
        ),
    }
}

fn npm_global_root() -> Option<PathBuf> {
    let args = vec!["root".into(), "-g".into()];
    let output = match npm_command(&args).output() {
        Ok(output) => output,
        Err(_) => return None,
    };
    let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!root.is_empty()).then(|| PathBuf::from(root))
}

fn npm_package_version(package_dir: &Path) -> Option<String> {
    let content = std::fs::read(package_dir.join("package.json")).ok()?;
    serde_json::from_slice::<serde_json::Value>(&content)
        .ok()?
        .get("version")?
        .as_str()
        .map(str::to_string)
}

#[tauri::command]
pub fn list_cli_tool_statuses() -> Vec<CliToolStatus> {
    let npm_root = npm_global_root();
    CLI_TOOLS
        .iter()
        .map(|tool| {
            let package_dir = npm_root.as_ref().map(|root| root.join(tool.package));
            let managed_by_npm = package_dir.as_ref().is_some_and(|path| path.is_dir());
            CliToolStatus {
                id: tool.id.into(),
                installed: managed_by_npm || which::which(tool.binary).is_ok(),
                managed_by_npm,
                version: package_dir.as_deref().and_then(npm_package_version),
            }
        })
        .collect()
}

#[tauri::command]
pub fn list_cli_jobs(state: State<'_, CliManager>) -> Result<Vec<CliJob>, AppError> {
    let jobs = state
        .jobs
        .lock()
        .map_err(|error| AppError::InvalidInput(error.to_string()))?;
    Ok(jobs.values().cloned().collect())
}

#[tauri::command]
pub fn run_cli_operation(
    state: State<'_, CliManager>,
    tool_id: String,
    action: String,
) -> Result<CliJob, AppError> {
    let tool = find_tool(&tool_id)?;
    let args = npm_args(tool, &action)?;
    let manager = state.inner().clone();
    let job_id = Uuid::new_v4().to_string();
    let cancellation = Arc::new(AtomicBool::new(false));
    let job = CliJob {
        id: job_id.clone(),
        tool_id: tool_id.clone(),
        action: action.clone(),
        status: "running".into(),
        message: "Running in the background...".into(),
        started_at: chrono::Utc::now().timestamp_millis(),
        finished_at: None,
    };

    {
        let mut jobs = manager
            .jobs
            .lock()
            .map_err(|error| AppError::InvalidInput(error.to_string()))?;
        if jobs
            .get(&tool_id)
            .is_some_and(|job| job.status == "running" || job.status == "cancelling")
        {
            return Err(AppError::InvalidInput(format!(
                "{tool_id} already has an active operation"
            )));
        }
        jobs.insert(tool_id.clone(), job.clone());
    }
    manager
        .cancellations
        .lock()
        .map_err(|error| AppError::InvalidInput(error.to_string()))?
        .insert(job_id.clone(), cancellation.clone());

    thread::spawn(move || {
        let (status, message) = run_job(args, cancellation);
        if let Ok(mut jobs) = manager.jobs.lock() {
            if let Some(job) = jobs.get_mut(&tool_id).filter(|job| job.id == job_id) {
                job.status = status;
                job.message = message;
                job.finished_at = Some(chrono::Utc::now().timestamp_millis());
            }
        }
        if let Ok(mut cancellations) = manager.cancellations.lock() {
            cancellations.remove(&job_id);
        }
    });

    Ok(job)
}

#[tauri::command]
pub fn cancel_cli_operation(state: State<'_, CliManager>, job_id: String) -> Result<(), AppError> {
    let cancellation = state
        .cancellations
        .lock()
        .map_err(|error| AppError::InvalidInput(error.to_string()))?
        .get(&job_id)
        .cloned()
        .ok_or_else(|| AppError::NotFound(format!("CLI job {job_id}")))?;
    cancellation.store(true, Ordering::Relaxed);
    if let Ok(mut jobs) = state.jobs.lock() {
        if let Some(job) = jobs.values_mut().find(|job| job.id == job_id) {
            job.status = "cancelling".into();
            job.message = "Stopping the background process...".into();
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{find_tool, npm_args};

    #[test]
    fn only_known_cli_commands_are_built() {
        let codex = find_tool("codex").unwrap();
        assert_eq!(
            npm_args(codex, "install").unwrap(),
            ["install", "-g", "@openai/codex@latest"]
        );
        assert_eq!(
            npm_args(codex, "uninstall").unwrap(),
            ["uninstall", "-g", "@openai/codex"]
        );
        assert!(find_tool("unknown").is_err());
        assert!(npm_args(codex, "delete-everything").is_err());
    }
}
