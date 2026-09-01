import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  Circle,
  GripVertical,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  Terminal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import {
  getNextTodo,
  getTodoToolRequirement,
  TODO_PRIORITIES,
  type TodoItem,
  type TodoPriority,
} from "@/lib/todoCore";
import { isIncompleteAgentResponse } from "@/lib/modePrompt";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { getActiveWorkspace, useWorkspaceStore } from "@/stores/workspaceStore";
import {
  useActiveWorkspace,
  useWorkspaceTerminals,
  useWorkspaceTodos,
} from "@/hooks/useWorkspace";
import { resolveTaskTerminal } from "@/lib/workspaceCore";
import { useTodoStore } from "@/stores/todoStore";
import { useToolRuntimeStore } from "@/stores/toolRuntimeStore";
import type { Message } from "@/types/chat";

const EMPTY_MESSAGES: Message[] = [];

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

function PriorityModelSelect({ priority }: { priority: TodoPriority }) {
  const providers = useModelStore((state) => state.providers);
  const defaultModelId = useModelStore((state) => state.selectedModelId);
  const configured = useTodoStore(
    (state) => state.modelByPriority[priority],
  );
  const setPriorityModel = useTodoStore((state) => state.setPriorityModel);
  const visibleModelIds = useSettingsStore(
    (state) => state.settings.model.visibleModelIds,
  );
  const visible = useMemo(
    () => (visibleModelIds ? new Set(visibleModelIds) : null),
    [visibleModelIds],
  );
  const activeModelId = configured ?? defaultModelId;
  const groups = providers
    .filter(
      (provider) =>
        provider.isEnabled ||
        provider.models.some(
          (model) =>
            (model.selectionId ?? `${provider.id}::${model.id}`) ===
            activeModelId,
        ),
    )
    .map((provider) => ({
      provider,
      models: provider.models.filter((model) => {
        const id = model.selectionId ?? `${provider.id}::${model.id}`;
        return !visible || visible.has(id) || id === configured;
      }),
    }))
    .filter((group) => group.models.length > 0);

  return (
    <Select
      value={configured ?? defaultModelId}
      onValueChange={(modelId) => setPriorityModel(priority, modelId)}
    >
      <SelectTrigger
        size="sm"
        className="h-7 min-w-0 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-1"
        aria-label={`${PRIORITY_META[priority].label} priority model`}
      >
        <SelectValue placeholder="Choose model" />
      </SelectTrigger>
      <SelectContent>
        {groups.map(({ provider, models }) => (
          <SelectGroup key={provider.id}>
            <SelectLabel>{provider.name}</SelectLabel>
            {models.map((model) => {
              const id =
                model.selectionId ?? `${provider.id}::${model.id}`;
              return (
                <SelectItem key={id} value={id}>
                  {model.name}
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
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
  if (item.status === "blocked") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <ShieldAlert className="size-3" aria-hidden />
        Approval needed
      </span>
    );
  }
  if (item.status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <X className="size-3" aria-hidden />
        {item.error ?? "Work stopped"}
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
  const sessionMessages = useChatStore((state) =>
    item.sessionId
      ? (state.messagesBySession[item.sessionId] ?? EMPTY_MESSAGES)
      : EMPTY_MESSAGES,
  );
  const streamingSessionId = useChatStore(
    (state) => state.streamingSessionId,
  );
  const toolLoopDepth = useChatStore((state) =>
    item.sessionId ? state.toolLoopDepth[item.sessionId] : undefined,
  );
  const pendingApprovals = useToolRuntimeStore(
    (state) => state.pendingCalls.length,
  );
  const busy = item.status === "working" || item.status === "blocked";
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
  const lastAssistant = [...sessionMessages]
    .reverse()
    .find((message) => message.role === "assistant");
  const canResumeBlocked =
    item.status === "blocked" &&
    Boolean(item.sessionId) &&
    pendingApprovals === 0 &&
    streamingSessionId !== item.sessionId &&
    toolLoopDepth === undefined &&
    Boolean(
      lastAssistant && lastAssistant.id !== item.blockedMessageId,
    );

  const resumeBlocked = () => {
    if (!canResumeBlocked || !lastAssistant) return;
    if (lastAssistant.status !== "complete") {
      updateTodo(item.id, {
        status: "error",
        error: lastAssistant.errorMessage ?? "Work did not finish",
        blockedMessageId: undefined,
      });
      return;
    }
    if (
      isIncompleteAgentResponse(
        lastAssistant.content,
        lastAssistant.reasoning,
      )
    ) {
      updateTodo(item.id, {
        status: "error",
        error: "Work stopped after describing the task",
        blockedMessageId: undefined,
      });
      return;
    }
    const blockedIndex = sessionMessages.findIndex(
      (message) => message.id === item.blockedMessageId,
    );
    const resumedMessages =
      blockedIndex >= 0 ? sessionMessages.slice(blockedIndex + 1) : [];
    if (
      !hasTodoToolEvidence(
        item.text,
        resumedMessages,
        (item.pass ?? 1) > 1,
      )
    ) {
      updateTodo(item.id, {
        status: "error",
        error:
          getTodoToolRequirement(item.text) === "change"
            ? "No workspace change was executed"
            : "No workspace inspection was executed",
        blockedMessageId: undefined,
      });
      return;
    }
    if (item.multiAgent && (item.pass ?? 1) < 2) {
      updateTodo(item.id, {
        status: "queued",
        error: undefined,
        blockedMessageId: undefined,
      });
      void runQueue();
      return;
    }
    updateTodo(item.id, {
      status: "done",
      error: undefined,
      blockedMessageId: undefined,
    });
  };

  useEffect(() => {
    if (canResumeBlocked) resumeBlocked();
  }, [canResumeBlocked, lastAssistant?.id]);

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
          {item.status === "blocked" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              onClick={resumeBlocked}
              disabled={!canResumeBlocked}
              aria-label={
                canResumeBlocked
                  ? `Resume ${item.text} after approval`
                  : `Waiting for approval work on ${item.text}`
              }
            >
              <Play className="size-3.5" aria-hidden />
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
}: {
  priority: TodoPriority;
  items: TodoItem[];
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
          <PriorityModelSelect priority={priority} />
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

type RunResult = "done" | "blocked" | "error";

function hasTodoToolEvidence(
  text: string,
  messages: Message[],
  reviewer = false,
): boolean {
  const requirement = getTodoToolRequirement(text);
  if (requirement === "none") return true;
  const successful = messages.flatMap((message) =>
    (message.toolResults ?? []).filter((call) => call.result?.success),
  );
  if (reviewer || requirement === "read") return successful.length > 0;
  return successful.some(
    (call) => call.name !== "read_file" && call.name !== "list_dir",
  );
}

async function executeTodo(todoId: string): Promise<RunResult> {
  const todoStore = useTodoStore.getState();
  const item = todoStore.items.find((todo) => todo.id === todoId);
  if (!item) return "error";

  const workspaceId = item.workspaceId ?? getActiveWorkspace().id;
  const workspace = useWorkspaceStore
    .getState()
    .workspaces.find((entry) => entry.id === workspaceId);
  const workspaceTerminalIds = useTerminalStore
    .getState()
    .terminals.filter((terminal) => terminal.workspaceId === workspaceId)
    .map((terminal) => terminal.id);
  // A stored terminal id goes stale on every restart, so fall back to the
  // workspace's own default rather than running in the wrong shell.
  const todoTerminalId = resolveTaskTerminal(
    item.terminalId,
    workspaceTerminalIds,
    useWorkspaceStore.getState().defaultTerminalByWorkspace[workspaceId] ??
      null,
  );
  useToolRuntimeStore.getState().setTodoTerminal(todoTerminalId ?? null);
  useToolRuntimeStore
    .getState()
    .setTodoWorkspaceFolder(workspace?.path ?? null);
  if (todoTerminalId) {
    const terminalStore = useTerminalStore.getState();
    terminalStore.setActiveTerminal(todoTerminalId);
    terminalStore.openPanel().catch(() => {});
  }

  try {
    const todoModelId =
      todoStore.modelByPriority[item.priority] ??
      useModelStore.getState().selectedModelId;

    // Todos write into the currently selected chat instead of spawning a new
    // session for every task. Only fall back to creating a session when none is
    // active yet.
    const sessionStore = useSessionStore.getState();
    let sessionId = sessionStore.activeSessionId;
    if (!sessionId) {
      const session = await sessionStore.createSession({
        title: `Todo: ${item.text.slice(0, 54)}`,
        mode: "agent",
        modelId: todoModelId,
      });
      sessionId = session.id;
    }
    await sessionStore.updateSessionMeta(sessionId, {
      mode: "agent",
      modelId: todoModelId,
    });

    const passes = item.multiAgent ? 2 : 1;
    const firstPass =
      item.pass && item.sessionId === sessionId ? item.pass + 1 : 1;

    for (let pass = firstPass; pass <= passes; pass += 1) {
      const reviewer = pass === 2;

      useTodoStore.getState().updateTodo(todoId, {
        status: "working",
        sessionId,
        pass,
        blockedMessageId: undefined,
        error: undefined,
      });

      const prompt = reviewer
        ? `Review and finish this Todo after another agent worked on it: ${item.text}`
        : `Complete this Todo: ${item.text}`;
      const messageIdsBefore = new Set(
        (useChatStore.getState().messagesBySession[sessionId] ?? []).map(
          (message) => message.id,
        ),
      );

      try {
        await useChatStore
          .getState()
          .sendMessage(prompt, [], undefined, sessionId);
      } catch (error) {
        useTodoStore.getState().updateTodo(todoId, {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        return "error";
      }

      const messages =
        useChatStore.getState().messagesBySession[sessionId] ?? [];
      const turnMessages = messages.filter(
        (message) => !messageIdsBefore.has(message.id),
      );
      const lastAssistant = [...turnMessages]
        .reverse()
        .find((message) => message.role === "assistant");
      if (useToolRuntimeStore.getState().pendingCalls.length > 0) {
        useTodoStore.getState().updateTodo(todoId, {
          status: "blocked",
          blockedMessageId: lastAssistant?.id,
        });
        return "blocked";
      }
      if (!lastAssistant || lastAssistant.status !== "complete") {
        useTodoStore.getState().updateTodo(todoId, {
          status: "error",
          error: lastAssistant?.errorMessage ?? "Work did not finish",
        });
        return "error";
      }
      if (
        isIncompleteAgentResponse(
          lastAssistant.content,
          lastAssistant.reasoning,
        )
      ) {
        useTodoStore.getState().updateTodo(todoId, {
          status: "error",
          error: "Work stopped after describing the task",
        });
        return "error";
      }
      if (!hasTodoToolEvidence(item.text, turnMessages, reviewer)) {
        useTodoStore.getState().updateTodo(todoId, {
          status: "error",
          error:
            getTodoToolRequirement(item.text) === "change"
              ? "No workspace change was executed"
              : "No workspace inspection was executed",
        });
        return "error";
      }
    }

    useTodoStore.getState().updateTodo(todoId, {
      status: "done",
      blockedMessageId: undefined,
      error: undefined,
    });
    return "done";
  } finally {
    useToolRuntimeStore.getState().setTodoTerminal(null);
    useToolRuntimeStore.getState().setTodoWorkspaceFolder(null);
  }
}

async function runQueue(): Promise<void> {
  const store = useTodoStore.getState();
  if (store.runnerActive) return;
  const chat = useChatStore.getState();
  if (
    chat.streamingSessionId ||
    chat.queue.length > 0 ||
    useToolRuntimeStore.getState().pendingCalls.length > 0
  ) {
    return;
  }
  // One chat session drives the agent, so the runner works a single workspace
  // at a time — the one in view. Other boards stay queued until switched to.
  const workspaceId = getActiveWorkspace().id;
  store.setRunner(true);

  try {
    while (useTodoStore.getState().runnerActive) {
      const next = getNextTodo(
        useTodoStore
          .getState()
          .items.filter((item) => item.workspaceId === workspaceId),
      );
      if (!next) break;
      useTodoStore.getState().setRunner(true, next.id);
      try {
        const result = await executeTodo(next.id);
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
    useTodoStore.getState().setRunner(false);
  }
}

export function TodoView() {
  const items = useWorkspaceTodos();
  const workspace = useActiveWorkspace();
  const runnerActive = useTodoStore((state) => state.runnerActive);
  const activeTodoId = useTodoStore((state) => state.activeTodoId);
  const setRunner = useTodoStore((state) => state.setRunner);
  const clearCompleted = useTodoStore((state) => state.clearCompleted);
  const moveTodo = useTodoStore((state) => state.moveTodo);
  const streamingSessionId = useChatStore(
    (state) => state.streamingSessionId,
  );
  const chatQueueLength = useChatStore((state) => state.queue.length);
  const pendingApprovals = useToolRuntimeStore(
    (state) => state.pendingCalls.length,
  );
  const permissionMode = useToolRuntimeStore(
    (state) => state.permissionMode,
  );
  const setToolPermission = useSettingsStore(
    (state) => state.setToolPermission,
  );
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const queued = items.filter((item) => item.status === "queued").length;
  const completed = items.filter((item) => item.status === "done").length;
  const active = items.find((item) => item.id === activeTodoId);
  const agentBusy =
    streamingSessionId !== null ||
    chatQueueLength > 0 ||
    pendingApprovals > 0;
  const changePermissionMode = async (value: string) => {
    const next = value as typeof permissionMode;
    setToolPermission(next);
    if (next !== "yolo") return;
    if (!activeSessionId) return;
    try {
      await useChatStore.getState().approvePendingTools(activeSessionId);
    } catch (error) {
      toast.error("Could not resume Todo tools", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

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
            This board belongs to {workspace.name}. Work runs Critical to Low in
            the terminal each task is assigned to.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={permissionMode}
            onValueChange={(value) => void changePermissionMode(value)}
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
              onClick={() => setRunner(false)}
              className="gap-1.5"
            >
              <Pause className="size-3.5" aria-hidden />
              Pause after task
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => void runQueue()}
              disabled={queued === 0 || agentBusy}
              className="gap-1.5"
            >
              <Play className="size-3.5" aria-hidden />
              Start work
            </Button>
          )}
        </div>

        <div className="basis-full" aria-live="polite">
          {runnerActive && active ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bot className="size-3.5" aria-hidden />
              Working on {PRIORITY_META[active.priority].label}: {active.text}
            </p>
          ) : agentBusy ? (
            <p className="text-xs text-muted-foreground">
              {pendingApprovals > 0
                ? "Tool approval is waiting. Switch to YOLO to resume it."
                : "Current work is still finishing before Todo can start."}
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
