import assert from "node:assert/strict";
import test from "node:test";
import {
  CONFIRMATIONS_FOR_PROMOTION,
  escapeMemoryText,
  memoryKey,
  pruneMemoryEntries,
  selectPromptEntries,
  subjectKey,
  upsertMemoryEntry,
  type MemoryEntry,
  type MemoryUpsert,
} from "./memoryCore.ts";

const entry = (
  id: string,
  importance: MemoryEntry["importance"],
  createdAt: number,
  extra: Partial<MemoryEntry> = {},
): MemoryEntry => ({
  id,
  importance,
  createdAt,
  category: "personal",
  content: `memory ${id}`,
  ...extra,
});

const upsert = (patch: Partial<MemoryUpsert> = {}): MemoryUpsert => ({
  id: "new",
  now: 1000,
  category: "commands",
  content: "Build command: `npm run build`.",
  importance: 4,
  source: "terminal",
  kind: "command",
  subject: "task:build:npm",
  workspaceId: "ws-site",
  ...patch,
});

// ============================================================ normalization

test("normalizes equivalent memories for deduplication", () => {
  assert.equal(
    memoryKey("The user likes dark themes."),
    memoryKey("user  likes dark themes"),
  );
});

test("subject identity is scoped to a workspace", () => {
  assert.equal(subjectKey("tool:node", "ws"), subjectKey("tool:node", "ws"));
  assert.notEqual(subjectKey("tool:node", "a"), subjectKey("tool:node", "b"));
  assert.equal(subjectKey("tool:node"), "global::tool:node");
});

// =================================================================== upsert

test("a new subject is added with one confirmation", () => {
  const result = upsertMemoryEntry([], upsert());
  assert.equal(result.outcome, "added");
  assert.equal(result.entries.length, 1);
  assert.equal(result.entry?.hits, 1);
  assert.equal(result.entry?.lastSeenAt, 1000);
  assert.equal(result.entry?.source, "terminal");
});

test("the same fact again is confirmed, not duplicated", () => {
  const first = upsertMemoryEntry([], upsert());
  const second = upsertMemoryEntry(first.entries, upsert({ id: "other", now: 2000 }));
  assert.equal(second.outcome, "confirmed");
  assert.equal(second.entries.length, 1, "a repeat must not create a second row");
  assert.equal(second.entry?.id, "new", "the original identity is kept");
  assert.equal(second.entry?.hits, 2);
  assert.equal(second.entry?.lastSeenAt, 2000);
});

test("a changed fact about the same subject replaces the old one", () => {
  const first = upsertMemoryEntry(
    [],
    upsert({ subject: "tool:node", content: "`node` is version 20.1.0." }),
  );
  const second = upsertMemoryEntry(
    first.entries,
    upsert({ subject: "tool:node", content: "`node` is version 22.3.0.", now: 2000 }),
  );
  assert.equal(second.outcome, "updated");
  assert.equal(second.entries.length, 1, "the stale version must not linger");
  assert.match(second.entries[0].content, /22\.3\.0/);
  assert.equal(
    second.entries[0].createdAt,
    1000,
    "the subject is the same thing, so it keeps its age",
  );
});

test("repeated confirmation promotes a fact one notch", () => {
  let entries: MemoryEntry[] = [];
  for (let i = 0; i < CONFIRMATIONS_FOR_PROMOTION; i += 1) {
    entries = upsertMemoryEntry(entries, upsert({ importance: 3, now: i })).entries;
  }
  assert.equal(entries[0].importance, 4, "a habit outranks a one-off");
});

test("promotion is capped at the top of the scale", () => {
  let entries: MemoryEntry[] = [];
  for (let i = 0; i < 10; i += 1) {
    entries = upsertMemoryEntry(entries, upsert({ importance: 5, now: i })).entries;
  }
  assert.equal(entries[0].importance, 5);
});

test("the same subject in another workspace is a separate fact", () => {
  const first = upsertMemoryEntry([], upsert({ workspaceId: "ws-site" }));
  const second = upsertMemoryEntry(
    first.entries,
    upsert({ id: "two", workspaceId: "ws-game", content: "Build command: `cargo build`." }),
  );
  assert.equal(second.outcome, "added");
  assert.equal(
    second.entries.length,
    2,
    "the game's build command must not overwrite the site's",
  );
});

