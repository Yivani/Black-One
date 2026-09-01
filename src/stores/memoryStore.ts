import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  addManualMemory,
  scheduleAgentContextSync,
  deleteMemoryBank,
  deleteMemoryEntry,
  loadMemoryBank,
  subscribeMemoryChanges,
  updateMemoryEntry,
  type MemoryEntry,
  type MemorySaveEvent,
} from "@/lib/memory";
import { resolveContextFolder } from "@/lib/agentContext";
import { playSound } from "@/hooks/useHaptics";
import { useTerminalStore } from "@/stores/terminalStore";
import { getActiveWorkspace } from "@/stores/workspaceStore";
import { terminalsForWorkspace } from "@/lib/workspaceCore";

/**
 * Where the CLI context files belong right now.
 *
 * Exported so the settings page can show the same answer the sync will use —
 * "it will write here" beats "it needs a folder".
 */
export function agentContextFolder(): string | null {
  const workspace = getActiveWorkspace();
  const cwds = terminalsForWorkspace(
    useTerminalStore.getState().terminals,
    workspace?.id ?? null,
  ).map((terminal) => terminal.cwd);
  return resolveContextFolder(workspace?.path, cwds);
}

/** How long a fresh save stays flagged in the UI. */
export const SAVE_HIGHLIGHT_MS = 12_000;

interface MemoryState {
  entries: MemoryEntry[];
  loading: boolean;
  error: string | null;
  /**
   * Facts written since the user last looked. Drives the "saved" indicator, so
   * automatic learning is visible instead of happening behind their back.
   */
  recentSaves: MemorySaveEvent[];
  /** Timestamp of the newest save, for the pulse animation. */
  lastSavedAt: number | null;

  load: () => Promise<void>;
  edit: (
    id: string,
    patch: Partial<Pick<MemoryEntry, "content" | "category" | "importance" | "pinned">>,
  ) => Promise<void>;
  add: (input: { content: string; category: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  /** Called when the user has seen the indicator. */
  acknowledgeSaves: () => void;
}

export const useMemoryStore = create<MemoryState>()(
  immer((set, get) => ({
    entries: [],
    loading: false,
    error: null,
    recentSaves: [],
    lastSavedAt: null,

    load: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });
      try {
        const bank = await loadMemoryBank();
        set((state) => {
          state.entries = bank.entries;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : String(error);
        });
      } finally {
        set((state) => {
          state.loading = false;
        });
      }
    },

    edit: async (id, patch) => {
      await updateMemoryEntry(id, patch);
      await get().load();
    },

    add: async (input) => {
      await addManualMemory({ ...input, importance: 4 });
      await get().load();
    },

    remove: async (id) => {
      await deleteMemoryEntry(id);
      await get().load();
    },

    clear: async () => {
      await deleteMemoryBank();
      set((state) => {
        state.recentSaves = [];
        state.lastSavedAt = null;
      });
      await get().load();
    },

    acknowledgeSaves: () => {
      set((state) => {
        state.recentSaves = [];
      });
    },
  })),
);

/**
 * Bridges the bank's change notifications into the store.
 *
 * Set up once at module load rather than in a component, because facts are
 * written from the tool runtime whether or not any memory UI is mounted.
 */
subscribeMemoryChanges((events) => {
  const store = useMemoryStore.getState();
  // Push the bank out to the CLI agents' context files. Debounced inside, so a
  // burst of confirmations produces one write.
  scheduleAgentContextSync(agentContextFolder());
  if (events.length > 0) {
    playSound("memory");
    useMemoryStore.setState((state) => {
      // Cap the list: the indicator shows a count, not a transcript.
      state.recentSaves = [...state.recentSaves, ...events].slice(-20);
      state.lastSavedAt = Date.now();
    });
  }
  void store.load();
});
