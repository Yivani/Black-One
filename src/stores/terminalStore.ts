import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { toast } from "sonner";
import { playSound } from "@/hooks/useHaptics";
import { ipc, isTauri } from "@/lib/ipc";
import { waitForTerminalChannel } from "@/lib/terminalChannel";
import type { TerminalSummary } from "@/lib/ipc";
import { getActiveWorkspace, useWorkspaceStore } from "@/stores/workspaceStore";

export type TerminalLayout = "grid" | "horizontal" | "vertical";

/**
 * A terminal always belongs to exactly one workspace. The backend does not
 * know about workspaces — PTYs die with the app, so the mapping only has to
 * live as long as the session does.
 */
export interface WorkspaceTerminal extends TerminalSummary {
  workspaceId: string;
  /**
   * Set once the shell behind this tab has exited. The tab stays so its
   * scrollback is readable, but there is nothing left to type into — the PTY
   * is gone on the backend, so input would only produce an error.
   */
  exited?: boolean;
}

/**
 * Guards against double-creation when several triggers fire at once, keyed by
 * workspace — two workspaces opening their first shell must not share a result.
 */
const terminalCreation = new Map<
  string,
  Promise<WorkspaceTerminal | undefined>
>();

interface TerminalState {
  terminals: WorkspaceTerminal[];
  /** Selected terminal per workspace, so switching back restores the view. */
  activeTerminalByWorkspace: Record<string, string | null>;
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
  layout: TerminalLayout;
  terminalColors: Record<string, string>;

  openPanel: () => Promise<void>;
  closePanel: () => void;
  createTerminal: (
    cwd?: string,
    shell?: string,
    workspaceId?: string,
  ) => Promise<WorkspaceTerminal | undefined>;
  closeTerminal: (id: string) => Promise<void>;
  /** Called when the backend reports the shell behind a terminal has exited. */
  markTerminalExited: (id: string) => void;
  /** Whether a terminal is still live and safe to send input to. */
  isTerminalLive: (id: string) => boolean;
  closeWorkspaceTerminals: (workspaceId: string) => Promise<void>;
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
    activeTerminalByWorkspace: {},
    bottomPanelOpen: readInitial("terminal:bottomPanelOpen", false),
    bottomPanelHeight: readInitial("terminal:bottomPanelHeight", 280),
    layout: readInitialLayout(),
    terminalColors: {},

    openPanel: async () => {
      set((state) => {
        state.bottomPanelOpen = true;
        writePersisted("terminal:bottomPanelOpen", true);
      });
      const workspaceId = getActiveWorkspace().id;
      const hasTerminal = get().terminals.some(
        (terminal) => terminal.workspaceId === workspaceId,
      );
      if (!hasTerminal) {
        await get().createTerminal();
      }
    },

    closePanel: () => {
      set((state) => {
        state.bottomPanelOpen = false;
        writePersisted("terminal:bottomPanelOpen", false);
      });
    },

    createTerminal: async (cwd, shell, workspaceId) => {
      if (!isTauri) {
        toast.error("Terminals are only available in the desktop build.");
        return;
      }
      const workspace = workspaceId
        ? (useWorkspaceStore
            .getState()
            .workspaces.find((item) => item.id === workspaceId) ??
          getActiveWorkspace())
        : getActiveWorkspace();

      const inFlight = terminalCreation.get(workspace.id);
      if (inFlight) return inFlight;

      // A workspace with a folder opens its terminals there by default.
      const startDir = cwd ?? workspace.path ?? undefined;

      const pending = (async () => {
        try {
          await waitForTerminalChannel();
          const summary = await ipc.createTerminal(startDir, shell);
          const terminal: WorkspaceTerminal = {
            ...summary,
            workspaceId: workspace.id,
          };
          set((state) => {
            state.terminals.push(terminal);
            state.activeTerminalByWorkspace[workspace.id] = terminal.id;
            state.bottomPanelOpen = true;
            writePersisted("terminal:bottomPanelOpen", true);
          });
          const workspaceStore = useWorkspaceStore.getState();
          if (!workspaceStore.defaultTerminalByWorkspace[workspace.id]) {
            workspaceStore.setDefaultTerminal(workspace.id, terminal.id);
          }
          playSound("terminal");
          return terminal;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to open terminal.");
          return undefined;
        } finally {
          terminalCreation.delete(workspace.id);
        }
      })();
      terminalCreation.set(workspace.id, pending);
      return pending;
    },

    closeTerminal: async (id) => {
      if (!isTauri) return;
      const closing = get().terminals.find((terminal) => terminal.id === id);
      // Drop it from the store *before* asking the backend to close, so React
      // unmounts the xterm view — disconnecting its resize observer and
      // cancelling any queued fit — while the session still exists. Closing
      // first left a window where a stray resize or keystroke hit a session
      // that was already gone, which surfaced as "not found: terminal <id>".
      set((state) => {
        state.terminals = state.terminals.filter((t) => t.id !== id);
        delete state.terminalColors[id];
        const workspaceId = closing?.workspaceId;
        if (workspaceId && state.activeTerminalByWorkspace[workspaceId] === id) {
          // Fall back within the same workspace, never across one.
          const siblings = state.terminals.filter(
            (terminal) => terminal.workspaceId === workspaceId,
          );
          state.activeTerminalByWorkspace[workspaceId] =
            siblings[siblings.length - 1]?.id ?? null;
        }
        if (state.terminals.length === 0) {
          state.bottomPanelOpen = false;
          writePersisted("terminal:bottomPanelOpen", false);
        }
      });
      try {
        await ipc.closeTerminal(id);
      } catch {
        // The session may already be gone; the UI is authoritative either way.
      }
      const workspaceId = closing?.workspaceId;
      if (workspaceId) {
        const workspaceStore = useWorkspaceStore.getState();
        if (workspaceStore.defaultTerminalByWorkspace[workspaceId] === id) {
          workspaceStore.setDefaultTerminal(
            workspaceId,
            get().activeTerminalByWorkspace[workspaceId] ?? null,
          );
        }
      }
    },

    closeWorkspaceTerminals: async (workspaceId) => {
      const ids = get()
        .terminals.filter((terminal) => terminal.workspaceId === workspaceId)
        .map((terminal) => terminal.id);
      for (const id of ids) {
        await get().closeTerminal(id);
      }
    },

    markTerminalExited: (id) => {
      set((state) => {
        const terminal = state.terminals.find((item) => item.id === id);
        if (terminal) terminal.exited = true;
      });
    },

    isTerminalLive: (id) => {
      const terminal = get().terminals.find((item) => item.id === id);
      return terminal !== undefined && terminal.exited !== true;
    },

    setActiveTerminal: (id) => {
      const terminal = get().terminals.find((item) => item.id === id);
      if (!terminal) return;
      set((state) => {
        state.activeTerminalByWorkspace[terminal.workspaceId] = id;
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

    // Indices are positions within the active workspace's list, which is what
    // the sidebar renders — they are mapped back onto the full list here.
    reorderTerminals: (fromIndex, toIndex) => {
      const workspaceId = getActiveWorkspace().id;
      set((state) => {
        const positions = state.terminals
          .map((terminal, index) => ({ terminal, index }))
          .filter(({ terminal }) => terminal.workspaceId === workspaceId)
          .map(({ index }) => index);
        const from = positions[fromIndex];
        const to = positions[toIndex];
        if (from === undefined || to === undefined) return;
        const [moved] = state.terminals.splice(from, 1);
        if (moved) state.terminals.splice(to, 0, moved);
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

export {
  selectActiveTerminalId,
  terminalsForWorkspace,
} from "@/lib/workspaceCore";
