import type { ToolCall } from "../lib/toolProtocol.ts";

export type MessageRole = "user" | "assistant" | "system" | "memory";

export type MessageStatus = "complete" | "streaming" | "error" | "stopped";

export type MessageMode = "chat" | "code" | "agent";

export interface Citation {
  id: string;
  index: number;
  title: string;
  url?: string;
  snippet?: string;
}

export type AttachmentKind = "file" | "folder" | "image" | "url";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  path?: string;
  url?: string;
  mimeType?: string;
  size?: number;
  /** Data URL used for image previews. */
  preview?: string;
  /** Extracted text content injected into the model context. */
  textContent?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  tokensUsed?: number;
  modelId?: string;
  /** Provider that generated this assistant message. */
  providerId?: string;
  /** Points at the message this one branched from, when applicable. */
  parentId?: string | null;
  status: MessageStatus;
  /** A concise, user-facing explanation when generation fails. */
  errorMessage?: string;
  citations?: Citation[];
  attachments?: Attachment[];
  /** The top-level view mode active when this message was sent. */
  mode?: MessageMode;
  /** Estimated API cost for this assistant message, in the model's currency. */
  cost?: number;
  /** Optional reasoning / thinking content returned by the provider. */
  reasoning?: string;
  /** Structured tool calls/results are persisted separately from user-facing prose. */
  toolCalls?: ToolCall[];
  toolResults?: ToolCall[];
  toolWorkspace?: string[];
  /**
   * Terminal these tool calls belong to, captured when the calls were made.
   * Approvals can arrive long afterwards, so the routing has to travel with
   * the message rather than being read from live state at approval time.
   */
  toolTerminalId?: string;
}

export interface QueuedMessage {
  id: string;
  sessionId: string;
  content: string;
  attachments: Attachment[];
  createdAt: number;
}

export interface ChatCompletionParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  effortLevel: string;
  thinkingEnabled: boolean;
}
