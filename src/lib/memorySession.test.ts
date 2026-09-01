import assert from "node:assert/strict";
import test from "node:test";
import {
  pruneMemoryEntries,
  selectPromptEntries,
  upsertMemoryEntry,
  type MemoryEntry,
} from "./memoryCore.ts";
import {
  categoryForKind,
  extractMemoryCandidates,
  type CommandObservation,
} from "./terminalMemory.ts";
import {
  applyInputChunk,
  detectMemoryStatement,
  EMPTY_INPUT_STATE,
  type InputState,
} from "./terminalInput.ts";

/**
 * End-to-end check of the decision pipeline.
 *
 * The unit tests prove each rule in isolation; this replays realistic sessions
 * and asserts what a user would actually find in their bank afterwards. The
 * assertions are exact contents, so any future rule that starts remembering
 * routine work fails here.
 */

let clock = 1_000;

/** Runs commands through the same path the app uses. */
function replayCommands(
  observations: CommandObservation[],
  start: MemoryEntry[] = [],
): MemoryEntry[] {
  let entries = start;
  for (const observation of observations) {
    clock += 1000;
    for (const candidate of extractMemoryCandidates(observation)) {
      entries = upsertMemoryEntry(entries, {
        id: `id-${clock}-${candidate.subject}`,
        now: clock,
        category: categoryForKind(candidate.kind),
        content: candidate.content,
        importance: candidate.importance,
        source: "terminal",
        kind: candidate.kind,
        subject: candidate.subject,
      }).entries;
    }
  }
  return entries;
}

/** Types lines at a CLI agent, one keystroke at a time. */
function replayTyping(lines: string[], start: MemoryEntry[] = []): MemoryEntry[] {
  let entries = start;
  let state: InputState = EMPTY_INPUT_STATE;
  for (const line of lines) {
    for (const char of `${line}\r`) {
      const result = applyInputChunk(state, char);
      state = result.state;
      for (const submitted of result.lines) {
        const statement = detectMemoryStatement(submitted);
        if (!statement) continue;
        clock += 1000;
        entries = upsertMemoryEntry(entries, {
          id: `id-${clock}`,
          now: clock,
          category: statement.category,
          content: statement.content,
          importance: 5,
          source: "terminal",
        }).entries;
      }
    }
  }
  return entries;
}

const contents = (entries: MemoryEntry[]) => entries.map((entry) => entry.content).sort();

// ============================================================ a real session

/** A plausible half hour of work. */
const SESSION: CommandObservation[] = [
  { command: "ls -la", output: "package.json  src", exitCode: 0 },
  { command: "cat package.json", output: '{ "name": "portfolio" }', exitCode: 0 },
  { command: "git status", output: "nothing to commit", exitCode: 0 },
  { command: "node -v", output: "v22.3.0", exitCode: 0 },
  { command: "npm install", output: "added 402 packages", exitCode: 0 },
  { command: "npm run build", output: "built in 1.5s", exitCode: 0 },
  { command: "npm run dev", output: "  ➜  Local: http://localhost:5173/", exitCode: 0 },
  { command: "npm test", output: "12 passed", exitCode: 0 },
  { command: "git commit -m 'wip'", output: "1 file changed", exitCode: 0 },
  { command: "cargo build", output: "Finished dev", exitCode: 0 },
];

test("a whole session of successful work leaves the bank empty", () => {
  // Every one of those is either routine or already written in the project's
  // own files. None of it belongs in memory.
  assert.deepEqual(replayCommands(SESSION), []);
});

test("only a missing tool survives from a session of failures", () => {
  const entries = replayCommands([
    ...SESSION,
    { command: "npm run build", output: "error TS2339", exitCode: 1 },
    { command: "cargo test", output: "test result: FAILED", exitCode: 101 },
    { command: "pnpm install", output: "bash: pnpm: command not found", exitCode: 127 },
    { command: "sl", output: "bash: sl: command not found", exitCode: 127 },
  ]);
  assert.deepEqual(contents(entries), ["`pnpm` is not installed on this machine."]);
});

// ============================================================ what users say

test("what the user states is the real memory", () => {
  const entries = replayTyping([
    "kimi",
    "my name is Domenic 23 years old from berlin, call me Yivani",
    "how do I add a route",
    "remember that I prefer concise answers without emojis",
    "npm run build",
    "what is my name",
    "remember that we never force push to main",
    "fix my github action",
    "exit",
  ]);
  assert.deepEqual(contents(entries), [
    "I prefer concise answers without emojis",
    "my name is Domenic 23 years old from berlin, call me Yivani",
    "we never force push to main",
  ]);
});

test("nine lines of ordinary CLI use produce nothing", () => {
  const entries = replayTyping([
    "npm run build",
    "git status",
    "how do I fix this type error",
    "run the tests please",
    "explain this function",
    "my name is not showing up in the header",
    "why is my username null",
    "cargo test --all",
    "exit",
  ]);
  assert.deepEqual(entries, []);
});

// ================================================================ stability

test("repeating a session changes nothing", () => {
  const first = replayCommands([
    { command: "pnpm test", output: "zsh: command not found: pnpm", exitCode: 127 },
  ]);
  const second = replayCommands(
    [{ command: "pnpm build", output: "zsh: command not found: pnpm", exitCode: 127 }],
    first,
  );
  assert.equal(second.length, 1, "a repeat confirms, it does not duplicate");
  assert.ok((second[0].hits ?? 1) > (first[0].hits ?? 1));
});

