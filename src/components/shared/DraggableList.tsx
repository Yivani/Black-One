import type { ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortableAttributes = ReturnType<typeof useSortable>["attributes"];
type SortableListeners = ReturnType<typeof useSortable>["listeners"];

export interface DragHandleRenderProps {
  attributes: SortableAttributes;
  listeners: SortableListeners;
  isDragging: boolean;
}

interface DraggableListProps<T extends { id: string }> {
  items: T[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  renderItem: (item: T, handle: DragHandleRenderProps, index: number) => ReactNode;
  className?: string;
  modifiers?: Modifier[];
}

function SortableRow<T extends { id: string }>({
  item,
  index,
  renderItem,
}: {
  item: T;
  index: number;
  renderItem: DraggableListProps<T>["renderItem"];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
      }}
    >
      {renderItem(item, { attributes, listeners, isDragging }, index)}
    </div>
  );
}

export function DraggableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
  modifiers,
}: DraggableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = items.findIndex((item) => item.id === active.id);
    const toIndex = items.findIndex((item) => item.id === over.id);
    if (fromIndex >= 0 && toIndex >= 0) onReorder(fromIndex, toIndex);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={modifiers}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableRow key={item.id} item={item} index={index} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
