import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { cloneToolCall, type ToolCall, type ToolPermissionMode } from "@/lib/tools";

interface ToolRuntimeState {
  permissionMode: ToolPermissionMode;
  pendingCalls: ToolCall[];
  /** Terminal ID that the currently running Todo should use for shell commands. */
  todoTerminalId: string | null;
  /**
   * Workspace folder the running Todo belongs to. Tools are sandboxed to this
   * instead of the process cwd, so each workspace acts on its own project.
   */
  todoWorkspaceFolder: string | null;

  setPermissionMode: (mode: ToolPermissionMode) => void;
  queuePending: (calls: ToolCall[]) => void;
  approve: (id: string) => ToolCall | undefined;
  deny: (id: string) => ToolCall | undefined;
  approveAll: () => ToolCall[];
  denyAll: () => ToolCall[];
  remove: (id: string) => void;
  clear: () => void;
  updateCall: (call: ToolCall) => void;
  setTodoTerminal: (id: string | null) => void;
  setTodoWorkspaceFolder: (path: string | null) => void;
}

export const useToolRuntimeStore = create<ToolRuntimeState>()(
  immer((set, get) => ({
    permissionMode: "auto",
    pendingCalls: [],
    todoTerminalId: null,
    todoWorkspaceFolder: null,

    setPermissionMode: (mode) => {
      set((state) => {
        state.permissionMode = mode;
      });
    },

    queuePending: (calls) => {
      set((state) => {
        for (const call of calls) {
          if (!state.pendingCalls.some((c) => c.id === call.id)) {
            state.pendingCalls.push(cloneToolCall({ ...call, status: "pending" }));
          }
        }
      });
    },

    approve: (id) => {
      let approved: ToolCall | undefined;
      set((state) => {
        const idx = state.pendingCalls.findIndex((c) => c.id === id);
        if (idx >= 0) {
          approved = cloneToolCall({ ...state.pendingCalls[idx], status: "approved" });
          state.pendingCalls.splice(idx, 1);
        }
      });
      return approved;
    },

    deny: (id) => {
      let denied: ToolCall | undefined;
      set((state) => {
        const idx = state.pendingCalls.findIndex((c) => c.id === id);
        if (idx >= 0) {
          denied = cloneToolCall({
            ...state.pendingCalls[idx],
            status: "denied",
            result: { success: false, error: "User denied this action." },
          });
          state.pendingCalls.splice(idx, 1);
        }
      });
      return denied;
    },

    approveAll: () => {
      const approved: ToolCall[] = [];
      set((state) => {
        for (const call of state.pendingCalls) {
          approved.push(cloneToolCall({ ...call, status: "approved" }));
        }
        state.pendingCalls = [];
      });
      return approved;
    },

    denyAll: () => {
      const denied: ToolCall[] = [];
      set((state) => {
        for (const call of state.pendingCalls) {
          denied.push(cloneToolCall({
            ...call,
            status: "denied",
            result: { success: false, error: "User denied this action." },
          }));
        }
        state.pendingCalls = [];
      });
      return denied;
    },

    remove: (id) => {
      set((state) => {
        state.pendingCalls = state.pendingCalls.filter((c) => c.id !== id);
      });
    },

    clear: () => {
      set((state) => {
        state.pendingCalls = [];
      });
    },

    updateCall: (call) => {
      set((state) => {
        const idx = state.pendingCalls.findIndex((c) => c.id === call.id);
        if (idx >= 0) {
          state.pendingCalls[idx] = cloneToolCall(call);
        }
      });
    },

    setTodoTerminal: (id) => {
      set((state) => {
        state.todoTerminalId = id;
      });
    },

    setTodoWorkspaceFolder: (path) => {
      set((state) => {
        state.todoWorkspaceFolder = path;
      });
    },
  })),
);
