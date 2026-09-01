import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  Check,
  CircleAlert,
  FolderOpen,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ContextMenu } from "@/components/shared/ContextMenu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SidebarSection,
  SIDEBAR_ROW,
  SIDEBAR_ROW_ACTIVE,
  SIDEBAR_ROW_IDLE,
} from "@/components/layout/SidebarPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkspaceStatuses } from "@/hooks/useWorkspace";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import type { WorkspaceActivity, WorkspaceStatus } from "@/lib/workspaceCore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useTodoStore } from "@/stores/todoStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const WORKSPACE_COLORS = [
  { label: "Default", value: null, swatch: "#737373" },
  { label: "Slate", value: "#64748b", swatch: "#64748b" },
  { label: "Moss", value: "#2e7d4f", swatch: "#2e7d4f" },
  { label: "Ochre", value: "#b45309", swatch: "#b45309" },
  { label: "Iris", value: "#6d5bd0", swatch: "#6d5bd0" },
] as const;

/**
 * One glyph per activity so a workspace's state reads at a glance. Idle renders
 * nothing — a row with no badge is the quiet default, which keeps the badges
 * that do appear meaningful.
 */
export function WorkspaceActivityDot({
  status,
  className,
}: {
  status: WorkspaceStatus;
  className?: string;
}) {
  const shared = cn("size-3.5 shrink-0", className);
  switch (status.activity) {
    case "running":
      return (
        <Loader2 className={cn(shared, "animate-spin text-primary")} aria-hidden />
      );
    case "waiting":
      return <CircleAlert className={cn(shared, "text-amber-500")} aria-hidden />;
    case "error":
      return (
        <CircleAlert className={cn(shared, "text-destructive")} aria-hidden />
      );
    case "done":
      return <Check className={cn(shared, "text-emerald-500")} aria-hidden />;
    default:
      return null;
  }
}

/**
 * Builds the "Running, 3 open" line used by tooltips and screen readers.
 * A hook so it follows the active language rather than baking English in.
 */
function useDescribeStatus(): (status: WorkspaceStatus) => string {
  const { t } = useTranslation();
  return useCallback(
    (status: WorkspaceStatus) => {
      const parts = [t(`status.${status.activity}`)];
      if (status.open > 0) {
        parts.push(t("status.queuedCount", { count: status.open }));
      }
      return parts.join(", ");
    },
    [t],
  );
}

function useWorkspaceActions() {
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const createTerminal = useTerminalStore((s) => s.createTerminal);
  const setViewMode = useUiStore((s) => s.setViewMode);

  const addWorkspace = async (withFolder: boolean) => {
    const path = withFolder ? await ipc.pickWorkspaceFolder() : null;
    if (withFolder && !path) return;
    const workspace = createWorkspace({ path });
    setViewMode("code");
    await createTerminal(undefined, undefined, workspace.id);
  };

  const openWorkspace = (id: string) => {
    setActiveWorkspace(id);
    setViewMode("code");
  };

  return { addWorkspace, openWorkspace };
}

