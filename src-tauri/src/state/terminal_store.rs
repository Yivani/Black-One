use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use base64::Engine;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::ipc::Channel;

use crate::utils::AppError;

#[derive(Clone, serde::Serialize)]
pub struct TerminalSummary {
    pub id: String,
    pub title: String,
    pub shell: String,
}

#[derive(Clone, serde::Serialize)]
pub struct TerminalOutputEvent {
    pub id: String,
    pub data: String,
}

#[derive(Clone, serde::Serialize)]
pub struct TerminalClosedEvent {
    pub id: String,
}

/// Events streamed from a terminal session to the frontend.
#[derive(Clone, serde::Serialize)]
#[serde(tag = "kind", content = "payload")]
pub enum TerminalEvent {
    Output(TerminalOutputEvent),
    Closed(TerminalClosedEvent),
}

pub struct TerminalSession {
    pub id: String,
    pub title: String,
    pub shell: String,
    pub _master: Box<dyn MasterPty + Send>,
    pub child: Box<dyn Child + Send>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

/// Description of a shell we can spawn inside the PTY.
struct Shell {
    name: &'static str,
    program: String,
    args: Vec<String>,
}

impl Shell {
    fn display_name(&self) -> String {
        Path::new(&self.program)
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or(self.name)
            .to_string()
    }
}

fn home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE")
            .ok()
            .map(PathBuf::from)
            .or_else(|| std::env::var("HOME").ok().map(PathBuf::from))
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}

fn resolve_program(name: &str) -> Option<String> {
    which::which(name)
        .ok()
        .map(|p| p.to_string_lossy().to_string())
}

/// Returns the available shells for the current platform, ordered from most to
/// least desirable default. On Windows the default is CMD because it is the
/// simplest and most reliable shell inside ConPTY; PowerShell 7 and WSL are
/// offered when available.
fn available_shells() -> Vec<Shell> {
    #[cfg(target_os = "windows")]
    {
        let mut shells = Vec::new();

        if let Some(pwsh) = resolve_program("pwsh.exe") {
            shells.push(Shell {
                name: "pwsh",
                program: pwsh,
                // -NoExit keeps the shell alive in the PTY. We do not use
                // -Command - because that puts PowerShell into a non-interactive
                // stdin-reading mode that often suppresses the prompt on Windows.
                args: vec!["-NoLogo".into(), "-NoExit".into()],
            });
        }

        if let Some(ps) = resolve_program("powershell.exe") {
            shells.push(Shell {
                name: "powershell",
                program: ps,
                args: vec!["-NoLogo".into(), "-NoExit".into()],
            });
        }

        if let Some(cmd) = resolve_program("cmd.exe") {
            shells.push(Shell {
                name: "cmd",
                program: cmd,
                args: vec!["/k".into()],
            });
        }

        if let Some(wsl) = resolve_program("wsl.exe") {
            shells.push(Shell {
                name: "wsl",
                program: wsl,
                args: vec![],
            });
        }

        shells
    }
    #[cfg(target_os = "macos")]
    {
        let mut shells = Vec::new();
        if let Some(zsh) = resolve_program("zsh") {
            shells.push(Shell {
                name: "zsh",
                program: zsh,
                args: vec!["-l".into()],
            });
        }
        if let Some(bash) = resolve_program("bash") {
            shells.push(Shell {
                name: "bash",
                program: bash,
                args: vec!["-l".into()],
            });
        }
        shells
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let mut shells = Vec::new();
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        shells.push(Shell {
            name: "default",
            program: shell,
            args: vec!["-l".into()],
        });
        shells
    }
}

fn pick_shell(requested: Option<&str>) -> Result<Shell, AppError> {
    let shells = available_shells();
    if shells.is_empty() {
        return Err(AppError::Pty(
            "no usable shell found on this system".to_string(),
        ));
    }

    if let Some(req) = requested {
        let req_lower = req.to_lowercase();
        if let Some(shell) = shells.iter().find(|s| s.name == req_lower) {
            return Ok(Shell {
                name: shell.name,
                program: shell.program.clone(),
                args: shell.args.clone(),
            });
        }
        // Allow matching by executable stem too, e.g. "cmd" or "powershell".
        if let Some(shell) = shells.iter().find(|s| {
            Path::new(&s.program)
                .file_stem()
                .and_then(|n| n.to_str())
                .map(|n| n.to_lowercase())
                .as_deref()
                == Some(req_lower.as_str())
        }) {
            return Ok(Shell {
                name: shell.name,
                program: shell.program.clone(),
                args: shell.args.clone(),
            });
        }
    }

    Ok(Shell {
        name: shells[0].name,
        program: shells[0].program.clone(),
        args: shells[0].args.clone(),
    })
}

fn shell_display_name(shell: &Shell) -> String {
    shell.display_name()
}