test("saying the same thing twice confirms one memory", () => {
  const once = replayTyping(["remember that I prefer concise answers"]);
  const twice = replayTyping(["remember that I prefer concise answers"], once);
  assert.equal(twice.length, 1);
  assert.equal(twice[0].id, once[0].id, "identity is stable");
});

// =================================================================== global

test("every fact is global, so every workspace reads the same bank", () => {
  const entries = [
    ...replayTyping(["my name is Domenic, call me Yivani"]),
    ...replayCommands([
      { command: "pnpm test", output: "zsh: command not found: pnpm", exitCode: 127 },
    ]),
  ];
  for (const entry of entries) {
    assert.equal(
      entry.workspaceId,
      undefined,
      `"${entry.content}" must not be tied to one workspace`,
    );
  }
  // And the prompt returns all of it no matter which workspace asks.
  for (const workspace of ["ws-site", "ws-game", "ws-brand-new"]) {
    assert.equal(
      selectPromptEntries(entries, ["personal", "environment"], 10_000, workspace).length,
      entries.length,
      `${workspace} should see the whole bank`,
    );
  }
});

// ================================================================== safety

test("a session full of credentials stores none of them", () => {
  const entries = replayCommands([
    {
      command: "NPM_TOKEN=ghp_abcdefghijklmnopqrstuvwx pnpm t",
      output: "pnpm: command not found",
      exitCode: 127,
    },
    {
      command: "deploy --api-key sk-abcdefghijklmnopqrstuvwxyz",
      output: "bash: deploy: command not found",
      exitCode: 127,
    },
  ]);
  const dump = JSON.stringify(entries);
  for (const secret of ["ghp_abcdef", "sk-abcdef"]) {
    assert.ok(!dump.includes(secret), `${secret} reached the memory bank`);
  }
});

// ================================================================== budgets

test("a pinned correction survives both superseding and pruning", () => {
  let entries = replayTyping(["remember that we deploy on Fridays"]);
  entries = [{ ...entries[0], pinned: true }];
  entries = replayTyping(["remember that we deploy on Fridays"], entries);
  assert.equal(entries.length, 1);

  const kept = pruneMemoryEntries(entries, 1);
  assert.deepEqual(kept.map((entry) => entry.content), ["we deploy on Fridays"]);
});

test("extraction over a long session stays fast", () => {
  const started = performance.now();
  let entries: MemoryEntry[] = [];
  for (let i = 0; i < 300; i += 1) entries = replayCommands(SESSION, entries);
  const elapsed = performance.now() - started;
  assert.deepEqual(entries, [], "3000 successful commands still yield nothing");
  assert.ok(
    elapsed < 2000,
    `3000 observations took ${Math.round(elapsed)}ms, too slow to run inline`,
  );
});

// ================================================================== gemini

/**
 * Gemini CLI, which no one here has a subscription for.
 *
 * It is an Ink TUI like Claude Code and Kimi, so the same trap that broke Kimi
 * applies: the terminal answers the app's own queries on the *input* stream,
 * in the middle of a sentence being typed. Since it cannot be tried by hand,
 * the sequences it provokes are replayed literally instead.
 */
const ESC = "\u001B";

/** Types raw bytes, including whatever the terminal injects. */
function replayChunks(chunks: string[], start: MemoryEntry[] = []): MemoryEntry[] {
  let entries = start;
  let state: InputState = EMPTY_INPUT_STATE;
  for (const chunk of chunks) {
    const result = applyInputChunk(state, chunk);
    state = result.state;
    for (const line of result.lines) {
      const statement = detectMemoryStatement(line);
      if (!statement) continue;
      clock += 1000;
      entries = upsertMemoryEntry(entries, {
        id: `id-${clock}`,
        now: clock,
        category: statement.category,
        content: statement.content,
        importance: 5,
        source: "terminal",
      }).entries;
    }
  }
  return entries;
}

test("a directive typed into Gemini CLI survives its startup chatter", () => {
  const entries = replayChunks([
    // Gemini asks what the terminal is; the terminal answers into stdin.
    `${ESC}[?62;1;2;6;9;15;22c`,
    // Focus lands in the input box.
    `${ESC}[I`,
    "remember that ",
    // Its input box redraws and asks where the cursor is, mid-sentence.
    `${ESC}[24;80R`,
    "I prefer concise answers",
    "\r",
  ]);
  assert.deepEqual(contents(entries), ["I prefer concise answers"]);
});

test("selecting text with the mouse in Gemini does not erase the line", () => {
  const entries = replayChunks([
    "remember that we ",
    // SGR mouse press and release while dragging over the transcript.
    `${ESC}[<0;12;34M`,
    `${ESC}[<0;40;34m`,
    "never force push to main\r",
  ]);
  assert.deepEqual(contents(entries), ["we never force push to main"]);
});

test("a fact pasted into Gemini's input box is kept whole", () => {
  const entries = replayChunks([
    `${ESC}[200~remember that the staging database is read-only${ESC}[201~`,
    "\r",
  ]);
  assert.deepEqual(contents(entries), ["the staging database is read-only"]);
});

test("an arrow key in Gemini still abandons the line, as everywhere else", () => {
  // Not a Gemini quirk — the rule that a cursor move makes the buffer
  // untrustworthy has to hold in every agent, or the bank fills with halves.
  assert.deepEqual(
    replayChunks(["remember that ", `${ESC}[D`, "half a thought\r"]),
    [],
  );
});
