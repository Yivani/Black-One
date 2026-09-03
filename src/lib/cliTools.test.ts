import assert from "node:assert/strict";
import test from "node:test";
import {
  CLI_TOOLS,
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