fn title_for_shell(shell: &Shell, cwd: Option<&str>) -> String {
    let cwd_label = cwd
        .map(|d| {
            let path = Path::new(d);
            path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(d)
                .to_string()
        })
        .unwrap_or_else(|| "~".to_string());
    format!("{} — {}", shell_display_name(shell), cwd_label)
}

#[derive(Default)]
pub struct TerminalManager {
    sessions: Mutex<HashMap<String, TerminalSession>>,
    channel: Mutex<Option<Channel<TerminalEvent>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            channel: Mutex::new(None),
        }
    }

    /// Registers the frontend channel that all terminal output/closed events
    /// will be streamed through. Must be called before creating terminals.
    pub fn register_channel(&self, channel: Channel<TerminalEvent>) -> Result<(), AppError> {
        let mut ch = self
            .channel
            .lock()
            .map_err(|e| AppError::InvalidInput(e.to_string()))?;
        *ch = Some(channel);
        Ok(())
    }

    fn get_channel(&self) -> Result<Channel<TerminalEvent>, AppError> {
        self.channel
            .lock()
            .map_err(|e| AppError::InvalidInput(e.to_string()))?
            .clone()
            .ok_or_else(|| AppError::Pty("terminal channel not registered".to_string()))
    }

    pub fn create(
        &self,
        cwd: Option<String>,
        shell: Option<String>,
    ) -> Result<TerminalSummary, AppError> {
        let channel = self.get_channel()?;

        let id = uuid::Uuid::new_v4().to_string();
        let shell = pick_shell(shell.as_deref())?;
        let cwd = cwd
            .filter(|d| !d.trim().is_empty())
            .or_else(|| home_dir().map(|p| p.to_string_lossy().to_string()));

        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            cols: 80,
            rows: 24,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut cmd = CommandBuilder::new(&shell.program);
        if let Some(ref dir) = cwd {
            cmd.cwd(dir);
        }
        for arg in &shell.args {
            cmd.arg(arg);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        // Prevent PowerShell from starting in a non-interactive pipeline mode.
        #[cfg(target_os = "windows")]
        {
            cmd.env("POWERSHELL_TELEMETRY_OPTOUT", "1");
        }

        let child = pair.slave.spawn_command(cmd)?;
        let writer = pair.master.take_writer()?;
        let mut reader = pair.master.try_clone_reader()?;
        let writer = Arc::new(Mutex::new(writer));

        let id_for_thread = id.clone();
        let channel_for_thread = channel.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 1024];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        break;
                    }
                    Ok(n) => {
                        let data = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                        let _ =
                            channel_for_thread.send(TerminalEvent::Output(TerminalOutputEvent {
                                id: id_for_thread.clone(),
                                data,
                            }));
                    }
                    Err(_) => break,
                }
            }
            let _ = channel_for_thread.send(TerminalEvent::Closed(TerminalClosedEvent {
                id: id_for_thread,
            }));
        });

        let title = title_for_shell(&shell, cwd.as_deref());
        let summary = TerminalSummary {
            id: id.clone(),
            title: title.clone(),
            shell: shell_display_name(&shell),
        };

        let session = TerminalSession {
            id,
            title,
            shell: shell_display_name(&shell),
            _master: pair.master,
            child,
            writer,
        };

        self.sessions
            .lock()
            .map_err(|e| AppError::InvalidInput(e.to_string()))?
            .insert(session.id.clone(), session);

        Ok(summary)
    }

    pub fn write(&self, id: &str, data: &str) -> Result<(), AppError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::InvalidInput(e.to_string()))?;
        let session = sessions
            .get(id)
            .ok_or_else(|| AppError::NotFound(format!("terminal {id}")))?;
        let mut writer = session
            .writer
            .lock()
            .map_err(|e| AppError::InvalidInput(e.to_string()))?;
        writer.write_all(data.as_bytes())?;
        writer.flush()?;
        Ok(())
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), AppError> {
        if cols == 0 || rows == 0 {
            return Ok(());
        }
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::InvalidInput(e.to_string()))?;
        let session = sessions
            .get(id)
            .ok_or_else(|| AppError::NotFound(format!("terminal {id}")))?;
        session._master.resize(PtySize {
            cols,
            rows,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }

    pub fn close(&self, id: &str) -> Result<(), AppError> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::InvalidInput(e.to_string()))?;
        if let Some(mut session) = sessions.remove(id) {
            let _ = session.child.kill();
        }
        Ok(())
    }

    pub fn list(&self) -> Result<Vec<TerminalSummary>, AppError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::InvalidInput(e.to_string()))?;
        Ok(sessions
            .values()
            .map(|s| TerminalSummary {
                id: s.id.clone(),
                title: s.title.clone(),
                shell: s.shell.clone(),
            })
            .collect())
    }
}
