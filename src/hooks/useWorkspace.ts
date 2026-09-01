import { useMemo } from "react";
import { useChatStore } from "@/stores/chatStore";
import {
  useTerminalStore,
  type WorkspaceTerminal,
} from "@/stores/terminalStore";
import { useTodoStore } from "@/stores/todoStore";
import { useToolRuntimeStore } from "@/stores/toolRuntimeStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  selectActiveTerminalId,
  summarizeWorkspace,
  terminalsForWorkspace,
  type Workspace,
  type WorkspaceStatus,
} from "@/lib/workspaceCore";
import type { TodoItem } from "@/lib/todoCore";

/** The workspace currently in view. There is always exactly one. */
export function useActiveWorkspace(): Workspace {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
      workspaces[0],
    [workspaces, activeWorkspaceId],
  );
}

/** Terminals owned by the active workspace, never any others. */
export function useWorkspaceTerminals(): WorkspaceTerminal[] {
  const terminals = useTerminalStore((s) => s.terminals);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useMemo(
    () => terminalsForWorkspace(terminals, activeWorkspaceId),
    [terminals, activeWorkspaceId],
  );
}

/** Focused terminal within the active workspace. */
export function useActiveTerminalId(): string | null {
  const terminals = useTerminalStore((s) => s.terminals);
  const activeTerminalByWorkspace = useTerminalStore(
    (s) => s.activeTerminalByWorkspace,
  );
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useMemo(
    () =>
      selectActiveTerminalId(
        terminals,
        activeTerminalByWorkspace,
        activeWorkspaceId,
      ),
    [terminals, activeTerminalByWorkspace, activeWorkspaceId],
  );
}

/** Tasks on the active workspace's board. */
export function useWorkspaceTodos(): TodoItem[] {
  const items = useTodoStore((s) => s.items);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useMemo(
    () => items.filter((item) => item.workspaceId === activeWorkspaceId),
    [items, activeWorkspaceId],
  );
}

/**
 * Per-workspace activity roll-up for the sidebar indicators: whether an agent
 * is running, waiting on an approval, finished, or stopped on an error.
 */
export function useWorkspaceStatuses(): Record<string, WorkspaceStatus> {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const items = useTodoStore((s) => s.items);
  const streamingSessionId = useChatStore((s) => s.streamingSessionId);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const pendingCalls = useToolRuntimeStore((s) => s.pendingCalls);

  return useMemo(() => {
    const byWorkspace: Record<string, WorkspaceStatus> = {};
    for (const workspace of workspaces) {
      // A streaming turn and pending approvals belong to whichever workspace
      // is driving the shared chat session — the active one.
      const isDriving = workspace.id === activeWorkspaceId;
      byWorkspace[workspace.id] = summarizeWorkspace({
        todos: items.filter((item) => item.workspaceId === workspace.id),
        streaming: isDriving && streamingSessionId !== null,
        pendingApprovals: isDriving ? pendingCalls.length : 0,
      });
    }
    return byWorkspace;
  }, [workspaces, items, streamingSessionId, activeWorkspaceId, pendingCalls]);
}
