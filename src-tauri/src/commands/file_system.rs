use serde::{Deserialize, Serialize};
use std::io::Write;
use std::sync::{Mutex, MutexGuard};
use tauri::Manager;

use crate::utils::AppError;

const MAX_TEXT_FILE_SIZE: u64 = 1024 * 1024; // 1 MiB
const MAX_SOUND_FILE_SIZE: u64 = 5 * 1024 * 1024; // 5 MiB
const MEDIA_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "mp4", "webm", "mov",
    "m4v", "ogv", "mp3", "wav", "ogg", "m4a", "aac", "flac",
];
static MEMORY_FILE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

/// Reads a text file. Refuses to read outside any of the provided roots unless
/// `roots` is absent — reads are sandboxed exactly like writes, because a read
/// the agent was never granted is an exfiltration path.
#[tauri::command]
pub fn read_file_text(path: String, roots: Option<Vec<String>>) -> Result<String, AppError> {
    ensure_within_roots(&path, roots.as_deref())?;
    let path_ref = std::path::Path::new(&path);
    let metadata = std::fs::metadata(path_ref).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            AppError::InvalidInput(format!("file does not exist: {path}"))
        } else {
            AppError::Io(e)
        }
    })?;
    if !metadata.is_file() {
        return Err(AppError::InvalidInput(format!("not a file: {path}")));
    }
    if metadata.len() > MAX_TEXT_FILE_SIZE {
        return Err(AppError::InvalidInput(format!(
            "file exceeds the {MAX_TEXT_FILE_SIZE} byte limit: {path}"
        )));
    }
    std::fs::read_to_string(path_ref).map_err(|e| {
        if e.kind() == std::io::ErrorKind::InvalidData {
            AppError::InvalidInput("not a text file".to_string())
        } else {
            AppError::Io(e)
        }
    })
}

/// Lists a directory. Sandboxed to `roots` on the same terms as `read_file_text`.
#[tauri::command]
pub fn read_dir_entries(
    path: String,
    roots: Option<Vec<String>>,
) -> Result<Vec<DirEntry>, AppError> {
    ensure_within_roots(&path, roots.as_deref())?;
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&path)? {
        let entry = entry?;
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: entry.path().to_string_lossy().into_owned(),
            is_dir: metadata.is_dir(),
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
pub fn allow_media_preview(app: tauri::AppHandle, path: String) -> Result<String, AppError> {
    let path = std::fs::canonicalize(path)?;
    if !path.is_file() {
        return Err(AppError::InvalidInput("Media preview path must be a file".into()));
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();
    if !MEDIA_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError::InvalidInput("Unsupported media format".into()));
    }
    app.asset_protocol_scope().allow_file(&path)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn get_data_dir(app: tauri::AppHandle) -> Result<String, AppError> {
    let dir = app.path().app_data_dir()?;
    Ok(dir.to_string_lossy().into_owned())
}

/// Opens a file picker for an audio file, copies it into the app data
/// directory under `sounds/`, and returns the absolute path of the copy.
/// Returns `None` if the user cancels the dialog.
#[tauri::command]
pub async fn pick_sound_file(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    use tauri_plugin_dialog::DialogExt;

    let Some(file_path) = app
        .dialog()
        .file()
        .add_filter("Audio", &["wav", "mp3", "ogg", "m4a", "aac", "flac", "webm"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };

    let source = file_path.as_path().ok_or_else(|| {
        AppError::InvalidInput("Invalid file path returned by dialog".to_string())
    })?;

    let metadata = std::fs::metadata(source)?;
    if metadata.len() > MAX_SOUND_FILE_SIZE {
        return Err(AppError::InvalidInput(format!(
            "Sound file exceeds the {} MiB limit",
            MAX_SOUND_FILE_SIZE / (1024 * 1024)
        )));
    }

    let data_dir = app.path().app_data_dir()?;
    let sounds_dir = data_dir.join("sounds");
    std::fs::create_dir_all(&sounds_dir)?;

    let file_name = source
        .file_name()
        .ok_or_else(|| AppError::InvalidInput("Invalid file name".to_string()))?;
    let mut dest = sounds_dir.join(file_name);

    if dest.exists() {
        let stem = source.file_stem().unwrap_or_default();
        let ext = source.extension().unwrap_or_default();
        let mut counter = 1;
        loop {
            let candidate = sounds_dir.join(format!(
                "{}-{}.{}",
                stem.to_string_lossy(),
                counter,
                ext.to_string_lossy()
            ));
            if !candidate.exists() {
                dest = candidate;
                break;
            }
            counter += 1;
        }
    }

    std::fs::copy(source, &dest)?;
    Ok(Some(dest.to_string_lossy().into_owned()))
}

/// Opens a folder picker and returns the selected directory path.
/// Returns `None` if the user cancels the dialog.
#[tauri::command]
pub async fn pick_workspace_folder(
    app: tauri::AppHandle,
) -> Result<Option<String>, AppError> {
    use tauri_plugin_dialog::DialogExt;

    let Some(folder_path) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };

    let path = folder_path.as_path().ok_or_else(|| {
        AppError::InvalidInput("Invalid folder path returned by dialog".to_string())
    })?;

    Ok(Some(path.to_string_lossy().into_owned()))
}

const MAX_MEMORY_FILE_SIZE: u64 = 1024 * 1024; // 1 MiB

fn lock_memory_file() -> Result<MutexGuard<'static, ()>, AppError> {
    MEMORY_FILE_LOCK
        .lock()
        .map_err(|_| AppError::Io(std::io::Error::other("memory file lock poisoned")))
}

