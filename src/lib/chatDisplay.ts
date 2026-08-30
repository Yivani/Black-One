import type { Message } from "../types/chat.ts";
import { isIncompleteAgentResponse } from "./modePrompt.ts";
import { stripToolCalls } from "./toolProtocol.ts";

export interface ChatDisplayRow {
  id: string;
  message: Message;
  turnMessages?: Message[];
}

export function groupChatMessages(messages: Message[]): ChatDisplayRow[] {
  const rows: ChatDisplayRow[] = [];
  let assistantTurn: ChatDisplayRow | undefined;

  for (const message of messages) {
    if (message.role === "assistant") {
      if (!assistantTurn) {
        assistantTurn = {
          id: `turn:${message.id}`,
          message,
          turnMessages: [message],
        };
        rows.push(assistantTurn);
      } else {
        assistantTurn.message = message;
        assistantTurn.turnMessages!.push(message);
      }
      continue;
    }

    rows.push({ id: message.id, message });
    if (message.role === "user") assistantTurn = undefined;
  }

  return rows;
}

export function getVisibleAssistantContent(
  message: Pick<Message, "content" | "id" | "status">,
  statusAsked = false,
): string {
  const hasProtocol = /<tool(?:\s|>)/i.test(message.content);
  if (message.status === "streaming" && hasProtocol) return "";

  const content = stripToolCalls(message.content);
  if (isIncompleteAgentResponse(content)) {
    return statusAsked && message.status !== "streaming"
      ? "Not yet - work is still in progress."
      : "";
  }
  return content;
}

export function isStatusQuestion(content: string): boolean {
  return /\b(?:is (?:it|this|the task) done|are you done|did you finish|is (?:it|this|the task) finished|what(?:'s| is) the status|status update)\b/i.test(
    content,
  );
}
