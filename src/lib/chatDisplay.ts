import type { Message } from "../types/chat.ts";

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
