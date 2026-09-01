/**
 * Workspaces: independent project contexts, each owning its own terminals and
 * its own Todo board. Nothing is shared between them.
 *
 * Pure module — no imports — so the activity roll-up can be unit-tested.
 */
import type { TodoItem, TodoStatus } from "@/lib/todoCore";

export interface Workspace {
  id: string;
  name: string;
  /** Root folder tools operate in. `null` for a scratch workspace. */
  path: string | null;
  color: string | null;
  createdAt: number;
}

/**
 * What a workspace is doing right now, ordered by how much it wants attention.
 * The sidebar shows one dot per workspace using this.
 */
export type WorkspaceActivity =
  | "waiting" // a tool call needs approval — blocks until the user acts
  | "running" // an agent is working
  | "error" // the last run stopped or failed
  | "done" // every task finished
  | "idle"; // nothing queued

/** Most urgent first. `indexOf` gives the comparison order. */
export const ACTIVITY_ORDER: WorkspaceActivity[] = [
  "waiting",
  "running",
  "error",
  "done",
  "idle",
];

export interface WorkspaceStatus {
  activity: WorkspaceActivity;
  /** Tasks not yet finished. */
  open: number;
  running: number;
  waiting: number;
  failed: number;
  done: number;
  total: number;
}

export interface WorkspaceActivityInput {
  todos: TodoItem[];
  /** True when a chat turn is streaming for this workspace. */
  streaming?: boolean;
  /** Tool calls awaiting approval that belong to this workspace. */
  pendingApprovals?: number;
}

const STATUS_COUNTS: Record<TodoStatus, keyof WorkspaceStatus | null> = {
  queued: null,
  working: "running",
  blocked: "waiting",
  done: "done",
  error: "failed",
};

/**
 * Rolls a workspace's tasks up into one status.
 *
 * `done` is only reported when every task finished and at least one exists, so
 * an empty board reads as idle rather than complete.
 */
export function summarizeWorkspace(
  input: WorkspaceActivityInput,
): WorkspaceStatus {
  const { todos, streaming = false, pendingApprovals = 0 } = input;

  const status: WorkspaceStatus = {
    activity: "idle",
    open: 0,
    running: 0,
    waiting: 0,
    failed: 0,
    done: 0,
    total: todos.length,
  };

  for (const todo of todos) {
    const bucket = STATUS_COUNTS[todo.status];
    if (bucket === "running") status.running += 1;
    else if (bucket === "waiting") status.waiting += 1;
    else if (bucket === "failed") status.failed += 1;
    else if (bucket === "done") status.done += 1;
    if (todo.status !== "done") status.open += 1;
  }

  if (pendingApprovals > 0) status.waiting += pendingApprovals;

  if (status.waiting > 0) {
    status.activity = "waiting";
  } else if (status.running > 0 || streaming) {
    status.activity = "running";
  } else if (status.failed > 0) {
    status.activity = "error";
  } else if (status.total > 0 && status.done === status.total) {
    status.activity = "done";
  } else {
    status.activity = "idle";
  }

  return status;
}

/** Sorts workspaces so the ones needing attention come first. */
export function compareByUrgency(
  a: WorkspaceActivity,
  b: WorkspaceActivity,
): number {
  return ACTIVITY_ORDER.indexOf(a) - ACTIVITY_ORDER.indexOf(b);
}

/**
 * Names a workspace from its folder, keeping the last path segment. Falls back
 * to a numbered name so a scratch workspace is never nameless.
 */
export function deriveWorkspaceName(
  path: string | null,
  existing: readonly string[],
): string {
  const base = path
    ? (path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "").trim()
    : "";
  const candidate = base || "Workspace";
  if (!existing.includes(candidate)) return candidate;
  let counter = 2;
  while (existing.includes(`${candidate} ${counter}`)) counter += 1;
  return `${candidate} ${counter}`;
}

/** Minimal shape needed to scope a terminal — keeps this module import-free. */
export interface WorkspaceScopedTerminal {
  id: string;
  workspaceId: string;
}

/** Terminals belonging to one workspace, in their existing order. */
export function terminalsForWorkspace<T extends WorkspaceScopedTerminal>(
  terminals: readonly T[],
  workspaceId: string | null,
): T[] {
  if (!workspaceId) return [];
  return terminals.filter((terminal) => terminal.workspaceId === workspaceId);
}

/**
 * The focused terminal in a workspace. Falls back to that workspace's first
 * terminal, so a workspace is never left with nothing focused — and never
 * resolves to a terminal belonging to a different workspace.
 */
export function selectActiveTerminalId<T extends WorkspaceScopedTerminal>(
  terminals: readonly T[],
  activeByWorkspace: Readonly<Record<string, string | null>>,
  workspaceId: string | null,
): string | null {
  if (!workspaceId) return null;
  const owned = terminalsForWorkspace(terminals, workspaceId);
  const selected = activeByWorkspace[workspaceId];
  if (selected && owned.some((terminal) => terminal.id === selected)) {
    return selected;
  }
  return owned[0]?.id ?? null;
}

/**
 * Picks the terminal a task should run in: its own if it still belongs to this
 * workspace, otherwise the workspace default, otherwise none.
 *
 * Terminals die with the app, so a stored id routinely outlives its terminal.
 */
export function resolveTaskTerminal(
  todoTerminalId: string | undefined,
  workspaceTerminalIds: readonly string[],
  workspaceDefaultId: string | null,
): string | undefined {
  if (todoTerminalId && workspaceTerminalIds.includes(todoTerminalId)) {
    return todoTerminalId;
  }
  if (workspaceDefaultId && workspaceTerminalIds.includes(workspaceDefaultId)) {
    return workspaceDefaultId;
  }
  return undefined;
}
