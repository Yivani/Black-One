import assert from "node:assert/strict";
import test from "node:test";
import { extractExplicitMemory } from "./memoryPrompt.ts";

test("extracts an explicit personal-memory request", () => {
  assert.deepEqual(
    extractExplicitMemory(
      "Save this information about me\n\nim domenic 23 years old living in germany berlin",
    ),
    {
      category: "personal",
      content: "im domenic 23 years old living in germany berlin",
      importance: 5,
    },
  );
});

test("does not store ordinary conversation as explicit memory", () => {
  assert.equal(extractExplicitMemory("Where did you save it?"), null);
});

test("classifies explicit preferences without an extraction request", () => {
  assert.equal(
    extractExplicitMemory("Remember that I prefer compact answers")?.category,
    "preferences",
  );
});
