import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ToolCall, ToolPermissionMode } from "@/lib/tools";

interface ToolRuntimeState {
  permissionMode: ToolPermissionMode;
  pendingCalls: ToolCall[];

  setPermissionMode: (mode: ToolPermissionMode) => void;
  queuePending: (calls: ToolCall[]) => void;
  approve: (id: string) => ToolCall | undefined;
  deny: (id: string) => ToolCall | undefined;
  approveAll: () => ToolCall[];
  denyAll: () => ToolCall[];
  remove: (id: string) => void;
  clear: () => void;
  updateCall: (call: ToolCall) => void;
}

export const useToolRuntimeStore = create<ToolRuntimeState>()(
  immer((set, get) => ({
    permissionMode: "manual",
    pendingCalls: [],

    setPermissionMode: (mode) => {
      set((state) => {
        state.permissionMode = mode;
      });
    },

    queuePending: (calls) => {
      set((state) => {
        for (const call of calls) {
          if (!state.pendingCalls.some((c) => c.id === call.id)) {
            state.pendingCalls.push({ ...call, status: "pending" });
          }
        }
      });
    },

    approve: (id) => {
      let approved: ToolCall | undefined;
      set((state) => {
        const idx = state.pendingCalls.findIndex((c) => c.id === id);
        if (idx >= 0) {
          approved = { ...state.pendingCalls[idx], status: "approved" };
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
          denied = {
            ...state.pendingCalls[idx],
            status: "denied",
            result: { success: false, error: "User denied this action." },
          };
          state.pendingCalls.splice(idx, 1);
        }
      });
      return denied;
    },

    approveAll: () => {
      const approved: ToolCall[] = [];
      set((state) => {
        for (const call of state.pendingCalls) {
          approved.push({ ...call, status: "approved" });
        }
        state.pendingCalls = [];
      });
      return approved;
    },

    denyAll: () => {
      const denied: ToolCall[] = [];
      set((state) => {
        for (const call of state.pendingCalls) {
          denied.push({
            ...call,
            status: "denied",
            result: { success: false, error: "User denied this action." },
          });
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
          state.pendingCalls[idx] = call;
        }
      });
    },
  })),
);
