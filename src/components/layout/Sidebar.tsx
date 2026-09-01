import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { CommandCenterButton } from "@/components/analytics/CommandCenterButton";
import { MemoryIndicator } from "@/components/memory/MemoryIndicator";
import { UpdateButton } from "@/components/analytics/UpdateButton";
import { ContextMenu } from "@/components/shared/ContextMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  CollapsedWorkspaceRail,
  WorkspaceSwitcher,
} from "@/components/layout/WorkspaceSwitcher";
import {
  SidebarEmpty,
  SidebarIconAction,
  SidebarSection,
  SIDEBAR_ROW,
  SIDEBAR_ROW_ACTIVE,
  SIDEBAR_ROW_IDLE,
  SIDEBAR_ROW_REVEAL,
} from "@/components/layout/SidebarPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useActiveTerminalId,
  useWorkspaceTerminals,
  useWorkspaceTodos,
} from "@/hooks/useWorkspace";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useTodoStore } from "@/stores/todoStore";
import { useUiStore } from "@/stores/uiStore";
import type { TodoItem } from "@/lib/todoCore";

const TERMINAL_COLORS = [
  { label: "Default", value: null, swatch: "#737373" },
  { label: "Slate", value: "#64748b", swatch: "#64748b" },
  { label: "Moss", value: "#2e7d4f", swatch: "#2e7d4f" },
  { label: "Ochre", value: "#b45309", swatch: "#b45309" },
  { label: "Iris", value: "#6d5bd0", swatch: "#6d5bd0" },
] as const;

interface TipButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
}

