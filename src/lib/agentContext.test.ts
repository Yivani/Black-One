import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS } from "./constants.ts";
import {
  AGENT_CONTEXT_FILES,
  isLegacyContextFileDefault,
  resolveContextFolder,
  BLOCK_END,
  BLOCK_START,
  contextFilePath,
  mergeAgentFile,
  needsUpdate,
  renderAgentBlock,
  type AgentContextEntry,
} from "./agentContext.ts";

const entry = (
  content: string,
  category = "commands",
  importance = 4,
  pinned = false,
): AgentContextEntry => ({ content, category, importance, pinned });

const SAMPLE = [
  entry("Build command: `npm run build`.", "commands", 5),
  entry("Test command: `npm test`.", "commands", 4),
  entry("`node` is version 22.3.0.", "toolchain", 3),
];

// ================================================================ rendering

test("renders a delimited, grouped block", () => {
  const block = renderAgentBlock(SAMPLE);
  assert.ok(block);
  assert.ok(block.startsWith(BLOCK_START));
  assert.ok(block.endsWith(BLOCK_END));
  assert.match(block, /### commands/);
  assert.match(block, /### toolchain/);
  assert.match(block, /- Build command: `npm run build`\./);
});

test("orders facts by importance inside a group", () => {
  const block = renderAgentBlock(SAMPLE) ?? "";
  assert.ok(
    block.indexOf("npm run build") < block.indexOf("npm test"),
    "the more important command should be read first",
  );
});

test("marks pinned facts so a reader knows they are deliberate", () => {
  const block = renderAgentBlock([entry("Use `npm run ci`.", "commands", 5, true)]) ?? "";
  assert.match(block, /_\(pinned\)_/);
});

test("an empty bank renders nothing rather than an empty heading", () => {
  assert.equal(renderAgentBlock([]), null);
});

// =================================================================== merge

test("creates the file content when there is none", () => {
  const block = renderAgentBlock(SAMPLE) ?? "";
  const merged = mergeAgentFile("", block);
  assert.equal(merged, `${block}\n`);
});

test("appends to a file the user already wrote, keeping every byte", () => {
  const theirs = "# My project\n\nRun `make dev` to start.\n";
  const block = renderAgentBlock(SAMPLE) ?? "";
  const merged = mergeAgentFile(theirs, block);
  assert.ok(merged.startsWith("# My project"));
  assert.ok(merged.includes("Run `make dev` to start."));
  assert.ok(merged.includes(BLOCK_START));
});

test("replaces only the owned region on a second sync", () => {
  const theirs = "# My project\n\nHand-written guidance.\n";
  const first = mergeAgentFile(theirs, renderAgentBlock(SAMPLE) ?? "");
  const second = mergeAgentFile(
    first,
    renderAgentBlock([entry("Build command: `pnpm build`.")]) ?? "",
  );
  assert.ok(second.includes("Hand-written guidance."), "the user's text survives");
  assert.ok(second.includes("pnpm build"), "the new block is in");
  assert.ok(!second.includes("npm run build"), "the old block is gone");
  assert.equal(
    second.split(BLOCK_START).length - 1,
    1,
    "exactly one owned block, never a second copy",
  );
});

test("content the user wrote after our block is preserved too", () => {
  const withTrailer = `${BLOCK_START}\nold\n${BLOCK_END}\n\n## My notes\n\nKeep me.\n`;
  const merged = mergeAgentFile(withTrailer, renderAgentBlock(SAMPLE) ?? "");
  assert.ok(merged.includes("## My notes"));
  assert.ok(merged.includes("Keep me."));
  assert.ok(!merged.includes("\nold\n"));
});

test("clearing the bank removes the block and leaves the file", () => {
  const theirs = "# My project\n\nHand-written guidance.\n";
  const withBlock = mergeAgentFile(theirs, renderAgentBlock(SAMPLE) ?? "");
  const cleared = mergeAgentFile(withBlock, null);
  assert.ok(cleared.includes("Hand-written guidance."));
  assert.ok(!cleared.includes(BLOCK_START));
  assert.ok(!cleared.includes("npm run build"));
});

test("clearing a file that only ever held our block empties it", () => {
  const ours = mergeAgentFile("", renderAgentBlock(SAMPLE) ?? "");
  assert.equal(mergeAgentFile(ours, null).trim(), "");
});

test("a file we never touched is left alone when there is nothing to write", () => {
  const theirs = "# My project\n";
  assert.equal(mergeAgentFile(theirs, null), theirs);
});

test("a malformed block is treated as absent rather than corrupted further", () => {
  // End marker before the start marker: refuse to splice into that.
  const broken = `${BLOCK_END}\nstray\n${BLOCK_START}\n`;
  const merged = mergeAgentFile(broken, renderAgentBlock(SAMPLE) ?? "");
  assert.ok(merged.includes("stray"), "nothing of theirs is destroyed");
  assert.ok(merged.includes("npm run build"));
});

// ============================================================== idempotence

test("syncing twice with the same facts changes nothing", () => {
  const block = renderAgentBlock(SAMPLE);
  const once = mergeAgentFile("# Project\n", block);
  const twice = mergeAgentFile(once, block);
  assert.equal(twice, once, "a no-op sync must not rewrite the file");
  assert.equal(needsUpdate(once, block), false);
});

test("needsUpdate spots a real change", () => {
  const block = renderAgentBlock(SAMPLE);
  const file = mergeAgentFile("", block);
  assert.equal(needsUpdate(file, renderAgentBlock([entry("Something else.")])), true);
  assert.equal(needsUpdate(file, null), true);
});

// ================================================================ target dir

test("a workspace folder wins when there is one", () => {
  assert.equal(
    resolveContextFolder("D:/Projects/site", ["C:/Users/domen"]),
    "D:/Projects/site",
  );
});

test("falls back to where the terminal is actually running", () => {
  // Without this, a workspace with no folder wrote nothing at all and the CLI
  // agents had nothing to read.
  assert.equal(resolveContextFolder(null, ["C:/Users/domen"]), "C:/Users/domen");
  assert.equal(resolveContextFolder("", ["C:/Users/domen"]), "C:/Users/domen");
  assert.equal(resolveContextFolder("   ", ["C:/Users/domen"]), "C:/Users/domen");
});

test("skips terminals whose directory is not a real path", () => {
  assert.equal(resolveContextFolder(null, ["~", ".", "D:/real"]), "D:/real");
});

test("gives up when there is nowhere to write", () => {
  assert.equal(resolveContextFolder(null, []), null);
  assert.equal(resolveContextFolder(null, ["~"]), null);
  assert.equal(resolveContextFolder(undefined, [""]), null);
});

// ==================================================================== paths

test("joins a path with the separator the folder already uses", () => {
  assert.equal(contextFilePath("D:\\Projects\\site", "AGENTS.md"), "D:\\Projects\\site\\AGENTS.md");
  assert.equal(contextFilePath("/home/me/site", "AGENTS.md"), "/home/me/site/AGENTS.md");
  assert.equal(contextFilePath("/home/me/site/", "AGENTS.md"), "/home/me/site/AGENTS.md");
  assert.equal(
    contextFilePath("D:/Projects/site", "AGENTS.md"),
    "D:/Projects/site/AGENTS.md",
    "a Windows path already using forward slashes keeps them",
  );
});

// ============================================================ which agents

test("every agent that reads a context file gets one by default", () => {
  // The Gemini bug in one assertion: GEMINI.md existed, was listed here, and
  // was switched off in the defaults — so Gemini CLI read nothing while
  // Claude Code and Codex read everything. Adding an agent without enabling
  // its file fails here now.
  for (const { file, tools } of AGENT_CONTEXT_FILES) {
    assert.ok(
      DEFAULT_SETTINGS.memory.agentContextFiles.includes(file),
      `${file} is off by default, so ${tools.join(", ")} would remember nothing`,
    );
  }
});

test("Gemini CLI's file is the one it actually reads", () => {
  const gemini = AGENT_CONTEXT_FILES.find((entry) => entry.tools.includes("gemini"));
  assert.equal(gemini?.file, "GEMINI.md");
});

test("an install predating the fix is upgraded, a chosen list is not", () => {
  assert.equal(isLegacyContextFileDefault(["AGENTS.md", "CLAUDE.md"]), true);
  for (const chosen of [
    ["AGENTS.md"],
    [],
    ["CLAUDE.md", "GEMINI.md"],
    ["AGENTS.md", "CLAUDE.md", "GEMINI.md"],
  ]) {
    assert.equal(
      isLegacyContextFileDefault(chosen),
      false,
      `[${chosen.join(", ")}] is a deliberate choice and must be left alone`,
    );
  }
});
