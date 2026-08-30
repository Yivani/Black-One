export const TODO_PRIORITIES = ["critical", "high", "mid", "low"] as const;

export type TodoPriority = (typeof TODO_PRIORITIES)[number];
export type TodoStatus = "queued" | "working" | "blocked" | "done" | "error";

export interface TodoItem {
  id: string;
  text: string;
  priority: TodoPriority;
  status: TodoStatus;
  multiAgent: boolean;
  createdAt: number;
  sessionId?: string;
  pass?: number;
  blockedMessageId?: string;
  error?: string;
}

export type TodoToolRequirement = "none" | "read" | "change";

// ponytail: keyword gate covers today's free-form Todos; use an explicit task kind if the board gains typed tasks.
const CHANGE_ACTION =
  /\b(add|build|change|create|delete|edit|fix|implement|install|make|modify|move|remove|rename|replace|refactor|update|write)\b/i;
const READ_ACTION =
  /\b(analy[sz]e|check|find|inspect|locate|review|scan|summari[sz]e|verify)\b/i;
const WORKSPACE_TARGET =
  /(?:^|\s)(?:[a-z]:[\\/]|\.{0,2}[\\/]|[\\/][\w.-])|\b(app|button|code|component|dropdown|file|folder|page|project|repo|repository|script|site|ui|website)\b/i;

export function getTodoToolRequirement(text: string): TodoToolRequirement {
  if (!WORKSPACE_TARGET.test(text)) return "none";
  if (CHANGE_ACTION.test(text)) return "change";
  if (READ_ACTION.test(text)) return "read";
  return "none";
}

export function getNextTodo(items: TodoItem[]): TodoItem | undefined {
  for (const priority of TODO_PRIORITIES) {
    const next = items.find(
      (item) => item.priority === priority && item.status === "queued",
    );
    if (next) return next;
  }
  return undefined;
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
