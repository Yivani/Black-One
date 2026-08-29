import type { Attachment, Message } from "@/types/chat";
import type { ChatFolder, ChatSession } from "@/types/session";
import { reportAppError } from "@/lib/errors";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let cachedInvoke: InvokeFn | null = null;

async function getInvoke(): Promise<InvokeFn> {
  if (cachedInvoke) return cachedInvoke;
  const mod = await import("@tauri-apps/api/core");
  cachedInvoke = mod.invoke as InvokeFn;
  return cachedInvoke;
}

export async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) throw new Error(`Tauri command "${cmd}" is unavailable outside the desktop shell.`);
  try {
    const invoke = await getInvoke();
    return await invoke<T>(cmd, args);
  } catch (error) {
    reportAppError(error, { source: `Tauri: ${cmd}` });
    throw error;
  }
}

/** Row shapes exchanged with the Rust backend (serde camelCase). */
export interface SessionRow {
  id: string;
  title: string;
  description?: string | null;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  pinned: boolean;
  folderId?: string | null;
  modelId?: string | null;
  systemPrompt?: string | null;
  messageCount: number;
  metadata?: string | null;
}

export interface MessageRow {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: number;
  tokensUsed?: number | null;
  modelId?: string | null;
  parentId?: string | null;
  status: string;
  citations?: string | null;
  attachments?: string | null;
  metadata?: string | null;
}

export interface FolderRow {
  id: string;
  name: string;
  color?: string | null;
  createdAt: number;
  sortOrder: number;
}

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface GitStatus {
  repository: boolean;
  rootPath: string;
  branch: string;
  remoteUrl?: string | null;
  changes: string[];
}

export interface AppInfo {
  version: string;
  commitSha: string;
  platform: string;
  arch: string;
}

export interface UpdateCheckResult {
  status: "up-to-date" | "available" | "error";
  latest?: string | null;
  notes?: string | null;
}

export interface TerminalSummary {
  id: string;
  title: string;
  shell: string;
}

export interface TerminalOutputEvent {
  id: string;
  data: string;
}