fn memory_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, AppError> {
    let data_dir = app.path().app_data_dir()?;
    Ok(data_dir.join("memory"))
}

/// Reads the private memory JSONL file, creating an empty file and directory if
/// they do not exist. Rejects files larger than 1 MiB.
#[tauri::command]
pub fn read_memory_file(app: tauri::AppHandle) -> Result<String, AppError> {
    let _guard = lock_memory_file()?;
    let dir = memory_dir(&app)?;
    std::fs::create_dir_all(&dir)?;

    let path = dir.join("memory.jsonl");
    let temp_path = dir.join("memory.jsonl.tmp");
    let backup_path = dir.join("memory.jsonl.bak");
    if !path.exists() && temp_path.exists() {
        std::fs::rename(&temp_path, &path)?;
    } else if !path.exists() && backup_path.exists() {
        std::fs::rename(&backup_path, &path)?;
    }
    if path.exists() {
        let _ = std::fs::remove_file(&temp_path);
        let _ = std::fs::remove_file(&backup_path);
    }
    if !path.exists() {
        std::fs::File::create(&path)?;
        return Ok(String::new());
    }

    let metadata = std::fs::metadata(&path)?;
    if metadata.len() > MAX_MEMORY_FILE_SIZE {
        return Err(AppError::InvalidInput(format!(
            "memory file exceeds the {MAX_MEMORY_FILE_SIZE} byte limit"
        )));
    }

    std::fs::read_to_string(&path).map_err(AppError::Io)
}

/// Atomically writes the memory JSONL file (temp file + rename). Enforces a
/// 1 MiB content limit and creates the directory if needed.
#[tauri::command]
pub fn write_memory_file(app: tauri::AppHandle, content: String) -> Result<(), AppError> {
    if content.len() > MAX_MEMORY_FILE_SIZE as usize {
        return Err(AppError::InvalidInput(format!(
            "memory content exceeds the {MAX_MEMORY_FILE_SIZE} byte limit"
        )));
    }

    let _guard = lock_memory_file()?;
    let dir = memory_dir(&app)?;
    std::fs::create_dir_all(&dir)?;

    let path = dir.join("memory.jsonl");
    let temp_path = dir.join("memory.jsonl.tmp");
    let backup_path = dir.join("memory.jsonl.bak");

    let mut temp_file = std::fs::File::create(&temp_path)?;
    temp_file.write_all(content.as_bytes())?;
    temp_file.sync_all()?;
    drop(temp_file);

    if backup_path.exists() {
        std::fs::remove_file(&backup_path)?;
    }
    if path.exists() {
        std::fs::rename(&path, &backup_path)?;
    }
    if let Err(error) = std::fs::rename(&temp_path, &path) {
        if backup_path.exists() {
            let _ = std::fs::rename(&backup_path, &path);
        }
        let _ = std::fs::remove_file(&temp_path);
        return Err(AppError::Io(error));
    }
    let _ = std::fs::remove_file(&backup_path);

    Ok(())
}

/// Writes text to a file, creating parent directories if needed.
/// Refuses to write outside any of the provided roots unless roots is empty.
#[tauri::command]
pub fn write_file_text(
    path: String,
    content: String,
    roots: Option<Vec<String>>,
) -> Result<(), AppError> {
    let path_ref = std::path::Path::new(&path);
    ensure_within_roots(&path, roots.as_deref())?;
    if let Some(parent) = path_ref.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path_ref, content).map_err(AppError::Io)
}

