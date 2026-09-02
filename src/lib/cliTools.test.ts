import assert from "node:assert/strict";
import test from "node:test";
import {
  CLI_TOOLS,
  buildCliTaskCommand,
  getCliCommand,
  type CliToolId,
} from "./cliTools.ts";

test("builds safe npm commands for every supported CLI", () => {
  for (const tool of CLI_TOOLS) {
    assert.match(tool.packageName, /^(?:@[a-z0-9-]+\/)?[a-z0-9-]+$/);
    assert.equal(
      getCliCommand(tool, "install"),
      `npm.cmd install -g ${tool.packageName}@latest`,
    );
    assert.equal(
      getCliCommand(tool, "update"),
      `npm.cmd install -g ${tool.packageName}@latest`,
    );
    assert.equal(
      getCliCommand(tool, "uninstall"),
      `npm.cmd uninstall -g ${tool.packageName}`,
    );
  }
});

test("encodes Todo prompts instead of interpolating shell input", () => {
  const prompt = "Fix O'Hare\nWrite-Output hacked \u{1F680}";
  const command = buildCliTaskCommand("kimi", prompt, "yolo");
  assert.doesNotMatch(command, /O'Hare|Write-Output/);

  const encodedScript = command.split(" ").at(-1);
  assert.ok(encodedScript);
  const script = Buffer.from(encodedScript, "base64").toString("utf16le");
  const encodedPrompt = /FromBase64String\('([^']+)'\)/.exec(script)?.[1];
  assert.ok(encodedPrompt);
  assert.equal(Buffer.from(encodedPrompt, "base64").toString("utf8"), prompt);
  assert.match(script, /Get-Command 'kimi'/);
  assert.match(script, /'-p'/);
});

test("uses each CLI's headless entry point", () => {
  const expected: Record<CliToolId, RegExp> = {
    codex: /'exec'.*'--sandbox'.*'workspace-write'/s,
    claude: /'-p'.*'--permission-mode'.*'auto'/s,
    gemini: /'-p'.*'--approval-mode=yolo'/s,
    kimi: /'-p'/s,
    opencode: /'run'.*'--auto'/s,
  };
  for (const tool of CLI_TOOLS) {
    const encodedScript = buildCliTaskCommand(tool.id, "Do it", "yolo")
      .split(" ")
      .at(-1);
    assert.ok(encodedScript);
    const script = Buffer.from(encodedScript, "base64").toString("utf16le");
    assert.match(script, expected[tool.id]);
  }
});
