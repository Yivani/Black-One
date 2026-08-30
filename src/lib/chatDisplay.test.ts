import assert from "node:assert/strict";
import test from "node:test";
import { groupChatMessages } from "./chatDisplay.ts";
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
