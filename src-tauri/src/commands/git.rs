use std::{path::PathBuf, process::Command};

use serde::Serialize;

use crate::utils::AppError;

const MAX_DIFF_CHARS: usize = 16_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    repository: bool,
    root_path: String,
    branch: String,
    remote_url: Option<String>,
    changes: Vec<String>,
}

fn directory(path: &str) -> Result<PathBuf, AppError> {
    let path = std::fs::canonicalize(path)?;
    if !path.is_dir() {
        return Err(AppError::InvalidInput(
            "Git path must be a directory".into(),
        ));
    }
    Ok(path)
}

fn output(path: &PathBuf, args: &[&str]) -> Result<std::process::Output, AppError> {
    Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "Never")
        .output()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                AppError::InvalidInput("Git is not installed or is not on PATH".into())
            } else {
                AppError::Io(error)
            }
        })
}

fn text(output: &std::process::Output) -> String {
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

fn run(path: &PathBuf, args: &[&str]) -> Result<String, AppError> {
    let result = output(path, args)?;
    if result.status.success() {
        return Ok(text(&result));
    }
    let error = String::from_utf8_lossy(&result.stderr).trim().to_string();
    Err(AppError::InvalidInput(if error.is_empty() {
        format!("git {} failed", args.join(" "))
    } else {
        error
    }))
}

fn status_for(path: &PathBuf) -> Result<GitStatus, AppError> {
    let root = output(path, &["rev-parse", "--show-toplevel"])?;
    if !root.status.success() {
        return Ok(GitStatus {
            repository: false,
            root_path: path.to_string_lossy().into_owned(),
            branch: String::new(),
            remote_url: None,
            changes: Vec::new(),
        });
    }

    let root_path = text(&root);
    let branch = run(path, &["branch", "--show-current"])?;
    let changes = run(path, &["status", "--short"])?
        .lines()
        .map(str::to_owned)
        .collect();
    let remote = output(path, &["remote", "get-url", "origin"])?;

    Ok(GitStatus {
        repository: true,
        root_path,
        branch: if branch.is_empty() {
            "HEAD".into()
        } else {
            branch
        },
        remote_url: remote.status.success().then(|| text(&remote)),
        changes,
    })
}

fn truncate(value: String) -> String {
    value.chars().take(MAX_DIFF_CHARS).collect()
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatus, AppError> {
    status_for(&directory(&path)?)
}

#[tauri::command]
pub fn git_init(path: String) -> Result<GitStatus, AppError> {
    let path = directory(&path)?;
    run(&path, &["init"])?;
    status_for(&path)
}

#[tauri::command]
pub fn git_stage_all(path: String) -> Result<GitStatus, AppError> {
    let path = directory(&path)?;
    run(&path, &["add", "--all"])?;
    status_for(&path)
}

#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<GitStatus, AppError> {
    let path = directory(&path)?;
    let message = message.trim();
    if message.is_empty() || message.chars().count() > 200 {
        return Err(AppError::InvalidInput(
            "Commit message must be between 1 and 200 characters".into(),
        ));
    }
    run(&path, &["commit", "-m", message])?;
    status_for(&path)
}

#[tauri::command]
pub fn git_set_remote(path: String, url: String) -> Result<GitStatus, AppError> {
    let path = directory(&path)?;
    let url = url.trim();
    if url.is_empty() || url.chars().count() > 2048 {
        return Err(AppError::InvalidInput("Enter a valid remote URL".into()));
    }
    let existing = output(&path, &["remote", "get-url", "origin"])?;
    if existing.status.success() {
        run(&path, &["remote", "set-url", "origin", url])?;
    } else {
        run(&path, &["remote", "add", "origin", url])?;
    }
    status_for(&path)
}

#[tauri::command]
pub fn git_push(path: String) -> Result<GitStatus, AppError> {
    let path = directory(&path)?;
    let first = output(&path, &["push"])?;
    if !first.status.success() {
        let error = String::from_utf8_lossy(&first.stderr);
        if error.contains("no upstream branch") {
            run(&path, &["push", "--set-upstream", "origin", "HEAD"])?;
        } else {
            return Err(AppError::InvalidInput(error.trim().to_string()));
        }
    }
    status_for(&path)
}

#[tauri::command]
pub fn git_diff(path: String) -> Result<String, AppError> {
    let path = directory(&path)?;
    let status = run(&path, &["status", "--short"])?;
    let diff = output(&path, &["diff", "--no-color", "HEAD", "--"])?;
    let diff = if diff.status.success() {
        text(&diff)
    } else {
        String::new()
    };
    Ok(truncate(format!(
        "Changed files:\n{status}\n\nDiff:\n{diff}"
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diff_is_bounded_without_splitting_unicode() {
        let value = "Ã¤".repeat(MAX_DIFF_CHARS + 10);
        let result = truncate(value);
        assert_eq!(result.chars().count(), MAX_DIFF_CHARS);
        assert!(result.is_char_boundary(result.len()));
    }

    #[test]
    fn initializes_and_stages_a_repository() {
        let dir = std::env::temp_dir().join(format!("black-one-git-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&dir).unwrap();
        let path = dir.to_string_lossy().into_owned();

        assert!(git_init(path.clone()).unwrap().repository);
        std::fs::write(dir.join("example.txt"), "hello").unwrap();
        assert_eq!(
            git_status(path.clone()).unwrap().changes,
            ["?? example.txt"]
        );
        assert_eq!(git_stage_all(path).unwrap().changes, ["A  example.txt"]);

        std::fs::remove_dir_all(dir).unwrap();
    }
}
