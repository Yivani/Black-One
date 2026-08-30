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
} from "lucide-react";
import { CommandCenterButton } from "@/components/analytics/CommandCenterButton";
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
      <TipButton label="Expand sidebar" onClick={toggleSidebar}>
        <ExpandIcon className="size-4" aria-hidden />
      </TipButton>
      <div className="my-1 h-px w-6 bg-border" />
      <TipButton label="New terminal" onClick={handleNewTerminal}>
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
        label="Todo"
        onClick={() => setViewMode("todo")}
        active={viewMode === "todo"}
      >
        <ListTodo className="size-4" aria-hidden />
      </TipButton>
      <div className="flex-1" />
      <UpdateButton collapsed />
      <CommandCenterButton collapsed />
    </div>
  );
}

function ExpandedSidebar() {
  const terminals = useTerminalStore((s) => s.terminals);
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const createTerminal = useTerminalStore((s) => s.createTerminal);
  const closeTerminal = useTerminalStore((s) => s.closeTerminal);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const renameTerminal = useTerminalStore((s) => s.renameTerminal);
  const terminalColors = useTerminalStore((s) => s.terminalColors);
  const setTerminalColor = useTerminalStore((s) => s.setTerminalColor);
  const items = useTodoStore((s) => s.items);
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
  const queuedCount = items.filter((item) => item.status === "queued").length;
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
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-sm font-semibold">Workspace</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Collapse sidebar"
          onClick={toggleSidebar}
          className="size-7 text-muted-foreground"
        >
          <CollapseIcon className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="border-b border-border p-2">
        <Button
          className="w-full justify-start gap-2 rounded-md"
          onClick={handleNewTerminal}
        >
          <Plus className="size-4" aria-hidden />
          New terminal
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="p-2" aria-labelledby="sidebar-terminals">
          <div className="flex h-7 items-center justify-between px-2">
            <h2
              id="sidebar-terminals"
              className="text-xs font-medium text-muted-foreground"
            >
              Terminals
            </h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {terminals.length}
            </span>
          </div>

          <div className="space-y-0.5">
            {terminals.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No terminals open
              </p>
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
                        label: "Rename",
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
                        label: "Close terminal",
                        icon: Trash2,
                        danger: true,
                        onSelect: () => void closeTerminal(terminal.id),
                      },
                    ]}
                  >
                    <div
                      className={cn(
                        "group flex min-w-0 items-center rounded-md ring-1 ring-inset",
                        active
                          ? "bg-accent text-accent-foreground ring-border"
                          : "ring-transparent hover:bg-accent/60",
                      )}
                    >
                      {editingTerminalId === terminal.id ? (
                        <form
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            commitRename(terminal.id);
                          }}
                        >
                          <span
                            className="size-2 shrink-0 rounded-full bg-muted-foreground"
                            style={
                              color ? { backgroundColor: color } : undefined
                            }
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
                            aria-label="Terminal name"
                            className="h-7 min-w-0 flex-1 px-2 text-sm"
                            autoFocus
                          />
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectTerminal(terminal.id)}
                          onDoubleClick={() =>
                            startRename(terminal.id, terminal.title)
                          }
                          aria-current={active ? "page" : undefined}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                          <span className="min-w-0 flex-1">
                            <span
                              className="block truncate text-sm leading-4"
                              title={terminal.title}
                            >
                              {terminal.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
                              {terminal.shell}
                            </span>
                          </span>
                        </button>
                      )}
                    </div>
                  </ContextMenu>
                );
              })
            )}
          </div>
        </section>

        <section
          className="border-t border-border p-2"
          aria-labelledby="sidebar-todo"
        >
          <button
            type="button"
            onClick={() => setViewMode("todo")}
            aria-current={viewMode === "todo" ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left outline-none ring-1 ring-inset ring-transparent hover:bg-accent/60 focus-visible:ring-ring",
              viewMode === "todo" &&
                "bg-accent text-accent-foreground ring-border",
            )}
          >
            <ListTodo className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span
                id="sidebar-todo"
                className="block text-sm font-medium leading-4"
              >
                Todo
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                {items.length === 0
                  ? "No tasks"
                  : `${queuedCount} queued / ${doneCount} done`}
              </span>
            </span>
            {runnerActive && (
              <Loader2
                className="size-3.5 shrink-0 animate-spin text-primary"
                aria-label="Todo running"
              />
            )}
          </button>

          <div className="mt-1 space-y-0.5">
            {openItems.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setViewMode("todo")}
                aria-label={`Open Todo: ${item.text}`}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TodoStatusIcon
                  item={item}
                  active={runnerActive && item.id === activeTodoId}
                />
                <span className="truncate" title={item.text}>
                  {item.text}
                </span>
              </button>
            ))}
            {openItems.length === 0 && items.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5" aria-hidden />
                All tasks finished
              </div>
            )}
            {openItems.length > 4 && (
              <button
                type="button"
                onClick={() => setViewMode("todo")}
                className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {openItems.length - 4} more tasks
              </button>
            )}
          </div>
        </section>
      </div>

      <div className="flex shrink-0 flex-col gap-1 border-t border-border p-2">
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
