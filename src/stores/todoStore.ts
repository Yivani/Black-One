import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { playSound } from "@/hooks/useHaptics";
import { generateId } from "@/lib/utils";
import {
  fillPriorityAgents,
  moveTodo,
  TODO_PRIORITIES,
  type TodoItem,
  type TodoPriority,
} from "@/lib/todoCore";
import { getActiveWorkspace, useWorkspaceStore } from "@/stores/workspaceStore";

const STORAGE_KEY = "todo:board";

type PriorityModels = Record<TodoPriority, string | null>;

interface PersistedTodoState {
  items: TodoItem[];
  modelByPriority: PriorityModels;
}

interface TodoState extends PersistedTodoState {
  runnerActive: boolean;
  /**
   * Set between asking the runner to stop and it actually unwinding. The
   * runner stays "active" throughout, so a second one cannot be started into
   * the same terminal while the first is still interrupting its command.
   */
  stopping: boolean;
  activeTodoId: string | null;
  addTodo: (text: string, priority: TodoPriority, workspaceId?: string) => void;
  updateTodo: (id: string, patch: Partial<TodoItem>) => void;
  removeTodo: (id: string) => void;
  moveTodo: (
    id: string,
    priority: TodoPriority,
    overId?: string,
  ) => void;
  setPriorityModel: (priority: TodoPriority, modelId: string) => void;
  /**
   * Points every lane at an installed agent, so a fresh board can start work
   * without picking the same agent four times.
   */
  applyDefaultAgents: (installedModelIds: readonly string[]) => void;
  /** Clears finished tasks in one workspace, leaving other boards untouched. */
  clearCompleted: (workspaceId?: string) => void;
  /** Drops every task belonging to a deleted workspace. */
  removeWorkspaceTodos: (workspaceId: string) => void;
  setRunner: (active: boolean, todoId?: string | null) => void;
  setStopping: (stopping: boolean) => void;
}

const emptyModels = Object.fromEntries(
  TODO_PRIORITIES.map((priority) => [priority, null]),
) as PriorityModels;

function readPersisted(): PersistedTodoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], modelByPriority: emptyModels };
    const stored = JSON.parse(raw) as Partial<PersistedTodoState>;
    const items = Array.isArray(stored.items)
      ? stored.items.map((item) =>
          item.status === "working" || item.status === "blocked"
            ? {
                ...item,
                status: "queued" as const,
                sessionId: undefined,
                pass: undefined,
                blockedMessageId: undefined,
              }
            : item,
        )
      : [];
    return {
      items,
      modelByPriority: { ...emptyModels, ...stored.modelByPriority },
    };
  } catch {
    return { items: [], modelByPriority: emptyModels };
  }
}

function persist(state: TodoState): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items: state.items,
        modelByPriority: state.modelByPriority,
      }),
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
    ...stored,
    items: stored.items.map((item) =>
      item.workspaceId ? item : { ...item, workspaceId: fallbackWorkspaceId },
    ),
  };
}

export const useTodoStore = create<TodoState>()(
  immer((set, get) => ({
    ...createInitialState(),
    runnerActive: false,
    stopping: false,
    activeTodoId: null,

    addTodo: (text, priority, workspaceId) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const workspace = workspaceId ?? getActiveWorkspace().id;
      // New tasks inherit the workspace's terminal so they run in the right
      // shell without the user having to pick one every time.
      const terminalId =
        useWorkspaceStore.getState().defaultTerminalByWorkspace[workspace] ??
        undefined;
      set((state) => {
        state.items.push({
          id: generateId(),
          text: trimmed,
          priority,
          status: "queued",
          multiAgent: false,
          createdAt: Date.now(),
          workspaceId: workspace,
          terminalId,
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

    setPriorityModel: (priority, modelId) => {
      set((state) => {
        state.modelByPriority[priority] = modelId;
      });
      persist(get());
    },

    applyDefaultAgents: (installedModelIds) => {
      const next = fillPriorityAgents(get().modelByPriority, installedModelIds);
      if (!next) return;
      set((state) => {
        state.modelByPriority = next;
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

    setRunner: (active, todoId = null) => {
      set((state) => {
        state.runnerActive = active;
        state.activeTodoId = active ? todoId : null;
        if (!active) state.stopping = false;
      });
    },

    setStopping: (stopping) => {
      set((state) => {
        state.stopping = stopping;
      });
    },
  })),
);
