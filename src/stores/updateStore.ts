import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { ipc, isTauri } from "@/lib/ipc";

interface UpdateState {
  hasUpdate: boolean;
  latestVersion: string | null;
  commitSha: string | null;
  checking: boolean;
  error: string | null;
  lastCheckedAt: number | null;

  checkNow: () => Promise<void>;
  dismiss: () => void;
}

function shortCommit(sha: string | null | undefined): string {
  if (!sha) return "";
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

export const useUpdateStore = create<UpdateState>()(
  immer((set) => ({
    hasUpdate: false,
    latestVersion: null,
    commitSha: null,
    checking: false,
    error: null,
    lastCheckedAt: null,

    checkNow: async () => {
      if (!isTauri) return;
      set((state) => {
        state.checking = true;
        state.error = null;
      });
      try {
        const result = await ipc.checkForUpdates();
        set((state) => {
          state.checking = false;
          state.lastCheckedAt = Date.now();
          if (result.status === "available" && result.latest) {
            state.hasUpdate = true;
            state.latestVersion = result.latest.replace(/^v/, "");
            state.commitSha = shortCommit(result.commitSha);
          } else {
            state.hasUpdate = false;
            state.latestVersion = null;
            state.commitSha = null;
          }
          if (result.status === "error") {
            state.error = result.notes ?? "Update check failed.";
          }
        });
      } catch (error) {
        set((state) => {
          state.checking = false;
          state.error = error instanceof Error ? error.message : "Update check failed.";
        });
      }
    },

    dismiss: () =>
      set((state) => {
        state.hasUpdate = false;
      }),
  })),
);