/// Creates a directory and all parent directories.
#[tauri::command]
pub fn create_dir_command(path: String, roots: Option<Vec<String>>) -> Result<(), AppError> {
    ensure_within_roots(&path, roots.as_deref())?;
    std::fs::create_dir_all(&path).map_err(AppError::Io)
}

/// Deletes a file.
#[tauri::command]
pub fn delete_file(path: String, roots: Option<Vec<String>>) -> Result<(), AppError> {
    ensure_within_roots(&path, roots.as_deref())?;
    std::fs::remove_file(&path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            AppError::InvalidInput(format!("file does not exist: {path}"))
        } else {
            AppError::Io(e)
        }
    })
}

/// Deletes an empty directory.
#[tauri::command]
pub fn delete_dir(path: String, roots: Option<Vec<String>>) -> Result<(), AppError> {
    ensure_within_roots(&path, roots.as_deref())?;
    std::fs::remove_dir(&path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            AppError::InvalidInput(format!("directory does not exist: {path}"))
        } else {
            AppError::Io(e)
        }
    })
}

/// Renames or moves a file/directory.
#[tauri::command]
pub fn rename_file(
    from: String,
    to: String,
    roots: Option<Vec<String>>,
) -> Result<(), AppError> {
    ensure_within_roots(&from, roots.as_deref())?;
    ensure_within_roots(&to, roots.as_deref())?;
    std::fs::rename(&from, &to).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            AppError::InvalidInput(format!("source does not exist: {from}"))
        } else {
            AppError::Io(e)
        }
    })
}

/// Shared guard for every path-taking command.
///
/// `None` means the caller opted out of the workspace restriction (internal
/// callers such as attachment previews). `Some(&[])` denies everything: "no
/// workspace configured" must never read as "any workspace".
fn ensure_within_roots(path: &str, roots: Option<&[String]>) -> Result<(), AppError> {
    let Some(roots) = roots else {
        return Ok(());
    };
    if roots.iter().any(|root| is_path_inside(root, path)) {
        return Ok(());
    }
    Err(AppError::InvalidInput(format!(
        "path is outside allowed folders: {path}"
    )))
}

/// Canonicalizing containment check exposed to the frontend, for callers that
/// act on a path without going through one of the commands above (the
/// terminal-backed shell path).
#[tauri::command]
pub fn path_within_roots(path: String, roots: Vec<String>) -> Result<bool, AppError> {
    if roots.is_empty() {
        return Ok(false);
    }
    Ok(roots.iter().any(|root| is_path_inside(root, &path)))
}

