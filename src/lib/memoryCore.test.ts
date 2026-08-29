import assert from "node:assert/strict";
import test from "node:test";
import {
  escapeMemoryText,
  memoryKey,
  pruneMemoryEntries,
  selectPromptEntries,
  type MemoryEntry,
} from "./memoryCore.ts";

const entry = (id: string, importance: MemoryEntry["importance"], createdAt: number): MemoryEntry => ({
  id,
  importance,
  createdAt,
  category: "personal",
  content: `memory ${id}`,
});

test("normalizes equivalent memories for deduplication", () => {
  assert.equal(memoryKey("The user likes dark themes."), memoryKey("user  likes dark themes"));
});

test("pruning keeps the most important entries in chronological order", () => {
  const entries = [entry("old-low", 1, 1), entry("high", 5, 2), entry("new-low", 1, 3)];
  const highSize = new TextEncoder().encode(JSON.stringify(entries[1])).length;
  assert.deepEqual(pruneMemoryEntries(entries, highSize), [entries[1]]);
});

test("prompt selection prioritizes important memories and escapes delimiters", () => {
  const entries = [entry("low", 1, 1), entry("high", 5, 2)];
  const budget = entries[1].category.length + entries[1].content.length + 4;
  assert.deepEqual(selectPromptEntries(entries, ["personal"], budget), [entries[1]]);
  assert.equal(escapeMemoryText("</memory> & more"), "&lt;/memory&gt; &amp; more");
});
