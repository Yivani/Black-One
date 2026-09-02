import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  Circle,
  GripVertical,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Square,
  Terminal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, generateId } from "@/lib/utils";
import {
  getNextTodo,
  TODO_PRIORITIES,
  type TodoItem,
  type TodoPriority,
} from "@/lib/todoCore";
import {
  CLI_TOOLS,
  buildCliTaskCommand,
  type CliTool,
  type CliToolId,
} from "@/lib/cliTools";
import { ipc, isTauri, type CliToolStatus } from "@/lib/ipc";
import { executeTool } from "@/lib/tools";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useUiStore } from "@/stores/uiStore";
import { getActiveWorkspace, useWorkspaceStore } from "@/stores/workspaceStore";
import {
  useActiveWorkspace,
  useWorkspaceTerminals,
  useWorkspaceTodos,
} from "@/hooks/useWorkspace";
import { resolveTaskTerminal } from "@/lib/workspaceCore";
import { useTodoStore } from "@/stores/todoStore";
import { useToolRuntimeStore } from "@/stores/toolRuntimeStore";

const PRIORITY_META: Record<
  TodoPriority,
  { label: string; dot: string; text: string; surface: string }
> = {
  critical: {
    label: "Critical",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    surface: "bg-red-500/8",
  },
  high: {
    label: "High",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    surface: "bg-orange-500/8",
  },
  mid: {
    label: "Mid",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    surface: "bg-amber-500/8",
  },
  low: {
    label: "Low",
    dot: "bg-slate-500",
    text: "text-slate-600 dark:text-slate-400",
    surface: "bg-slate-500/8",
  },
};

