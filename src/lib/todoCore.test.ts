import assert from "node:assert/strict";
import test from "node:test";
import { moveTodo, sortTodosByRisk, type TodoItem } from "./todoCore.ts";

const task = (
  id: string,
  priority: TodoItem["priority"],
  status: TodoItem["status"] = "queued",
): TodoItem => ({
  id,
  text: id,
  priority,
  status,
  createdAt: 0,
});

// ------------------------------------------------------------- risk order

test("lists Critical first and Low last", () => {
  const sorted = sortTodosByRisk([
    task("l", "low"),
    task("m", "mid"),
    task("c", "critical"),
    task("h", "high"),
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["c", "h", "m", "l"]);
});

test("keeps the hand-arranged order inside a lane", () => {
  const sorted = sortTodosByRisk([
    task("second", "high"),
    task("first", "critical"),
    task("third", "high"),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["first", "second", "third"],
    "a stable sort is what preserves the board order within each priority",
  );
});

test("drops finished tasks", () => {
  const sorted = sortTodosByRisk([
    task("done", "critical", "done"),
    task("open", "low"),
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["open"]);
});

test("does not mutate the array it is given", () => {
  const items = [task("l", "low"), task("c", "critical")];
  sortTodosByRisk(items);
  assert.deepEqual(items.map((item) => item.id), ["l", "c"]);
});

// ---------------------------------------------------------------- moving

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
