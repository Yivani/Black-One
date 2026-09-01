import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { generateId } from "@/lib/utils";
import { deriveWorkspaceName, type Workspace } from "@/lib/workspaceCore";

const STORAGE_KEY = "workspace:list";

interface PersistedWorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  /** Terminal each workspace should reopen on, when it still exists. */
  defaultTerminalByWorkspace: Record<string, string | null>;
}

interface WorkspaceState extends PersistedWorkspaceState {
  createWorkspace: (options?: {
    path?: string | null;
    name?: string;
    activate?: boolean;
  }) => Workspace;
  renameWorkspace: (id: string, name: string) => void;
  setWorkspaceColor: (id: string, color: string | null) => void;
  setWorkspacePath: (id: string, path: string | null) => void;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  setDefaultTerminal: (workspaceId: string, terminalId: string | null) => void;
  reorderWorkspaces: (fromIndex: number, toIndex: number) => void;
}

function makeWorkspace(name: string, path: string | null): Workspace {
  return {
    id: generateId(),
    name,
    path,
    color: null,
    createdAt: Date.now(),
  };
}

function readPersisted(): PersistedWorkspaceState {
  const fallback = (): PersistedWorkspaceState => {
    const first = makeWorkspace("Workspace", null);
    return {
      workspaces: [first],
      activeWorkspaceId: first.id,
      defaultTerminalByWorkspace: {},
    };
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback();
    const stored = JSON.parse(raw) as Partial<PersistedWorkspaceState>;
    const workspaces = Array.isArray(stored.workspaces)
      ? stored.workspaces.filter(
          (workspace): workspace is Workspace =>
            !!workspace &&
            typeof workspace.id === "string" &&
            typeof workspace.name === "string",
        )
      : [];
    if (workspaces.length === 0) return fallback();

    const activeWorkspaceId = workspaces.some(
      (workspace) => workspace.id === stored.activeWorkspaceId,
    )
      ? (stored.activeWorkspaceId as string)
      : workspaces[0].id;

    return {
      workspaces,
      activeWorkspaceId,
      // Terminals do not survive a restart, so their ids are dropped.
      defaultTerminalByWorkspace: {},
    };
  } catch {
    return fallback();
  }
}

function persist(state: WorkspaceState): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
    );
  } catch {
    // Best-effort when the webview blocks local storage.
  }
}

export const useWorkspaceStore = create<WorkspaceState>()(
  immer((set, get) => ({
    ...readPersisted(),

    createWorkspace: ({ path = null, name, activate = true } = {}) => {
      const existing = get().workspaces.map((workspace) => workspace.name);
      const workspace = makeWorkspace(
        name?.trim() || deriveWorkspaceName(path, existing),
        path,
      );
      set((state) => {
        state.workspaces.push(workspace);
        if (activate) state.activeWorkspaceId = workspace.id;
      });
      persist(get());
      return workspace;
    },

    renameWorkspace: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      set((state) => {
        const workspace = state.workspaces.find((item) => item.id === id);
        if (workspace) workspace.name = trimmed;
      });
      persist(get());
    },

    setWorkspaceColor: (id, color) => {
      set((state) => {
        const workspace = state.workspaces.find((item) => item.id === id);
        if (workspace) workspace.color = color;
      });
      persist(get());
    },

    setWorkspacePath: (id, path) => {
      set((state) => {
        const workspace = state.workspaces.find((item) => item.id === id);
        if (workspace) workspace.path = path;
      });
      persist(get());
    },

    removeWorkspace: (id) => {
      set((state) => {
        // Never leave the app with no workspace to be in.
        if (state.workspaces.length <= 1) return;
        const index = state.workspaces.findIndex((item) => item.id === id);
        if (index < 0) return;
        state.workspaces.splice(index, 1);
        delete state.defaultTerminalByWorkspace[id];
        if (state.activeWorkspaceId === id) {
          const next = state.workspaces[index] ?? state.workspaces[index - 1];
          state.activeWorkspaceId = next?.id ?? state.workspaces[0].id;
        }
      });
      persist(get());
    },

    setActiveWorkspace: (id) => {
      set((state) => {
        if (state.workspaces.some((workspace) => workspace.id === id)) {
          state.activeWorkspaceId = id;
        }
      });
      persist(get());
    },

    setDefaultTerminal: (workspaceId, terminalId) => {
      set((state) => {
        state.defaultTerminalByWorkspace[workspaceId] = terminalId;
      });
    },

    reorderWorkspaces: (fromIndex, toIndex) => {
      set((state) => {
        const [moved] = state.workspaces.splice(fromIndex, 1);
        if (moved) state.workspaces.splice(toIndex, 0, moved);
      });
      persist(get());
    },
  })),
);

/** The active workspace, or the first one — there is always at least one. */
export function getActiveWorkspace(): Workspace {
  const { workspaces, activeWorkspaceId } = useWorkspaceStore.getState();
  return (
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    workspaces[0]
  );
}