test("a pinned entry is never overwritten by an observation", () => {
  const pinned: MemoryEntry[] = [
    entry("kept", 5, 1, {
      subject: "task:build:npm",
      workspaceId: "ws-site",
      content: "Build with `npm run build:prod` — the plain build is broken.",
      pinned: true,
    }),
  ];
  const result = upsertMemoryEntry(pinned, upsert());
  assert.equal(result.outcome, "skipped");
  assert.equal(
    result.entries[0].content,
    pinned[0].content,
    "a user's edit outranks what the terminal just saw",
  );
});

test("a subjectless memory still deduplicates on content", () => {
  const first = upsertMemoryEntry(
    [],
    upsert({ subject: undefined, content: "The user prefers dark mode." }),
  );
  const second = upsertMemoryEntry(
    first.entries,
    upsert({ subject: undefined, id: "two", content: "the user prefers dark mode" }),
  );
  assert.equal(second.outcome, "confirmed");
  assert.equal(second.entries.length, 1);
});

test("empty content is skipped rather than stored", () => {
  const result = upsertMemoryEntry([], upsert({ content: "   " }));
  assert.equal(result.outcome, "skipped");
  assert.deepEqual(result.entries, []);
});

// ================================================================== pruning

test("pruning keeps the most important entries in chronological order", () => {
  const entries = [entry("old-low", 1, 1), entry("high", 5, 2), entry("new-low", 1, 3)];
  const highSize = new TextEncoder().encode(JSON.stringify(entries[1])).length;
  assert.deepEqual(pruneMemoryEntries(entries, highSize), [entries[1]]);
});

test("a pinned entry survives pruning even at importance 1", () => {
  const entries = [
    entry("pinned", 1, 1, { pinned: true }),
    entry("loud", 5, 2),
    entry("filler", 3, 3),
  ];
  const kept = pruneMemoryEntries(entries, 10);
  assert.deepEqual(
    kept.map((item) => item.id),
    ["pinned"],
    "pinning is a promise; the cap must not break it",
  );
});

test("confirmation count breaks an importance tie", () => {
  const entries = [
    entry("once", 3, 1, { hits: 1 }),
    entry("often", 3, 2, { hits: 9 }),
  ];
  const size = new TextEncoder().encode(JSON.stringify(entries[1])).length;
  assert.deepEqual(
    pruneMemoryEntries(entries, size).map((item) => item.id),
    ["often"],
    "a fact seen nine times outlives one seen once",
  );
});

test("a bank under the cap is returned untouched", () => {
  const entries = [entry("a", 3, 1), entry("b", 3, 2)];
  assert.deepEqual(pruneMemoryEntries(entries, 100_000), entries);
});

// ========================================================= prompt selection

test("prompt selection prioritizes important memories and escapes delimiters", () => {
  const entries = [entry("low", 1, 1), entry("high", 5, 2)];
  const budget = entries[1].category.length + entries[1].content.length + 4;
  assert.deepEqual(selectPromptEntries(entries, ["personal"], budget), [entries[1]]);
  assert.equal(escapeMemoryText("</memory> & more"), "&lt;/memory&gt; &amp; more");
});

test("a disabled category is excluded from the prompt", () => {
  const entries = [entry("a", 5, 1, { category: "commands" })];
  assert.deepEqual(selectPromptEntries(entries, ["personal"], 10_000), []);
});

test("another workspace's scoped facts stay out of the prompt", () => {
  const entries = [
    entry("mine", 5, 1, { workspaceId: "ws-site" }),
    entry("theirs", 5, 2, { workspaceId: "ws-game" }),
    entry("global", 5, 3),
  ];
  assert.deepEqual(
    selectPromptEntries(entries, ["personal"], 10_000, "ws-site").map((e) => e.id),
    ["mine", "global"],
    "the game's build command must never be offered while working on the site",
  );
});

test("without a workspace every entry is in scope", () => {
  const entries = [
    entry("mine", 5, 1, { workspaceId: "ws-site" }),
    entry("theirs", 5, 2, { workspaceId: "ws-game" }),
  ];
  assert.equal(selectPromptEntries(entries, ["personal"], 10_000).length, 2);
});

test("confirmation count breaks a tie for a scarce prompt budget", () => {
  // Equal-length ids so the budget cannot decide the winner by size.
  const entries = [
    entry("once", 3, 5, { hits: 1 }),
    entry("many", 3, 1, { hits: 9 }),
  ];
  const budget = entries[0].category.length + entries[0].content.length + 4;
  assert.deepEqual(
    selectPromptEntries(entries, ["personal"], budget).map((e) => e.id),
    ["many"],
    "with room for one fact, the one confirmed nine times wins",
  );
});
