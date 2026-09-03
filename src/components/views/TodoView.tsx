import { useCallback, useState } from "react";
import { Check, Circle, Copy, GripVertical, Plus, Trash2 } from "lucide-react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  TODO_PRIORITIES,
  type TodoItem,
  type TodoPriority,
} from "@/lib/todoCore";
import { PRIORITY_META } from "@/lib/todoPriority";
import { useCopyText } from "@/hooks/useCopyText";
import { useActiveWorkspace, useWorkspaceTodos } from "@/hooks/useWorkspace";
import { useTodoStore } from "@/stores/todoStore";

function TodoStatusLine({ item }: { item: TodoItem }) {
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
        <GripVertical
          className="mt-1 size-4 text-muted-foreground"
          aria-hidden
        />
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
        <TodoStatusLine item={item} />
      </div>
    </article>
  );
}

function TodoCard({ item }: { item: TodoItem }) {
  const [draft, setDraft] = useState(item.text);
  const updateTodo = useTodoStore((state) => state.updateTodo);
  const moveTodo = useTodoStore((state) => state.moveTodo);
  const removeTodo = useTodoStore((state) => state.removeTodo);
  const { copied, copy } = useCopyText(item.text);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

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
          aria-label={`Drag ${item.text}`}
          className="mt-1 cursor-grab text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground active:cursor-grabbing"
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
          aria-label={`Delete ${item.text}`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 pl-6">
        <TodoStatusLine item={item} />
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            onClick={copy}
            aria-label={copied ? "Copied" : `Copy ${item.text}`}
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            onClick={() =>
              updateTodo(item.id, {
                status: item.status === "done" ? "queued" : "done",
              })
            }
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
          onValueChange={(priority: TodoPriority) => moveTodo(item.id, priority)}
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
  const addLabel = `Add ${meta.label.toLowerCase()} task`;

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
          placeholder={addLabel}
          aria-label={addLabel}
          className="h-8 min-w-0 text-xs"
        />
        <Button
          type="submit"
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          disabled={!text.trim()}
          aria-label={addLabel}
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

export function TodoView() {
  const items = useWorkspaceTodos();
  const workspace = useActiveWorkspace();
  const clearCompleted = useTodoStore((state) => state.clearCompleted);
  const moveTodo = useTodoStore((state) => state.moveTodo);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const open = items.filter((item) => item.status !== "done").length;
  const completed = items.length - open;

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
            <h1 className="shrink-0 text-lg font-semibold tracking-tight">
              Todo
            </h1>
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
            Tasks are yours to run. Copy one and paste it into a terminal;
            the sidebar lists them Critical first.
          </p>
        </div>

        {completed > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => clearCompleted(workspace.id)}
            className="text-muted-foreground"
          >
            Clear done
          </Button>
        )}
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
