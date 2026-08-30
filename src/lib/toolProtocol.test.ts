import assert from "node:assert/strict";
import test from "node:test";
import {
  parseToolCalls,
  parseToolResults,
  serializeToolResult,
  stripToolCalls,
} from "./toolProtocol.ts";

test("round-trips tool calls and hides protocol text from normal replies", () => {
  const content = `Checking.\n<tool name="read_file" id="call-1"><path>src/&lt;main&gt;.tsx</path></tool>`;
  assert.deepEqual(parseToolCalls(content), [
    {
      id: "call-1",
      name: "read_file",
      args: { path: "src/<main>.tsx" },
      status: "pending",
    },
  ]);
  assert.equal(stripToolCalls(content), "Checking.");

  const serialized = serializeToolResult({
    id: "call-1",
    name: "read_file",
    args: {},
    status: "done",
    result: { success: true, output: "<tool_result> stays data & text" },
  });
  assert.deepEqual(parseToolResults(serialized)[0]?.result, {
    success: true,
    output: "<tool_result> stays data & text",
  });
});

test("keeps compatibility with existing plain-text tool results", () => {
  const [result] = parseToolResults(
    '<tool_result name="list_dir" id="old-0" status="error">error: path not found</tool_result>',
  );
  assert.equal(result.status, "error");
  assert.equal(result.result?.error, "path not found");
});