function PriorityAgentSelect({
  priority,
  agents,
  loading,
}: {
  priority: TodoPriority;
  agents: CliTool[];
  loading: boolean;
}) {
  const configured = useTodoStore(
    (state) => state.modelByPriority[priority],
  );
  const setPriorityModel = useTodoStore((state) => state.setPriorityModel);
  const active = agents.find((agent) => configured === `cli::${agent.id}`);

  return (
    <Select
      value={active ? `cli::${active.id}` : undefined}
      onValueChange={(modelId) => setPriorityModel(priority, modelId)}
      disabled={loading || agents.length === 0}
    >
      <SelectTrigger
        size="sm"
        className="h-7 min-w-0 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-1"
        aria-label={`${PRIORITY_META[priority].label} priority CLI agent`}
      >
        <SelectValue
          placeholder={loading ? "Checking agents..." : "Choose agent"}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Installed CLI agents</SelectLabel>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={`cli::${agent.id}`}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function TodoTerminalSelect({ item }: { item: TodoItem }) {
  // Only this workspace's shells: a task must never reach into another one.
  const terminals = useWorkspaceTerminals();
  const updateTodo = useTodoStore((state) => state.updateTodo);
  const busy = item.status === "working" || item.status === "blocked";
  const known = terminals.some((terminal) => terminal.id === item.terminalId);
  const value = item.terminalId && known ? item.terminalId : "__none__";

  return (
    <Select
      value={value}
      onValueChange={(next) =>
        updateTodo(item.id, {
          terminalId: next === "__none__" ? undefined : next,
        })
      }
      disabled={busy}
    >
      <SelectTrigger
        size="sm"
        className="h-6 w-28 border-0 bg-muted/60 px-2 text-[11px] shadow-none focus-visible:ring-1"
        aria-label={`Terminal for ${item.text}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <Terminal className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          <SelectValue placeholder="Terminal" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">None</SelectItem>
        {terminals.map((terminal) => (
          <SelectItem key={terminal.id} value={terminal.id}>
            {terminal.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TodoStatus({ item }: { item: TodoItem }) {
  if (item.status === "working") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Pass {item.pass ?? 1}/{item.multiAgent ? 2 : 1} working
      </span>
    );
  }
  if (item.status === "error") {
    return (
      <span
        className="flex min-w-0 items-start gap-1.5 text-xs text-destructive"
        title={item.error}
      >
        <X className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span className="line-clamp-2 break-words">
          {item.error ?? "Work stopped"}
        </span>
      </span>
    );
  }
  if (item.status === "done") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <Check className="size-3" aria-hidden />
        Done
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Circle className="size-3" aria-hidden />
      Queued
    </span>
  );
}

function TodoCardOverlay({ item }: { item: TodoItem }) {
  return (
    <article
      className={cn(
        "rounded-md border bg-background p-2.5 shadow-lg",
        item.status === "done" && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-1 size-4 text-muted-foreground" aria-hidden />
        <span
          className={cn(
            "h-auto min-w-0 flex-1 text-sm",
            item.status === "done" && "line-through",
          )}
        >
          {item.text}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 pl-6">
        <TodoStatus item={item} />
      </div>
    </article>
  );
}

function TodoCard({ item }: { item: TodoItem }) {
  const [draft, setDraft] = useState(item.text);
  const updateTodo = useTodoStore((state) => state.updateTodo);
  const moveTodo = useTodoStore((state) => state.moveTodo);
  const removeTodo = useTodoStore((state) => state.removeTodo);
  const busy = item.status === "working";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: busy });

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(item.text);
      return;
    }
    if (trimmed !== item.text) updateTodo(item.id, { text: trimmed });
  };
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
      }}
      className={cn(
        "group rounded-md border bg-background p-2.5 transition-standard",
        "focus-within:border-foreground/30 hover:border-foreground/20",
        item.status === "done" && "opacity-60",
        isDragging && "opacity-0",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={busy}
          aria-label={`Drag ${item.text}`}
          className="mt-1 cursor-grab text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground disabled:cursor-not-allowed disabled:opacity-40 active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(item.text);
              event.currentTarget.blur();
            }
          }}
          disabled={busy}
          aria-label="Todo text"
          className={cn(
            "h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0",
            item.status === "done" && "line-through",
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => removeTodo(item.id)}
          disabled={busy}
          aria-label={`Delete ${item.text}`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 pl-6">
        <TodoStatus item={item} />
        <div className="flex items-center gap-0.5">
          {item.status === "error" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              onClick={() =>
                updateTodo(item.id, {
                  status: "queued",
                  error: undefined,
                  sessionId: undefined,
                  pass: undefined,
                  blockedMessageId: undefined,
                })
              }
              aria-label={`Retry ${item.text}`}
            >
              <RotateCcw className="size-3.5" aria-hidden />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={item.multiAgent}
            onClick={() =>
              updateTodo(item.id, { multiAgent: !item.multiAgent })
            }
            disabled={busy || item.status === "done"}
            className={cn(
              "h-6 gap-1 px-1.5 text-[11px] text-muted-foreground",
              item.multiAgent && "bg-muted text-foreground",
            )}
          >
            <Users className="size-3" aria-hidden />
            Multi
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            onClick={() =>
              updateTodo(item.id, {
                status: item.status === "done" ? "queued" : "done",
                error: undefined,
              })
            }
            disabled={busy}
            aria-label={
              item.status === "done"
                ? `Return ${item.text} to queue`
                : `Mark ${item.text} done`
            }
          >
            <Check className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 pl-6">
        <Select
          value={item.priority}
          onValueChange={(priority: TodoPriority) =>
            moveTodo(item.id, priority)
          }
          disabled={busy}
        >
          <SelectTrigger
            size="sm"
            className="h-6 w-24 border-0 bg-muted/60 px-2 text-[11px] shadow-none focus-visible:ring-1"
            aria-label={`Priority for ${item.text}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TODO_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_META[priority].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TodoTerminalSelect item={item} />
      </div>
    </article>
  );
}

function PriorityLane({
  priority,
  items,
  agents,
  agentsLoading,
}: {
  priority: TodoPriority;
  items: TodoItem[];
  agents: CliTool[];
  agentsLoading: boolean;
}) {
  const [text, setText] = useState("");
  const addTodo = useTodoStore((state) => state.addTodo);
  const { setNodeRef, isOver } = useDroppable({ id: `lane:${priority}` });
  const meta = PRIORITY_META[priority];

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`todo-${priority}`}
      className={cn(
        "flex min-h-full min-w-0 flex-col rounded-lg border border-border bg-background/50",
        isOver && meta.surface,
      )}
    >
      <header className="border-b border-border px-3 py-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden />
          <h2
            id={`todo-${priority}`}
            className={cn("text-sm font-semibold", meta.text)}
          >
            {meta.label}
          </h2>
          <span className="ml-auto tabular-nums text-xs text-muted-foreground">
            {items.length}
          </span>
        </div>
        <div className="mt-1.5">
          <PriorityAgentSelect
            priority={priority}
            agents={agents}
            loading={agentsLoading}
          />
        </div>
      </header>

      <form
        className="flex gap-1.5 border-b border-border px-2 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          addTodo(text, priority);
          setText("");
        }}
      >
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Add ${meta.label.toLowerCase()} task`}
          aria-label={`Add ${meta.label} Todo`}
          className="h-8 min-w-0 text-xs"
        />
        <Button
          type="submit"
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          disabled={!text.trim()}
          aria-label={`Add ${meta.label} Todo`}
        >
          <Plus className="size-3.5" aria-hidden />
        </Button>
      </form>

      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2 p-2">
          {items.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No {meta.label.toLowerCase()} tasks
            </p>
          )}
          {items.map((item) => (
            <TodoCard key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

type RunResult = "done" | "error" | "stopped";
const TODO_CLI_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The run in flight, so Stop can interrupt the CLI agent holding the terminal
 * instead of waiting out its ten-minute timeout.
 */
let activeRun: AbortController | null = null;

function selectedCliId(
  selection: string | null,
  installedIds: ReadonlySet<CliToolId>,
): CliToolId | null {
  if (!selection?.startsWith("cli::")) return null;
  const id = selection.slice(5) as CliToolId;
  return installedIds.has(id) ? id : null;
}

async function executeTodo(
  todoId: string,
  installedIds: ReadonlySet<CliToolId>,
  signal: AbortSignal,
): Promise<RunResult> {
  const todoStore = useTodoStore.getState();
  const item = todoStore.items.find((todo) => todo.id === todoId);
  if (!item) return "error";

  const cliId = selectedCliId(
    todoStore.modelByPriority[item.priority],
    installedIds,
  );
  if (!cliId) {
    todoStore.updateTodo(todoId, {
      status: "error",
      error: `Choose an installed CLI agent for ${PRIORITY_META[item.priority].label}.`,
    });
    return "error";
  }

  const workspaceId = item.workspaceId ?? getActiveWorkspace().id;
  const workspace = useWorkspaceStore
    .getState()
    .workspaces.find((entry) => entry.id === workspaceId);
  const terminalStore = useTerminalStore.getState();
  const workspaceTerminals = terminalStore.terminals.filter(
    (terminal) => terminal.workspaceId === workspaceId && !terminal.exited,
  );
  // A stored terminal id goes stale on every restart, so fall back to the
  // workspace's own default rather than running in the wrong shell.
  let todoTerminalId = resolveTaskTerminal(
    item.terminalId,
    workspaceTerminals.map((terminal) => terminal.id),
    useWorkspaceStore.getState().defaultTerminalByWorkspace[workspaceId] ??
      null,
  );
  if (!todoTerminalId) {
    const created = await terminalStore.createTerminal(
      workspace?.path ?? undefined,
      undefined,
      workspaceId,
    );
    todoTerminalId = created?.id;
    if (todoTerminalId) {
      todoStore.updateTodo(todoId, { terminalId: todoTerminalId });
    }
  }
  if (!todoTerminalId) {
    todoStore.updateTodo(todoId, {
      status: "error",
      error: "Could not open a terminal for this task.",
    });
    return "error";
  }
  terminalStore.setActiveTerminal(todoTerminalId);

  // A stopped task goes back to the queue rather than to an error: nothing
  // went wrong, and Start work should pick it up again where it left off.
  const requeue = () => {
    todoStore.updateTodo(todoId, {
      status: "queued",
      pass: undefined,
      error: undefined,
    });
    return "stopped" as const;
  };

  const passes = item.multiAgent ? 2 : 1;
  for (let pass = 1; pass <= passes; pass += 1) {
    if (signal.aborted) return requeue();
    const prompt =
      pass === 2
        ? `Review the current workspace after another CLI agent worked on this Todo. Fix anything incomplete, verify the result, then finish: ${item.text}`
        : `Complete this Todo in the current workspace. Make the required changes, verify the result, then finish: ${item.text}`;
    todoStore.updateTodo(todoId, {
      status: "working",
      pass,
      error: undefined,
    });
    const result = await executeTool(
      {
        id: generateId(),
        name: "shell_command",
        args: {
          command: buildCliTaskCommand(
            cliId,
            prompt,
            useToolRuntimeStore.getState().permissionMode,
          ),
        },
        status: "approved",
      },
      {
        signal,
        attachedFolders: workspace?.path ? [workspace.path] : [],
        cwd:
          workspace?.path ??
          terminalStore.terminals.find(
            (terminal) => terminal.id === todoTerminalId,
          )?.cwd,
        terminalId: todoTerminalId,
        timeoutMs: TODO_CLI_TIMEOUT_MS,
        workspaceId,
      },
    );
    if (signal.aborted) return requeue();
    if (!result.result?.success) {
      todoStore.updateTodo(todoId, {
        status: "error",
        error:
          result.result?.error ??
          `${CLI_TOOLS.find((tool) => tool.id === cliId)?.name ?? cliId} stopped.`,
      });
      return "error";
    }
  }

  todoStore.updateTodo(todoId, {
    status: "done",
    pass: undefined,
    error: undefined,
  });
  return "done";
}

async function runQueue(installedIds: ReadonlySet<CliToolId>): Promise<void> {
  const store = useTodoStore.getState();
  if (store.runnerActive || activeRun) return;
  // A runner works one workspace at a time: the board currently in view.
  // Other boards stay queued until switched to.
  const workspaceId = getActiveWorkspace().id;
  const controller = new AbortController();
  activeRun = controller;
  store.setRunner(true);

  try {
    while (useTodoStore.getState().runnerActive && !controller.signal.aborted) {
      const next = getNextTodo(
        useTodoStore
          .getState()
          .items.filter((item) => item.workspaceId === workspaceId),
      );
      if (!next) break;
      useTodoStore.getState().setRunner(true, next.id);
      try {
        const result = await executeTodo(next.id, installedIds, controller.signal);
        if (result !== "done") break;
      } catch (error) {
        useTodoStore.getState().updateTodo(next.id, {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }
    }
  } finally {
    activeRun = null;
    useTodoStore.getState().setRunner(false);
  }
}

/**
 * Interrupts the running CLI agent and unwinds the queue.
 *
 * The runner stays marked active until it has actually unwound, so Start work
 * cannot launch a second one into the same terminal in the meantime.
 */
function stopQueue(): void {
  if (!activeRun) {
    useTodoStore.getState().setRunner(false);
    return;
  }
  useTodoStore.getState().setStopping(true);
  activeRun.abort();
}

export function TodoView() {
  const items = useWorkspaceTodos();
  const workspace = useActiveWorkspace();
  const runnerActive = useTodoStore((state) => state.runnerActive);
  const stopping = useTodoStore((state) => state.stopping);
  const activeTodoId = useTodoStore((state) => state.activeTodoId);

  const clearCompleted = useTodoStore((state) => state.clearCompleted);
  const moveTodo = useTodoStore((state) => state.moveTodo);
  const modelByPriority = useTodoStore(
    (state) => state.modelByPriority,
  );
  const permissionMode = useToolRuntimeStore(
    (state) => state.permissionMode,
  );
  const setToolPermission = useSettingsStore(
    (state) => state.setToolPermission,
  );
  const openSettings = useUiStore((state) => state.openSettings);
  const [cliStatuses, setCliStatuses] = useState<CliToolStatus[]>([]);
  const [cliLoading, setCliLoading] = useState(true);
  const [cliError, setCliError] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauri) {
      setCliLoading(false);
      return;
    }
    void ipc
      .listCliToolStatuses()
      .then((statuses) => setCliStatuses(statuses))
      .catch((error) =>
        setCliError(error instanceof Error ? error.message : String(error)),
      )
      .finally(() => setCliLoading(false));
  }, []);
  const installedAgents = useMemo(
    () =>
      CLI_TOOLS.filter((agent) =>
        cliStatuses.some((status) => status.id === agent.id && status.installed),
      ),
    [cliStatuses],
  );
  const installedIds = useMemo(
    () => new Set(installedAgents.map((agent) => agent.id)),
    [installedAgents],
  );
  const applyDefaultAgents = useTodoStore((state) => state.applyDefaultAgents);
  // Lanes start pointed at an installed agent. Otherwise Start work sits
  // disabled until the same agent is picked in all four lanes, which reads as
  // a broken button rather than a missing choice.
  useEffect(() => {
    if (installedAgents.length === 0) return;
    applyDefaultAgents(installedAgents.map((agent) => `cli::${agent.id}`));
  }, [applyDefaultAgents, installedAgents]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const queued = items.filter((item) => item.status === "queued").length;
  const completed = items.filter((item) => item.status === "done").length;
  const active = items.find((item) => item.id === activeTodoId);
  const missingAgentPriorities = TODO_PRIORITIES.filter(
    (priority) =>
      items.some(
        (item) => item.priority === priority && item.status === "queued",
      ) && !selectedCliId(modelByPriority[priority], installedIds),
  );
  const startBlockedReason = cliLoading
    ? "Still checking which CLI agents are installed."
    : cliError
      ? `Could not inspect CLI agents: ${cliError}`
      : installedAgents.length === 0
        ? "No CLI agent is installed. Open Settings → CLI Tools to install one."
        : permissionMode === "blocked"
          ? "Tool permission is Blocked. Choose Manual, Auto, or YOLO."
          : missingAgentPriorities.length > 0
            ? `Choose an agent for ${missingAgentPriorities
                .map((priority) => PRIORITY_META[priority].label)
                .join(", ")}.`
            : queued === 0
              ? "No queued tasks on this board."
              : null;
  const canStart = startBlockedReason === null;

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingItem = draggingId
    ? items.find((item) => item.id === draggingId)
    : undefined;

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setDraggingId(String(active.id));
  }, []);

  const handleDragEnd = useCallback(
    ({ active: dragged, over }: DragEndEvent) => {
      setDraggingId(null);
      if (!over || dragged.id === over.id) return;
      const overId = String(over.id);
      const targetPriority = overId.startsWith("lane:")
        ? (overId.slice(5) as TodoPriority)
        : items.find((item) => item.id === overId)?.priority;
      if (!targetPriority) return;
      moveTodo(
        String(dragged.id),
        targetPriority,
        overId.startsWith("lane:") ? undefined : overId,
      );
    },
    [items, moveTodo],
  );

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="shrink-0 text-lg font-semibold tracking-tight">Todo</h1>
            <span
              className="min-w-0 truncate rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              title={workspace.path ?? workspace.name}
            >
              {workspace.name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {completed}/{items.length} done
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Each priority uses an installed CLI agent. Assign tasks to an idle
            shell; Todo starts the agent there and runs Critical to Low.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={permissionMode}
            onValueChange={(value) =>
              setToolPermission(value as typeof permissionMode)
            }
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-24 text-xs"
              aria-label="Todo tool permission"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="yolo">YOLO</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
          {completed > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => clearCompleted(workspace.id)}
              disabled={runnerActive}
              className="text-muted-foreground"
            >
              Clear done
            </Button>
          )}
          {runnerActive ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={stopQueue}
              disabled={stopping}
              className="gap-1.5"
            >
              <Square className="size-3.5" aria-hidden />
              {stopping ? "Stopping..." : "Stop"}
            </Button>
          ) : (
            // A disabled button swallows its own tooltip, so the wrapper carries it.
            <span title={startBlockedReason ?? undefined} className="inline-flex">
              <Button
                type="button"
                size="sm"
                onClick={() => void runQueue(installedIds)}
                disabled={!canStart}
                className="gap-1.5"
              >
                <Play className="size-3.5" aria-hidden />
                Start work
              </Button>
            </span>
          )}
        </div>

        <div className="basis-full" aria-live="polite">
          {runnerActive && active ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bot className="size-3.5" aria-hidden />
              {stopping ? "Stopping" : "Working on"}{" "}
              {PRIORITY_META[active.priority].label}: {active.text}
            </p>
          ) : cliLoading ? (
            <p className="text-xs text-muted-foreground">
              Checking installed CLI agents...
            </p>
          ) : cliError ? (
            <p className="text-xs text-destructive" role="alert">
              Could not inspect CLI agents: {cliError}
            </p>
          ) : installedAgents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No CLI agent is installed.{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => openSettings("providers")}
              >
                Open CLI Tools
              </button>
            </p>
          ) : permissionMode === "blocked" ? (
            <p className="text-xs text-muted-foreground">
              Todo execution is blocked. Choose Manual, Auto, or YOLO to start.
            </p>
          ) : missingAgentPriorities.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Choose an agent for{" "}
              {missingAgentPriorities
                .map((priority) => PRIORITY_META[priority].label)
                .join(", ")}
              .
            </p>
          ) : queued > 0 ? (
            <p className="text-xs text-muted-foreground">
              {queued} task{queued === 1 ? "" : "s"} ready
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Queue is clear</p>
          )}
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid min-h-full grid-cols-1 gap-3 md:grid-cols-2 xl:min-w-[60rem] xl:grid-cols-4">
            {TODO_PRIORITIES.map((priority) => (
              <PriorityLane
                key={priority}
                priority={priority}
                items={items.filter((item) => item.priority === priority)}
                agents={installedAgents}
                agentsLoading={cliLoading}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {draggingItem ? <TodoCardOverlay item={draggingItem} /> : null}
        </DragOverlay>
      </DndContext>
    </main>
  );
}
