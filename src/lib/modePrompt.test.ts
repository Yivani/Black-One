import assert from "node:assert/strict";
import test from "node:test";
import {
  buildModeSystemPrompt,
  isIncompleteAgentResponse,
} from "./modePrompt.ts";

test("gives each workspace mode a distinct contract", () => {
  const ask = buildModeSystemPrompt("chat", true);
  const code = buildModeSystemPrompt("code", true);
  const agent = buildModeSystemPrompt("agent", true);

  assert.match(ask, /do not modify files/i);
  assert.match(code, /use the available file tools to edit/i);
  assert.match(agent, /own the requested outcome end to end/i);
  assert.match(agent, /Never claim you cannot inspect or modify the workspace/i);
});

test("detects responses that only promise future agent work", () => {
  assert.equal(
    isIncompleteAgentResponse("", "I'll inspect the project structure first."),
    true,
  );
  assert.equal(
    isIncompleteAgentResponse("Let me check the relevant files."),
    true,
  );
  assert.equal(
    isIncompleteAgentResponse("Updated the component and verified the build."),
    false,
  );
});
