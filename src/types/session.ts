export type SessionMode = "chat" | "code" | "agent";

export interface ChatSession {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  pinned: boolean;
  folderId?: string | null;
  modelId?: string;
  systemPrompt?: string;
  messageCount: number;
  /** The top-level view mode active when this session was created. */
  mode?: SessionMode;
  /** Whether the session has unread messages. */
  unread?: boolean;
}

export interface ChatFolder {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  sortOrder: number;
}

export type DateGroup = "Today" | "Yesterday" | "Last 7 Days" | "Last 30 Days" | "Older";

export const DATE_GROUP_ORDER: DateGroup[] = [
  "Today",
  "Yesterday",
  "Last 7 Days",
  "Last 30 Days",
  "Older",
];
