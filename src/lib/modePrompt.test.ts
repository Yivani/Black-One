import assert from "node:assert/strict";
import test from "node:test";
import { buildModeSystemPrompt } from "./modePrompt.ts";

test("gives each workspace mode a distinct contract", () => {
  const ask = buildModeSystemPrompt("chat", true);
  const code = buildModeSystemPrompt("code", true);
  const agent = buildModeSystemPrompt("agent", true);

  assert.match(ask, /do not modify files/i);
  assert.match(code, /use the available tools to edit/i);
  assert.match(agent, /own the requested outcome end to end/i);
  assert.match(agent, /Never claim you cannot inspect attached files/i);
});
