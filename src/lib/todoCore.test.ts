import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextTodo,
  getTodoToolRequirement,
  moveTodo,
  type TodoItem,
} from "./todoCore.ts";

const task = (
  id: string,
  priority: TodoItem["priority"],
  status: TodoItem["status"] = "queued",
): TodoItem => ({
  id,
  text: id,
  priority,
  status,
  multiAgent: false,
  createdAt: 0,
});

test("selects Critical before lower-priority work", () => {
  assert.equal(
    getNextTodo([task("low", "low"), task("critical", "critical")])?.id,
    "critical",
  );
});

test("moves tasks down within a priority", () => {
  const moved = moveTodo(
    [task("a", "high"), task("b", "high"), task("c", "high")],
    "a",
    "high",
    "c",
  );
  assert.deepEqual(moved.map((item) => item.id), ["b", "c", "a"]);
});

test("moves tasks into a different priority", () => {
  const moved = moveTodo(
    [task("a", "low"), task("b", "critical")],
    "a",
    "critical",
    "b",
  );
  assert.deepEqual(
    moved.filter((item) => item.priority === "critical").map((item) => item.id),
    ["a", "b"],
  );
});

test("requires real tool evidence for workspace Todos", () => {
  assert.equal(
    getTodoToolRequirement(
      "Change in /products/blackone the interactive app rename agent to ToDo",
    ),
    "change",
  );
  assert.equal(
    getTodoToolRequirement("in the dropdown make Black One with an outline animation"),
    "change",
  );
  assert.equal(getTodoToolRequirement("Summarize this project"), "read");
  assert.equal(getTodoToolRequirement("Write a short customer email"), "none");
});
