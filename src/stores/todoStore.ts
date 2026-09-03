import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { playSound } from "@/hooks/useHaptics";
import { generateId } from "@/lib/utils";
import { moveTodo, type TodoItem, type TodoPriority } from "@/lib/todoCore";
import { getActiveWorkspace } from "@/stores/workspaceStore";

const STORAGE_KEY = "todo:board";

interface PersistedTodoState {
  items: TodoItem[];
}

interface TodoState extends PersistedTodoState {
  addTodo: (text: string, priority: TodoPriority, workspaceId?: string) => void;
  updateTodo: (id: string, patch: Partial<TodoItem>) => void;
  removeTodo: (id: string) => void;
  moveTodo: (id: string, priority: TodoPriority, overId?: string) => void;
  /** Clears finished tasks in one workspace, leaving other boards untouched. */
  clearCompleted: (workspaceId?: string) => void;
  /** Drops every task belonging to a deleted workspace. */
  removeWorkspaceTodos: (workspaceId: string) => void;
}

/**
 * Reads the stored board.
 *
 * Earlier versions ran tasks and stored the run state on the item — `working`,
 * `blocked` and `error` statuses, plus a terminal, a session and a pass
 * counter. Nothing runs tasks now, so anything unfinished comes back queued
 * and the run fields are dropped rather than carried forward as dead weight.
 */
function readPersisted(): PersistedTodoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };
    const stored = JSON.parse(raw) as { items?: unknown };
    if (!Array.isArray(stored.items)) return { items: [] };
    const items = stored.items.map((entry) => {
      const item = entry as TodoItem & Record<string, unknown>;
      return {
        id: item.id,
        text: item.text,
        priority: item.priority,
        status: item.status === "done" ? ("done" as const) : ("queued" as const),
        createdAt: item.createdAt,
        workspaceId: item.workspaceId,
      };
    });
    return { items };
  } catch {
    return { items: [] };
  }
}

function persist(state: TodoState): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ items: state.items }),
    );
  } catch {
    // Todo persistence is best-effort when the webview blocks local storage.
  }
}

/**
 * Boards existed before workspaces did. Tasks stored without one are adopted
 * by the first workspace so nothing disappears from the board on upgrade.
 */
function createInitialState(): PersistedTodoState {
  const stored = readPersisted();
  const fallbackWorkspaceId = getActiveWorkspace().id;
  return {
    items: stored.items.map((item) =>
      item.workspaceId ? item : { ...item, workspaceId: fallbackWorkspaceId },
    ),
  };
}

export const useTodoStore = create<TodoState>()(
  immer((set, get) => ({
    ...createInitialState(),

    addTodo: (text, priority, workspaceId) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const workspace = workspaceId ?? getActiveWorkspace().id;
      set((state) => {
        state.items.push({
          id: generateId(),
          text: trimmed,
          priority,
          status: "queued",
          createdAt: Date.now(),
          workspaceId: workspace,
        });
      });
      persist(get());
    },

    updateTodo: (id, patch) => {
      let justFinished = false;
      set((state) => {
        const item = state.items.find((todo) => todo.id === id);
        if (!item) return;
        justFinished = patch.status === "done" && item.status !== "done";
        Object.assign(item, patch);
      });
      // Only the transition makes a sound; re-saving a finished todo does not.
      if (justFinished) playSound("task");
      persist(get());
    },

    removeTodo: (id) => {
      set((state) => {
        state.items = state.items.filter((item) => item.id !== id);
      });
      persist(get());
    },

    moveTodo: (id, priority, overId) => {
      set((state) => {
        state.items = moveTodo(state.items, id, priority, overId);
      });
      persist(get());
    },

    clearCompleted: (workspaceId) => {
      const scope = workspaceId ?? getActiveWorkspace().id;
      set((state) => {
        state.items = state.items.filter(
          (item) => item.workspaceId !== scope || item.status !== "done",
        );
      });
      persist(get());
    },

    removeWorkspaceTodos: (workspaceId) => {
      set((state) => {
        state.items = state.items.filter(
          (item) => item.workspaceId !== workspaceId,
        );
      });
      persist(get());
    },
  })),
);