function TipButton({ label, onClick, children, active }: TipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-current={active ? "page" : undefined}
          onClick={onClick}
          className={cn(
            "size-8",
            active && "bg-accent text-accent-foreground",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function TodoStatusIcon({
  item,
  active,
}: {
  item: TodoItem;
  active: boolean;
}) {
  if (item.status === "working" || active) {
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />;
  }
  return (
    <Circle
      className={cn(
        "size-3 shrink-0",
        item.status === "blocked" || item.status === "error"
          ? "fill-destructive text-destructive"
          : "text-muted-foreground",
      )}
    />
  );
}

function CollapsedRail() {
  const { t } = useTranslation();
  const createTerminal = useTerminalStore((s) => s.createTerminal);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const viewMode = useUiStore((s) => s.viewMode);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const sidebarPosition = useSettingsStore(
    (s) => s.settings.appearance.sidebarPosition,
  );
  const ExpandIcon =
    sidebarPosition === "left" ? ChevronRight : ChevronLeft;

  const handleNewTerminal = () => {
    setViewMode("code");
    void createTerminal();
  };

  return (
    <div className="flex h-full flex-col items-center gap-1 py-2">
      <TipButton label={t("sidebar.expand")} onClick={toggleSidebar}>
        <ExpandIcon className="size-4" aria-hidden />
      </TipButton>
      <div className="my-1 h-px w-6 bg-border" />
      <CollapsedWorkspaceRail />
      <div className="my-1 h-px w-6 bg-border" />
      <TipButton label={t("sidebar.newTerminal")} onClick={handleNewTerminal}>
        <Plus className="size-4" aria-hidden />
      </TipButton>
      <TipButton
        label="Code"
        onClick={() => setViewMode("code")}
        active={viewMode === "code"}
      >
        <Terminal className="size-4" aria-hidden />
      </TipButton>
      <TipButton
        label={t("sidebar.tasks")}
        onClick={() => setViewMode("todo")}
        active={viewMode === "todo"}
      >
        <ListTodo className="size-4" aria-hidden />
      </TipButton>
      <div className="flex-1" />
      <MemoryIndicator collapsed />
      <UpdateButton collapsed />
      <CommandCenterButton collapsed />
    </div>
  );
}

function ExpandedSidebar() {
  const { t } = useTranslation();
  const terminals = useWorkspaceTerminals();
  const activeTerminalId = useActiveTerminalId();
  const createTerminal = useTerminalStore((s) => s.createTerminal);
  const closeTerminal = useTerminalStore((s) => s.closeTerminal);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const renameTerminal = useTerminalStore((s) => s.renameTerminal);
  const terminalColors = useTerminalStore((s) => s.terminalColors);
  const setTerminalColor = useTerminalStore((s) => s.setTerminalColor);
  const items = useWorkspaceTodos();
  const runnerActive = useTodoStore((s) => s.runnerActive);
  const activeTodoId = useTodoStore((s) => s.activeTodoId);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const viewMode = useUiStore((s) => s.viewMode);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const sidebarPosition = useSettingsStore(
    (s) => s.settings.appearance.sidebarPosition,
  );
  const CollapseIcon =
    sidebarPosition === "left" ? ChevronLeft : ChevronRight;
  const [editingTerminalId, setEditingTerminalId] = useState<string | null>(
    null,
  );
  const [terminalName, setTerminalName] = useState("");
  const cancelTerminalRename = useRef(false);

  const openItems = items.filter((item) => item.status !== "done");
  const doneCount = items.filter((item) => item.status === "done").length;

  const handleNewTerminal = () => {
    setViewMode("code");
    void createTerminal();
  };

  const handleSelectTerminal = (id: string) => {
    setActiveTerminal(id);
    setViewMode("code");
  };

  const startRename = (id: string, title: string) => {
    cancelTerminalRename.current = false;
    setTerminalName(title);
    setEditingTerminalId(id);
  };

  const commitRename = (id: string) => {
    if (cancelTerminalRename.current) {
      cancelTerminalRename.current = false;
      setEditingTerminalId(null);
      return;
    }
    const title = terminalName.trim();
    if (title) renameTerminal(id, title);
    setEditingTerminalId(null);
  };

  return (
    <>
      <WorkspaceSwitcher
        actions={
          <SidebarIconAction label={t("sidebar.collapse")} onClick={toggleSidebar}>
            <CollapseIcon className="size-4" aria-hidden />
          </SidebarIconAction>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarSection
          id="sidebar-terminals"
          label={t("sidebar.terminals")}
          count={terminals.length}
          actions={
            <SidebarIconAction label={t("sidebar.newTerminal")} onClick={handleNewTerminal}>
              <Plus className="size-4" aria-hidden />
            </SidebarIconAction>
          }
        >
          {terminals.length === 0 ? (
              <SidebarEmpty>{t("sidebar.noTerminals")}</SidebarEmpty>
            ) : (
              terminals.map((terminal) => {
                const active =
                  viewMode === "code" && terminal.id === activeTerminalId;
                const color = terminalColors[terminal.id] ?? null;
                return (
                  <ContextMenu
                    key={terminal.id}
                    items={[
                      {
                        label: t("common.edit"),
                        icon: Pencil,
                        onSelect: () =>
                          startRename(terminal.id, terminal.title),
                        separatorAfter: true,
                      },
                      ...TERMINAL_COLORS.map((option, index) => ({
                        label: `Color: ${option.label}`,
                        swatch: {
                          color: option.swatch,
                          selected: color === option.value,
                        },
                        onSelect: () =>
                          setTerminalColor(terminal.id, option.value),
                        separatorAfter: index === TERMINAL_COLORS.length - 1,
                      })),
                      {
                        label: t("common.close"),
                        icon: Trash2,
                        danger: true,
                        onSelect: () => void closeTerminal(terminal.id),
                      },
                    ]}
                  >
                    <div
                      className={cn(
                        SIDEBAR_ROW,
                        active ? SIDEBAR_ROW_ACTIVE : SIDEBAR_ROW_IDLE,
                        "pr-1",
                      )}
                    >
                      {editingTerminalId === terminal.id ? (
                        <form
                          className="flex min-w-0 flex-1 items-center gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            commitRename(terminal.id);
                          }}
                        >
                          <Terminal
                            className="size-3.5 shrink-0 text-muted-foreground"
                            style={color ? { color } : undefined}
                            aria-hidden
                          />
                          <Input
                            value={terminalName}
                            onChange={(event) =>
                              setTerminalName(event.target.value)
                            }
                            onBlur={() => commitRename(terminal.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                cancelTerminalRename.current = true;
                                setEditingTerminalId(null);
                              }
                            }}
                            aria-label={t("sidebar.terminals")}
                            className="h-6 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                            autoFocus
                          />
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSelectTerminal(terminal.id)}
                            onDoubleClick={() =>
                              startRename(terminal.id, terminal.title)
                            }
                            aria-current={active ? "page" : undefined}
                            /* The shell name lives here rather than on a second
                               line: the title already contains it. */
                            title={
                              terminal.exited
                                ? `${terminal.title} — ${terminal.shell} (exited)`
                                : `${terminal.title} — ${terminal.shell}`
                            }
                            className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
                          >
                            <Terminal
                              className={cn(
                                "size-3.5 shrink-0",
                                !color &&
                                  (active
                                    ? "text-foreground"
                                    : "text-muted-foreground"),
                              )}
                              style={color ? { color } : undefined}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate",
                                terminal.exited && "text-muted-foreground",
                              )}
                            >
                              {terminal.title}
                            </span>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${t("common.close")} ${terminal.title}`}
                            onClick={() => void closeTerminal(terminal.id)}
                            className={cn(
                              SIDEBAR_ROW_REVEAL,
                              "size-5 text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <X className="size-3.5" aria-hidden />
                          </Button>
                        </>
                      )}
                    </div>
                  </ContextMenu>
                );
              })
            )}
        </SidebarSection>

        <SidebarSection
          id="sidebar-todo"
          label={t("sidebar.tasks")}
          // Last section: no trailing rule left hanging over empty space.
          className="border-b-0"
          // Count what is listed below it: open work, not finished work.
          count={openItems.length || undefined}
          actions={
            <>
              {runnerActive && (
                <Loader2
                  className="size-3.5 shrink-0 animate-spin text-primary"
                  aria-label="Todo running"
                />
              )}
              <SidebarIconAction
                label={t("sidebar.tasks")}
                onClick={() => setViewMode("todo")}
              >
                <ListTodo className="size-4" aria-hidden />
              </SidebarIconAction>
            </>
          }
        >
          {items.length === 0 ? (
            <SidebarEmpty>{t("sidebar.noTasks")}</SidebarEmpty>
          ) : openItems.length === 0 ? (
            <div
              className={cn(SIDEBAR_ROW, "text-xs text-muted-foreground")}
            >
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">All {doneCount} tasks finished</span>
            </div>
          ) : (
            <>
              {openItems.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setViewMode("todo")}
                  aria-label={`Open Todo: ${item.text}`}
                  title={item.text}
                  className={cn(
                    SIDEBAR_ROW,
                    SIDEBAR_ROW_IDLE,
                    "text-xs text-muted-foreground hover:text-foreground",
                  )}
                >
                  <TodoStatusIcon
                    item={item}
                    active={runnerActive && item.id === activeTodoId}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.text}</span>
                </button>
              ))}
              {openItems.length > 5 && (
                <button
                  type="button"
                  onClick={() => setViewMode("todo")}
                  className={cn(
                    SIDEBAR_ROW,
                    SIDEBAR_ROW_IDLE,
                    "pl-[26px] text-xs text-muted-foreground hover:text-foreground",
                  )}
                >
                  {openItems.length - 5} more
                </button>
              )}
            </>
          )}
        </SidebarSection>
      </div>

      <div className="flex shrink-0 flex-col gap-1 border-t border-border p-1.5">
        <MemoryIndicator />
        <UpdateButton />
        <CommandCenterButton />
      </div>
    </>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const width = useUiStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const sidebarPosition = useSettingsStore(
    (s) => s.settings.appearance.sidebarPosition,
  );
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragState.current = { startX: event.clientX, startWidth: width };
    setIsDraggingHandle(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    setSidebarWidth(
      sidebarPosition === "left"
        ? drag.startWidth + delta
        : drag.startWidth - delta,
    );
  };

  const endHandleDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current = null;
    setIsDraggingHandle(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col bg-background",
        sidebarPosition === "left"
          ? "border-r border-border"
          : "border-l border-border",
        collapsed && "w-sidebar-collapsed",
        !isDraggingHandle && "transition-standard",
      )}
      style={collapsed ? undefined : { width }}
    >
      {collapsed ? <CollapsedRail /> : <ExpandedSidebar />}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endHandleDrag}
          onPointerCancel={endHandleDrag}
          className={cn(
            "absolute inset-y-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-accent",
            sidebarPosition === "left" ? "right-0" : "left-0",
          )}
        />
      )}
    </aside>
  );
}
