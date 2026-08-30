import assert from "node:assert/strict";
import test from "node:test";
import {
  getVisibleAssistantContent,
  groupChatMessages,
  isStatusQuestion,
} from "./chatDisplay.ts";
import type { Message } from "../types/chat.ts";

const message = (id: string, role: Message["role"]): Message => ({
  id,
  sessionId: "session",
  role,
  content: id,
  createdAt: 0,
  status: "complete",
});

test("groups tool continuations into one assistant turn", () => {
  const rows = groupChatMessages([
    message("user-1", "user"),
    message("tool-1", "assistant"),
    message("memory", "memory"),
    message("tool-2", "assistant"),
    message("final", "assistant"),
    message("user-2", "user"),
    message("answer-2", "assistant"),
  ]);

  assert.deepEqual(rows.map((row) => row.id), [
    "user-1",
    "turn:tool-1",
    "memory",
    "user-2",
    "turn:answer-2",
  ]);
  assert.deepEqual(
    rows[1].turnMessages?.map((entry) => entry.id),
    ["tool-1", "tool-2", "final"],
  );
  assert.equal(rows[1].message.id, "final");
});

test("keeps direct status answers visible beside tool calls", () => {
  assert.equal(
    getVisibleAssistantContent(
      {
        id: "assistant-1",
        status: "complete",
        content:
          'Not yet - the change is still in progress.\n<tool name="read_file"><path>src/app.ts</path></tool>',
      },
    ),
    "Not yet - the change is still in progress.",
  );
  assert.equal(
    getVisibleAssistantContent(
      {
        id: "assistant-1",
        status: "complete",
        content:
          'I will inspect it now.\n<tool name="read_file"><path>src/app.ts</path></tool>',
      },
    ),
    "",
  );
  assert.equal(isStatusQuestion("is it done?"), true);
  assert.equal(
    getVisibleAssistantContent(
      {
        id: "assistant-1",
        status: "complete",
        content: "I will inspect it now.",
      },
      true,
    ),
    "Not yet - work is still in progress.",
  );
});