fn is_path_inside(root: &str, target: &str) -> bool {
    let root_path = std::path::Path::new(root);
    let target_path = std::path::Path::new(target);
    let Ok(canonical_root) = std::fs::canonicalize(root_path) else {
        return false;
    };
    let Ok(canonical_target) = std::fs::canonicalize(target_path) else {
        // If target doesn't exist yet, canonicalize its parent and append the name.
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

/// Removes the memory JSONL file and its rendered Markdown copy, ignoring
/// missing files.
#[tauri::command]
pub fn delete_memory_file(app: tauri::AppHandle) -> Result<(), AppError> {
    let _guard = lock_memory_file()?;
    let dir = memory_dir(&app)?;
    let jsonl = dir.join("memory.jsonl");
    let md = dir.join("memory.md");
    let temp = dir.join("memory.jsonl.tmp");
    let backup = dir.join("memory.jsonl.bak");

    if jsonl.exists() {
        std::fs::remove_file(&jsonl)?;
    }
    if md.exists() {
        std::fs::remove_file(&md)?;
    }
    if temp.exists() {
        std::fs::remove_file(&temp)?;
    }
    if backup.exists() {
        std::fs::remove_file(&backup)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{ensure_within_roots, is_path_inside, path_within_roots};
    use std::path::PathBuf;

    /// Builds a unique `root/` + `root-backup/` + `root/nested/` fixture under
    /// the temp dir. Canonicalization needs paths that actually exist.
    struct Fixture {
        root: PathBuf,
        sibling: PathBuf,
    }

    impl Fixture {
        fn new(tag: &str) -> Self {
            let base = std::env::temp_dir().join(format!(
                "black-one-sandbox-{tag}-{}-{:?}",
                std::process::id(),
                std::thread::current().id()
            ));
            let root = base.join("root");
            let sibling = base.join("root-backup");
            std::fs::create_dir_all(root.join("nested")).unwrap();
            std::fs::create_dir_all(&sibling).unwrap();
            std::fs::write(root.join("nested/file.txt"), "x").unwrap();
            std::fs::write(sibling.join("secret.txt"), "x").unwrap();
            Self { root, sibling }
        }

        fn root(&self) -> String {
            self.root.to_string_lossy().into_owned()
        }
    }

    #[test]
    fn accepts_the_root_itself_and_paths_under_it() {
        let fx = Fixture::new("inside");
        assert!(is_path_inside(&fx.root(), &fx.root()));
        assert!(is_path_inside(
            &fx.root(),
            &fx.root.join("nested").to_string_lossy()
        ));
        assert!(is_path_inside(
            &fx.root(),
            &fx.root.join("nested/file.txt").to_string_lossy()
        ));
    }

    #[test]
    fn rejects_traversal_out_of_the_root() {
        let fx = Fixture::new("traversal");
        let escaped = fx.root.join("nested/../../root-backup/secret.txt");
        assert!(
            !is_path_inside(&fx.root(), &escaped.to_string_lossy()),
            "`..` must be resolved before the containment check"
        );
        let parent = fx.root.join("..");
        assert!(!is_path_inside(&fx.root(), &parent.to_string_lossy()));
    }

    #[test]
    fn rejects_a_sibling_sharing_a_name_prefix() {
        let fx = Fixture::new("sibling");
        assert!(
            !is_path_inside(&fx.root(), &fx.sibling.to_string_lossy()),
            "root-backup must not count as inside root"
        );
        assert!(!is_path_inside(
            &fx.root(),
            &fx.sibling.join("secret.txt").to_string_lossy()
        ));
    }

    #[test]
    fn handles_targets_that_do_not_exist_yet() {
        let fx = Fixture::new("missing");
        // Writes create new files, so a non-existent target inside the root
        // must be allowed via its parent.
        assert!(is_path_inside(
            &fx.root(),
            &fx.root.join("nested/new.txt").to_string_lossy()
        ));
        assert!(!is_path_inside(
            &fx.root(),
            &fx.sibling.join("new.txt").to_string_lossy()
        ));
    }

    #[test]
    fn rejects_an_unrelated_absolute_path() {
        let fx = Fixture::new("unrelated");
        let elsewhere = std::env::temp_dir().to_string_lossy().into_owned();
        assert!(!is_path_inside(&fx.root(), &elsewhere));
    }

    #[test]
    fn absent_roots_opt_out_but_empty_roots_deny() {
        let fx = Fixture::new("guard");
        let inside = fx.root.join("nested/file.txt").to_string_lossy().into_owned();
        let outside = fx.sibling.join("secret.txt").to_string_lossy().into_owned();

        assert!(ensure_within_roots(&outside, None).is_ok());

        let empty: Vec<String> = Vec::new();
        assert!(
            ensure_within_roots(&inside, Some(&empty)).is_err(),
            "no configured workspace must not mean every workspace"
        );

        let roots = vec![fx.root()];
        assert!(ensure_within_roots(&inside, Some(&roots)).is_ok());
        assert!(ensure_within_roots(&outside, Some(&roots)).is_err());
    }

    #[test]
    fn path_within_roots_matches_the_guard() {
        let fx = Fixture::new("command");
        let inside = fx.root.join("nested").to_string_lossy().into_owned();
        let escaped = fx
            .root
            .join("nested/../../root-backup")
            .to_string_lossy()
            .into_owned();

        assert_eq!(path_within_roots(inside, vec![fx.root()]).unwrap(), true);
        assert_eq!(path_within_roots(escaped, vec![fx.root()]).unwrap(), false);
        assert_eq!(
            path_within_roots(fx.root(), Vec::new()).unwrap(),
            false,
            "an empty root list must fail closed"
        );
    }

    #[test]
    fn accepts_any_of_several_roots() {
        let fx = Fixture::new("multi");
        let roots = vec![fx.sibling.to_string_lossy().into_owned(), fx.root()];
        let inside = fx.root.join("nested/file.txt").to_string_lossy().into_owned();
        assert!(ensure_within_roots(&inside, Some(&roots)).is_ok());
    }
}
