import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { toast } from "sonner";
import { ipc, isTauri } from "@/lib/ipc";
import { waitForTerminalChannel } from "@/lib/terminalChannel";
import type { TerminalSummary } from "@/lib/ipc";

export type TerminalLayout = "grid" | "horizontal" | "vertical";

let terminalCreation: Promise<TerminalSummary | undefined> | null = null;

interface TerminalState {
  terminals: TerminalSummary[];
  activeTerminalId: string | null;
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
  layout: TerminalLayout;
  terminalColors: Record<string, string>;

  openPanel: () => Promise<void>;
  closePanel: () => void;
  createTerminal: (
    cwd?: string,
    shell?: string,
  ) => Promise<TerminalSummary | undefined>;
  closeTerminal: (id: string) => Promise<void>;
  setActiveTerminal: (id: string) => void;
  renameTerminal: (id: string, title: string) => void;
  setTerminalColor: (id: string, color: string | null) => void;
  reorderTerminals: (fromIndex: number, toIndex: number) => void;
  setLayout: (layout: TerminalLayout) => void;
  setBottomPanelHeight: (height: number) => void;
}

function readInitial<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writePersisted(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-critical UI state.
  }
}

function isTerminalLayout(value: unknown): value is TerminalLayout {
  return value === "grid" || value === "horizontal" || value === "vertical";
}

function readInitialLayout(): TerminalLayout {
  const raw = readInitial<string | null>("terminal:layout", null);
  return raw && isTerminalLayout(raw) ? raw : "grid";
}

export const useTerminalStore = create<TerminalState>()(
  immer((set, get) => ({
    terminals: [],
    activeTerminalId: null,
    bottomPanelOpen: readInitial("terminal:bottomPanelOpen", false),
    bottomPanelHeight: readInitial("terminal:bottomPanelHeight", 280),
    layout: readInitialLayout(),
    terminalColors: {},

    openPanel: async () => {
      set((state) => {
        state.bottomPanelOpen = true;
        writePersisted("terminal:bottomPanelOpen", true);
      });
      if (get().terminals.length === 0) {
        await get().createTerminal();
      }
    },

    closePanel: () => {
      set((state) => {
        state.bottomPanelOpen = false;
        writePersisted("terminal:bottomPanelOpen", false);
      });
    },

    createTerminal: async (cwd, shell) => {
      if (!isTauri) {
        toast.error("Terminals are only available in the desktop build.");
        return;
      }
      if (terminalCreation) return terminalCreation;
      terminalCreation = (async () => {
        try {
          await waitForTerminalChannel();
          const summary = await ipc.createTerminal(cwd, shell);
          set((state) => {
            state.terminals.push(summary);
            state.activeTerminalId = summary.id;
            state.bottomPanelOpen = true;
            writePersisted("terminal:bottomPanelOpen", true);
          });
          return summary;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to open terminal.");
          return undefined;
        } finally {
          terminalCreation = null;
        }
      })();
      return terminalCreation;
    },

    closeTerminal: async (id) => {
      if (!isTauri) return;
      try {
        await ipc.closeTerminal(id);
      } catch {
        // Ignore backend close errors; remove from UI anyway.
      }
      set((state) => {
        state.terminals = state.terminals.filter((t) => t.id !== id);
        delete state.terminalColors[id];
        if (state.activeTerminalId === id) {
          state.activeTerminalId = state.terminals[state.terminals.length - 1]?.id ?? null;
        }
        if (state.terminals.length === 0) {
          state.bottomPanelOpen = false;
          writePersisted("terminal:bottomPanelOpen", false);
        }
      });
    },

    setActiveTerminal: (id) => {
      set((state) => {
        state.activeTerminalId = id;
      });
    },

    renameTerminal: (id, title) => {
      set((state) => {
        const terminal = state.terminals.find((t) => t.id === id);
        if (terminal) terminal.title = title;
      });
    },

    setTerminalColor: (id, color) => {
      set((state) => {
        if (color) {
          state.terminalColors[id] = color;
        } else {
          delete state.terminalColors[id];
        }
      });
    },

    reorderTerminals: (fromIndex, toIndex) => {
      set((state) => {
        const [moved] = state.terminals.splice(fromIndex, 1);
        if (moved) {
          state.terminals.splice(toIndex, 0, moved);
        }
      });
    },

    setLayout: (layout) => {
      set((state) => {
        state.layout = layout;
        writePersisted("terminal:layout", layout);
      });
    },

    setBottomPanelHeight: (height) => {
      const clamped = Math.min(600, Math.max(160, height));
      set((state) => {
        state.bottomPanelHeight = clamped;
        writePersisted("terminal:bottomPanelHeight", clamped);
      });
    },
  })),
);
