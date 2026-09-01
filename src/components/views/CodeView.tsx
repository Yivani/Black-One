import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Columns2,
  GripVertical,
  LayoutGrid,
  Pencil,
  Rows2,
  TerminalSquare,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  rectSwappingStrategy,
  useSortable,
  verticalListSortingStrategy,
  type SortableContextProps,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Terminal } from "@/components/terminal";
import { cn } from "@/lib/utils";
import { useTerminalStore, type TerminalLayout } from "@/stores/terminalStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  useActiveTerminalId,
  useWorkspaceTerminals,
} from "@/hooks/useWorkspace";

interface GridConfig {
  cols: number;
  rows: number;
}

function getAutoGridConfig(count: number): GridConfig {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(count / 4) };
}

function getGridConfig(count: number, layout: TerminalLayout): GridConfig {
  if (count === 0) return { cols: 1, rows: 1 };
  switch (layout) {
    case "horizontal":
      return { cols: count, rows: 1 };
    case "vertical":
      return { cols: 1, rows: count };
    case "grid":
    default:
      return getAutoGridConfig(count);
  }
}

const LAYOUT_OPTIONS: {
  value: TerminalLayout;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "horizontal", label: "Horizontal", icon: Columns2 },
  { value: "vertical", label: "Vertical", icon: Rows2 },
];

interface TerminalPaneProps {
  terminal: { id: string; title: string; exited?: boolean };
  active: boolean;
  color?: string;
  dragHandleProps?: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
  };
  onSelect: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
}

function TerminalPane({
  terminal,
  active,
  color,
  dragHandleProps,
  onSelect,
  onClose,
  onRename,
}: TerminalPaneProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(terminal.title);

  const startRename = () => {
    setDraft(terminal.title);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onRename(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(terminal.title);
    setEditing(false);
  };

  return (
    <div
      style={color ? { borderColor: color } : undefined}
      className={cn(
        "group flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-background",
        active ? "border-primary/50 ring-1 ring-primary/20" : "border-border",
      )}
      onClick={onSelect}
    >
      <div
        {...dragHandleProps?.attributes}
        {...dragHandleProps?.listeners}
        className={cn(
          "flex items-center justify-between border-b border-border px-2 py-1 gap-1",
          dragHandleProps && "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
          {dragHandleProps && (
            <GripVertical
              className="size-3 shrink-0 text-muted-foreground/70"
              aria-hidden
            />
          )}
          <TerminalSquare
            className={cn(
              "size-3 shrink-0",
              color ? "text-current" : "text-muted-foreground",
            )}
            style={color ? { color } : undefined}
            aria-hidden
          />
          {editing ? (
            <form
              className="flex flex-1 items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                commit();
              }}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancel();
                }}
                className="h-5 min-w-0 flex-1 px-1 py-0 text-xs"
                autoFocus
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Save name"
                className="size-5 text-muted-foreground hover:text-foreground"
              >
                <Check className="size-3" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cancel rename"
                onClick={cancel}
                className="size-5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" aria-hidden />
              </Button>
            </form>
          ) : (
            <>
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  // An exited tab keeps its scrollback but takes no input, so
                  // it should not look like a shell you can still type into.
                  terminal.exited && "text-muted-foreground line-through",
                )}
                title={terminal.exited ? `${terminal.title} — exited` : terminal.title}
              >
                {terminal.title}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Rename terminal"
                onClick={(event) => {
                  event.stopPropagation();
                  startRename();
                }}
                className="size-5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
              >
                <Pencil className="size-3" aria-hidden />
              </Button>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close terminal"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="size-6 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 p-1">
        <Terminal terminalId={terminal.id} active={active} />
      </div>
    </div>
  );
}

interface SortableTerminalPaneProps extends TerminalPaneProps {}

function SortableTerminalPane({
  terminal,
  ...props
}: SortableTerminalPaneProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: terminal.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn("h-full min-h-0", isDragging && "opacity-50")}
    >
      <TerminalPane
        terminal={terminal}
        {...props}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}

export function CodeView() {
  // The deck only ever shows the active workspace's terminals; another
  // workspace's shells keep running but stay out of view.
  const terminals = useWorkspaceTerminals();
  const activeId = useActiveTerminalId();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const layout = useTerminalStore((s) => s.layout);
  const createTerminal = useTerminalStore((s) => s.createTerminal);
  const closeTerminal = useTerminalStore((s) => s.closeTerminal);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const renameTerminal = useTerminalStore((s) => s.renameTerminal);
  const terminalColors = useTerminalStore((s) => s.terminalColors);
  const reorderTerminals = useTerminalStore((s) => s.reorderTerminals);
  const setLayout = useTerminalStore((s) => s.setLayout);

  // Switching to a workspace that has no shell yet opens one for it.
  useEffect(() => {
    if (terminals.length === 0) {
      void createTerminal();
    }
  }, [terminals.length, createTerminal, activeWorkspaceId]);

  const { cols, rows } = useMemo(
    () => getGridConfig(terminals.length, layout),
    [terminals.length, layout],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = terminals.findIndex((t) => t.id === active.id);
    const toIndex = terminals.findIndex((t) => t.id === over.id);
    if (fromIndex >= 0 && toIndex >= 0) {
      reorderTerminals(fromIndex, toIndex);
    }
  };

  const sortableStrategy: SortableContextProps["strategy"] =
    layout === "horizontal"
      ? horizontalListSortingStrategy
      : layout === "vertical"
        ? verticalListSortingStrategy
        : rectSwappingStrategy;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TerminalSquare className="size-3.5" aria-hidden />
          <span>
            {terminals.length} shell{terminals.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border p-0.5">
            {LAYOUT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = layout === option.value;
              return (
                <Tooltip key={option.value}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={option.label}
                      onClick={() => setLayout(option.value)}
                      className={cn(
                        "size-6",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{option.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </header>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={terminals.map((t) => t.id)}
          strategy={sortableStrategy}
        >
          <div
            className="grid flex-1 gap-2 overflow-auto p-2"
            style={{
              gridTemplateColumns:
                layout === "vertical"
                  ? "minmax(0, 1fr)"
                  : `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows:
                layout === "horizontal"
                  ? "minmax(0, 1fr)"
                  : `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {terminals.map((terminal) => (
              <SortableTerminalPane
                key={terminal.id}
                terminal={terminal}
                active={terminal.id === activeId}
                color={terminalColors[terminal.id]}
                onSelect={() => setActiveTerminal(terminal.id)}
                onClose={() => void closeTerminal(terminal.id)}
                onRename={(title) => renameTerminal(terminal.id, title)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