export interface TerminalClosedEvent {
  id: string;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export interface QuickChatPayload {
  content: string;
  attachments: Attachment[];
  modelId: string;
}

function parseMetadata(raw?: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function sessionToRow(session: ChatSession): SessionRow {
  const { mode, ...rest } = session;
  const metadata: Record<string, unknown> = {};
  if (mode !== undefined) metadata.mode = mode;
  return {
    ...rest,
    metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
  };
}

export function sessionFromRow(row: SessionRow): ChatSession {
  const metadata = parseMetadata(row.metadata);
  return {
    ...row,
    description: row.description ?? undefined,
    folderId: row.folderId ?? undefined,
    modelId: row.modelId ?? undefined,
    systemPrompt: row.systemPrompt ?? undefined,
    mode: (metadata?.mode as ChatSession["mode"]) ?? undefined,
  };
}

export function messageToRow(message: Message): MessageRow {
  const { mode, cost, reasoning, ...rest } = message;
  const metadata: Record<string, unknown> = {};
  if (mode !== undefined) metadata.mode = mode;
  if (cost !== undefined) metadata.cost = cost;
  if (reasoning !== undefined) metadata.reasoning = reasoning;
  return {
    ...rest,
    citations: message.citations ? JSON.stringify(message.citations) : null,
    attachments: message.attachments ? JSON.stringify(message.attachments) : null,
    metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
  };
}

export function messageFromRow(row: MessageRow): Message {
  const metadata = parseMetadata(row.metadata);
  return {
    ...row,
    role: row.role as Message["role"],
    status: row.status as Message["status"],
    tokensUsed: row.tokensUsed ?? undefined,
    modelId: row.modelId ?? undefined,
    parentId: row.parentId ?? undefined,
    citations: row.citations ? (JSON.parse(row.citations) as Message["citations"]) : undefined,
    attachments: row.attachments
      ? (JSON.parse(row.attachments) as Message["attachments"])
      : undefined,
    mode: (metadata?.mode as Message["mode"]) ?? undefined,
    cost: typeof metadata?.cost === "number" ? metadata.cost : undefined,
    reasoning:
      typeof metadata?.reasoning === "string" ? metadata.reasoning : undefined,
  };
}

export function folderToRow(folder: ChatFolder): FolderRow {
  return { ...folder };
}

export function folderFromRow(row: FolderRow): ChatFolder {
  return { ...row, color: row.color ?? undefined };
}

export const ipc = {
  listSessions: (includeArchived: boolean) =>
    invokeTauri<SessionRow[]>("list_sessions", { includeArchived }),
  createSession: (session: ChatSession) =>
    invokeTauri<void>("create_session", { session: sessionToRow(session) }),
  updateSession: (session: ChatSession) =>
    invokeTauri<void>("update_session", { session: sessionToRow(session) }),
  deleteSession: (id: string) => invokeTauri<void>("delete_session", { id }),
  listMessages: (sessionId: string) =>
    invokeTauri<MessageRow[]>("list_messages", { sessionId }),
  addMessage: (message: Message) => invokeTauri<void>("add_message", { message: messageToRow(message) }),
  updateMessage: (message: Message) =>
    invokeTauri<void>("update_message", { message: messageToRow(message) }),
  deleteMessagesFrom: (sessionId: string, messageId: string) =>
    invokeTauri<void>("delete_messages_from", { sessionId, messageId }),
  listFolders: () => invokeTauri<FolderRow[]>("list_folders"),
  createFolder: (folder: ChatFolder) =>
    invokeTauri<void>("create_folder", { folder: folderToRow(folder) }),
  updateFolder: (folder: ChatFolder) =>
    invokeTauri<void>("update_folder", { folder: folderToRow(folder) }),
  deleteFolder: (id: string) => invokeTauri<void>("delete_folder", { id }),

  getSetting: (key: string) => invokeTauri<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invokeTauri<void>("set_setting", { key, value }),
  storeApiKey: (providerId: string, key: string) =>
    invokeTauri<void>("store_api_key", { providerId, key }),
  getApiKey: (providerId: string) => invokeTauri<string | null>("get_api_key", { providerId }),
  deleteApiKey: (providerId: string) => invokeTauri<void>("delete_api_key", { providerId }),

  readFileText: (path: string) => invokeTauri<string>("read_file_text", { path }),
  readDirEntries: (path: string) => invokeTauri<DirEntry[]>("read_dir_entries", { path }),
  writeFileText: (path: string, content: string, roots?: string[]) =>
    invokeTauri<void>("write_file_text", { path, content, roots }),
  createDir: (path: string, roots?: string[]) =>
    invokeTauri<void>("create_dir_command", { path, roots }),
  deleteFile: (path: string, roots?: string[]) =>
    invokeTauri<void>("delete_file", { path, roots }),
  deleteDir: (path: string, roots?: string[]) =>
    invokeTauri<void>("delete_dir", { path, roots }),
  renameFile: (from: string, to: string, roots?: string[]) =>
    invokeTauri<void>("rename_file", { from, to, roots }),
  allowMediaPreview: (path: string) =>
    invokeTauri<string>("allow_media_preview", { path }),
  getDataDir: () => invokeTauri<string>("get_data_dir"),
  pickSoundFile: () => invokeTauri<string | null>("pick_sound_file"),

  gitStatus: (path: string) => invokeTauri<GitStatus>("git_status", { path }),
  gitInit: (path: string) => invokeTauri<GitStatus>("git_init", { path }),
  gitStageAll: (path: string) => invokeTauri<GitStatus>("git_stage_all", { path }),
  gitCommit: (path: string, message: string) =>
    invokeTauri<GitStatus>("git_commit", { path, message }),
  gitSetRemote: (path: string, url: string) =>
    invokeTauri<GitStatus>("git_set_remote", { path, url }),
  gitPush: (path: string) => invokeTauri<GitStatus>("git_push", { path }),
  gitDiff: (path: string) => invokeTauri<string>("git_diff", { path }),

  readMemoryFile: () => invokeTauri<string>("read_memory_file"),
  writeMemoryFile: (content: string) => invokeTauri<void>("write_memory_file", { content }),
  deleteMemoryFile: () => invokeTauri<void>("delete_memory_file"),

  getAppInfo: () => invokeTauri<AppInfo>("get_app_info"),
  clearAllData: () => invokeTauri<void>("clear_all_data"),
  factoryReset: () => invokeTauri<void>("factory_reset"),
  checkForUpdates: () => invokeTauri<UpdateCheckResult>("check_for_updates"),
  openDataFolder: () => invokeTauri<void>("open_data_folder"),
  setAutoStart: (enabled: boolean) => invokeTauri<void>("set_auto_start", { enabled }),
  isAutoStartEnabled: () => invokeTauri<boolean>("is_auto_start_enabled"),

  setQuickChatShortcut: (binding: string) =>
    invokeTauri<void>("set_quick_chat_shortcut", { binding }),
  resizeQuickChat: (expanded: boolean) =>
    invokeTauri<void>("resize_quick_chat", { expanded }),
  hideQuickChat: () => invokeTauri<void>("hide_quick_chat"),
  submitQuickChat: (payload: QuickChatPayload) =>
    invokeTauri<void>("submit_quick_chat", { payload }),

  executeShellCommand: (command: string, cwd?: string, roots?: string[]) =>
    invokeTauri<ShellResult>("execute_shell_command", { command, cwd, roots }),

  createTerminal: (cwd?: string, shell?: string) =>
    invokeTauri<TerminalSummary>("create_terminal", { cwd, shell }),
  writeTerminal: (id: string, data: string) => invokeTauri<void>("write_terminal", { id, data }),
  resizeTerminal: (id: string, cols: number, rows: number) =>
    invokeTauri<void>("resize_terminal", { id, cols, rows }),
  closeTerminal: (id: string) => invokeTauri<void>("close_terminal", { id }),
  listTerminals: () => invokeTauri<TerminalSummary[]>("list_terminals"),
};

// Terminal output is streamed through a Tauri Channel registered at app
// startup. See src/lib/terminalChannel.ts for the subscription API.