/** Shared "add workspace" menu: from a folder, or empty. */
function AddWorkspaceMenu() {
  const { t } = useTranslation();
  const { addWorkspace } = useWorkspaceActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("sidebar.newWorkspace")}
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => void addWorkspace(true)}>
          <FolderOpen className="mr-2 size-3.5" aria-hidden />
          {t("sidebar.openFolder")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void addWorkspace(false)}>
          <FolderPlus className="mr-2 size-3.5" aria-hidden />
          {t("sidebar.emptyWorkspace")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CollapsedWorkspaceRail() {
  const describeStatus = useDescribeStatus();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const statuses = useWorkspaceStatuses();
  const { openWorkspace } = useWorkspaceActions();

  if (workspaces.length <= 1) return null;

  return (
    <div className="flex w-full flex-col items-center gap-1">
      {workspaces.map((workspace) => {
        const status = statuses[workspace.id];
        const active = workspace.id === activeWorkspaceId;
        return (
          <Tooltip key={workspace.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => openWorkspace(workspace.id)}
                aria-current={active ? "true" : undefined}
                aria-label={`${workspace.name}. ${describeStatus(status)}`}
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-md border transition-standard",
                  active
                    ? "border-border bg-accent text-accent-foreground"
                    : "border-transparent hover:bg-accent/60",
                )}
              >
                <span
                  className="flex size-5 items-center justify-center rounded-[4px] text-[10px] font-bold uppercase leading-none"
                  style={
                    workspace.color
                      ? { backgroundColor: workspace.color, color: "#fff" }
                      : undefined
                  }
                >
                  {workspace.name.slice(0, 1)}
                </span>
                {status.activity !== "idle" && (
                  <span className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-background p-[1px]">
                    <WorkspaceActivityDot status={status} className="size-2.5" />
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {workspace.name} — {describeStatus(status)}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function WorkspaceSwitcher({ actions }: { actions?: ReactNode }) {
  const { t } = useTranslation();
  const describeStatus = useDescribeStatus();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);
  const setWorkspaceColor = useWorkspaceStore((s) => s.setWorkspaceColor);
  const setWorkspacePath = useWorkspaceStore((s) => s.setWorkspacePath);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);
  const closeWorkspaceTerminals = useTerminalStore(
    (s) => s.closeWorkspaceTerminals,
  );
  const removeWorkspaceTodos = useTodoStore((s) => s.removeWorkspaceTodos);
  const terminals = useTerminalStore((s) => s.terminals);
  const statuses = useWorkspaceStatuses();
  const { openWorkspace } = useWorkspaceActions();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const cancelRename = useRef(false);

  const startRename = (id: string, name: string) => {
    cancelRename.current = false;
    setDraftName(name);
    setEditingId(id);
  };

  const commitRename = (id: string) => {
    if (cancelRename.current) {
      cancelRename.current = false;
      setEditingId(null);
      return;
    }
    renameWorkspace(id, draftName);
    setEditingId(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (workspaces.length <= 1) {
      toast.error("Keep at least one workspace.");
      return;
    }
    await closeWorkspaceTerminals(id);
    removeWorkspaceTodos(id);
    removeWorkspace(id);
    toast.success(`Closed ${name}`);
  };

  const handleChangeFolder = async (id: string) => {
    const path = await ipc.pickWorkspaceFolder();
    if (!path) return;
    setWorkspacePath(id, path);
    toast.success("Workspace folder updated", {
      description: "New terminals in this workspace will open here.",
    });
  };

  return (
    <SidebarSection
      lead
      id="sidebar-workspaces"
      label={t("sidebar.workspaces")}
      count={workspaces.length}
      actions={
        <>
          <AddWorkspaceMenu />
          {actions}
        </>
      }
    >
      {workspaces.map((workspace) => {
        const status = statuses[workspace.id];
        const active = workspace.id === activeWorkspaceId;
        const shells = terminals.filter(
          (terminal) => terminal.workspaceId === workspace.id,
        ).length;

        if (editingId === workspace.id) {
          return (
            <form
              key={workspace.id}
              className={cn(SIDEBAR_ROW, "gap-2")}
              onSubmit={(event) => {
                event.preventDefault();
                commitRename(workspace.id);
              }}
            >
              <span
                className="size-2 shrink-0 rounded-full bg-muted-foreground"
                style={
                  workspace.color
                    ? { backgroundColor: workspace.color }
                    : undefined
                }
                aria-hidden
              />
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => commitRename(workspace.id)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    cancelRename.current = true;
                    setEditingId(null);
                  }
                }}
                aria-label={t("sidebar.renameWorkspace")}
                autoFocus
                className="h-6 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
              />
            </form>
          );
        }

        return (
          <ContextMenu
            key={workspace.id}
            items={[
              {
                label: t("sidebar.renameWorkspace"),
                icon: Pencil,
                onSelect: () => startRename(workspace.id, workspace.name),
              },
              {
                label: t("sidebar.openFolder"),
                icon: FolderOpen,
                onSelect: () => void handleChangeFolder(workspace.id),
                separatorAfter: true,
              },
              ...WORKSPACE_COLORS.map((option, index) => ({
                label: `Color: ${option.label}`,
                swatch: {
                  color: option.swatch,
                  selected: workspace.color === option.value,
                },
                onSelect: () => setWorkspaceColor(workspace.id, option.value),
                separatorAfter: index === WORKSPACE_COLORS.length - 1,
              })),
              {
                label: t("sidebar.closeWorkspace"),
                icon: Trash2,
                danger: true,
                onSelect: () => void handleDelete(workspace.id, workspace.name),
              },
            ]}
          >
            <button
              type="button"
              onClick={() => openWorkspace(workspace.id)}
              onDoubleClick={() => startRename(workspace.id, workspace.name)}
              aria-current={active ? "true" : undefined}
              aria-label={`${workspace.name}. ${describeStatus(status)}`}
              title={workspace.path ?? undefined}
              className={cn(
                SIDEBAR_ROW,
                active ? SIDEBAR_ROW_ACTIVE : SIDEBAR_ROW_IDLE,
              )}
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  active ? "bg-foreground" : "bg-muted-foreground/60",
                )}
                style={
                  workspace.color
                    ? { backgroundColor: workspace.color }
                    : undefined
                }
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              <WorkspaceActivityDot status={status} />
              {/* A bare number reads as an unexplained badge; the glyph says
                  what it counts, and zero shells is simply not shown. */}
              {shells > 0 && (
                <span
                  className="flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-muted-foreground"
                  title={`${shells} ${shells === 1 ? "terminal" : "terminals"}`}
                >
                  <TerminalSquare className="size-3" aria-hidden />
                  {shells}
                </span>
              )}
            </button>
          </ContextMenu>
        );
      })}
    </SidebarSection>
  );
}
