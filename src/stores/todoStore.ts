import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { generateId } from "@/lib/utils";
import {
  moveTodo,
  TODO_PRIORITIES,
  type TodoItem,
  type TodoPriority,
} from "@/lib/todoCore";

const STORAGE_KEY = "todo:board";

type PriorityModels = Record<TodoPriority, string | null>;

interface PersistedTodoState {
  items: TodoItem[];
  modelByPriority: PriorityModels;
}

interface TodoState extends PersistedTodoState {
  runnerActive: boolean;
  activeTodoId: string | null;
  addTodo: (text: string, priority: TodoPriority) => void;
  updateTodo: (id: string, patch: Partial<TodoItem>) => void;
  removeTodo: (id: string) => void;
  moveTodo: (
    id: string,
    priority: TodoPriority,
    overId?: string,
  ) => void;
  setPriorityModel: (priority: TodoPriority, modelId: string) => void;
  clearCompleted: () => void;
  setRunner: (active: boolean, todoId?: string | null) => void;
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

const initial = readPersisted();

export const useTodoStore = create<TodoState>()(
  immer((set, get) => ({
    ...initial,
    runnerActive: false,
    activeTodoId: null,

    addTodo: (text, priority) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      set((state) => {
        state.items.push({
          id: generateId(),
          text: trimmed,
          priority,
          status: "queued",
          multiAgent: false,
          createdAt: Date.now(),
        });
      });
      persist(get());
    },

    updateTodo: (id, patch) => {
      set((state) => {
        const item = state.items.find((todo) => todo.id === id);
        if (item) Object.assign(item, patch);
      });
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

    clearCompleted: () => {
      set((state) => {
        state.items = state.items.filter((item) => item.status !== "done");
      });
      persist(get());
    },

    setRunner: (active, todoId = null) => {
      set((state) => {
        state.runnerActive = active;
        state.activeTodoId = active ? todoId : null;
      });
    },
  })),
);
