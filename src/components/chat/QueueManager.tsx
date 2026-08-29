import { useState, type DOMAttributes, type HTMLAttributes } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ListOrdered,
  Pencil,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DraggableList } from "@/components/shared/DraggableList";
import type { QueuedMessage } from "@/types/chat";
import { useQueue } from "@/hooks/useQueue";
import { cn, formatTimestamp } from "@/lib/utils";

export function QueueManager() {
  const {
    queue,
    removeQueued,
    reorderQueue,
    updateQueued,
    moveQueuedToTop,
    moveQueuedUp,
    clearQueue,
  } = useQueue();
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (queue.length === 0) return null;

  const startEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditValue(content);
  };

  const saveEdit = (id: string) => {
    updateQueued(id, editValue);
    setEditingId(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  return (
    <div className="mx-3 mb-2 rounded-lg border border-border bg-muted/40">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <ListOrdered className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-xs text-muted-foreground">
          {queue.length} message{queue.length === 1 ? "" : "s"} queued
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label={expanded ? "Collapse queue" : "Expand queue"}
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? (
                <ChevronDown className="size-3.5" aria-hidden />
              ) : (
                <ChevronUp className="size-3.5" aria-hidden />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{expanded ? "Collapse queue" : "Expand queue"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Clear queue"
              onClick={clearQueue}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear queue</TooltipContent>
        </Tooltip>
      </div>
      {expanded && (
        <div className="max-h-48 overflow-y-auto overflow-x-hidden border-t border-border p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <DraggableList<QueuedMessage>
            items={queue}
            onReorder={reorderQueue}
            renderItem={(item, handle, index) => {
              const isEditing = editingId === item.id;
              const canMoveUp = index > 0;

              return (
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-md px-1 py-1 hover:bg-accent/50",
                    handle.isDragging && "opacity-60",
                  )}
                >
                  <button
                    type="button"
                    aria-label="Drag to reorder"
                    className="cursor-grab text-muted-foreground active:cursor-grabbing"
                    {...(handle.attributes as unknown as HTMLAttributes<HTMLButtonElement>)}
                    {...(handle.listeners as unknown as DOMAttributes<HTMLButtonElement>)}
                  >
                    <GripVertical className="size-3.5" aria-hidden />
                  </button>

                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-1">
                      <Input
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveEdit(item.id);
                          if (event.key === "Escape") cancelEdit();
                        }}
                        className="h-7 flex-1 px-2 py-1 text-xs"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label="Save edit"
                        onClick={() => saveEdit(item.id)}
                      >
                        <ArrowRight className="size-3" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label="Cancel edit"
                        onClick={cancelEdit}
                      >
                        <X className="size-3" aria-hidden />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            aria-label="Edit queued message"
                            onClick={() => startEdit(item.id, item.content)}
                          >
                            <Pencil className="size-3" aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>

                      <span className="flex-1 truncate px-1 text-xs">{item.content}</span>

                      <span className="text-[10px] text-muted-foreground">
                        {formatTimestamp(item.createdAt)}
                      </span>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            aria-label="Steer - redirect the live turn now"
                            onClick={() => moveQueuedToTop(item.id)}
                          >
                            <Target className="size-3" aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Steer — redirect the live turn now</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            disabled={!canMoveUp}
                            aria-label="Move up"
                            onClick={() => moveQueuedUp(item.id)}
                          >
                            <ArrowRight className="size-3 -rotate-90" aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Next</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            aria-label="Remove from queue"
                            onClick={() => removeQueued(item.id)}
                          >
                            <Trash2 className="size-3" aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
