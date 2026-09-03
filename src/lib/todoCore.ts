export const TODO_PRIORITIES = ["critical", "high", "mid", "low"] as const;

export type TodoPriority = (typeof TODO_PRIORITIES)[number];

/**
 * Tasks are written down and ticked off by hand. Nothing runs them, so there
 * is no state between the two.
 */
export type TodoStatus = "queued" | "done";

export interface TodoItem {
  id: string;
  text: string;
  priority: TodoPriority;
  status: TodoStatus;
  createdAt: number;
  /**
   * Workspace this task belongs to. Boards are per-workspace, so a task is
   * only ever listed inside its own.
   */
  workspaceId?: string;
}

/**
 * Open tasks in the order they are meant to be picked up: Critical first, then
 * High, Mid, and Low, keeping the hand-arranged order inside each lane.
 *
 * Finished tasks drop out. This feeds the sidebar queue, which is a list to
 * work from rather than a record of what was done.
 */
export function sortTodosByRisk(items: readonly TodoItem[]): TodoItem[] {
  // filter() already returns a fresh array, so the in-place sort is safe. Sort
  // is stable, which is what preserves the order within each lane.
  return items
    .filter((item) => item.status !== "done")
    .sort(
      (a, b) =>
        TODO_PRIORITIES.indexOf(a.priority) -
        TODO_PRIORITIES.indexOf(b.priority),
    );
}

export function moveTodo(
  items: TodoItem[],
  activeId: string,
  priority: TodoPriority,
  overId?: string,
): TodoItem[] {
  const active = items.find((item) => item.id === activeId);
  if (!active) return items;

  const sourceLane = items.filter((item) => item.priority === active.priority);
  const sourceIndex = sourceLane.findIndex((item) => item.id === activeId);
  const originalOverIndex = sourceLane.findIndex((item) => item.id === overId);
  const remaining = items.filter((item) => item.id !== activeId);
  const destination = remaining.filter((item) => item.priority === priority);
  let destinationIndex = overId
    ? destination.findIndex((item) => item.id === overId)
    : destination.length;

  if (destinationIndex < 0) destinationIndex = destination.length;
  if (
    active.priority === priority &&
    sourceIndex >= 0 &&
    originalOverIndex > sourceIndex
  ) {
    destinationIndex += 1;
  }

  destination.splice(destinationIndex, 0, { ...active, priority });
  const destinationIds = new Set(destination.map((item) => item.id));
  return [
    ...remaining.filter((item) => !destinationIds.has(item.id)),
    ...destination,
  ];
}
