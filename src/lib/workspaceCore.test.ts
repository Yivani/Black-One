import assert from "node:assert/strict";
import test from "node:test";
import type { TodoItem, TodoStatus } from "./todoCore.ts";
import {
  compareByUrgency,
  deriveWorkspaceName,
  selectActiveTerminalId,
  summarizeWorkspace,
  terminalsForWorkspace,
} from "./workspaceCore.ts";

const todo = (status: TodoStatus): TodoItem => ({
  id: `${status}-${Math.random()}`,
  text: status,
  priority: "mid",
  status,
  createdAt: 0,
});

// ------------------------------------------------------------- activity

test("an empty board is idle, not done", () => {
  const status = summarizeWorkspace({ todos: [] });
  assert.equal(status.activity, "idle");
  assert.equal(status.total, 0);
  assert.equal(status.done, 0);
});

test("queued work alone is idle", () => {
  assert.equal(summarizeWorkspace({ todos: [todo("queued")] }).activity, "idle");
});

test("a streaming turn reports running", () => {
  const status = summarizeWorkspace({
    todos: [todo("queued"), todo("queued")],
    streaming: true,
  });
  assert.equal(status.activity, "running");
  assert.equal(status.open, 2);
});

test("a pending approval outranks a streaming turn", () => {
  const status = summarizeWorkspace({
    todos: [todo("queued")],
    streaming: true,
    pendingApprovals: 2,
  });
  assert.equal(status.activity, "waiting");
  assert.equal(status.waiting, 2);
});

test("done requires every task to be finished", () => {
  assert.equal(
    summarizeWorkspace({ todos: [todo("done"), todo("done")] }).activity,
    "done",
  );
  assert.equal(
    summarizeWorkspace({ todos: [todo("done"), todo("queued")] }).activity,
    "idle",
    "one unfinished task means the workspace is not done",
  );
});

test("counts open against finished", () => {
  const status = summarizeWorkspace({
    todos: [todo("queued"), todo("queued"), todo("done")],
  });
  assert.equal(status.total, 3);
  assert.equal(status.done, 1);
  assert.equal(status.open, 2);
});

test("urgency ordering puts attention first", () => {
  const sorted = ["idle", "done", "running", "waiting", "error"].sort((a, b) =>
    compareByUrgency(a as never, b as never),
  );
  assert.deepEqual(sorted, ["waiting", "running", "error", "done", "idle"]);
});

// ----------------------------------------------------------------- naming

test("names a workspace after its folder", () => {
  assert.equal(deriveWorkspaceName("D:\\Projects\\my-site", []), "my-site");
  assert.equal(deriveWorkspaceName("/home/me/game/", []), "game");
});

test("falls back when there is no folder", () => {
  assert.equal(deriveWorkspaceName(null, []), "Workspace");
});

test("disambiguates a duplicate name", () => {
  assert.equal(deriveWorkspaceName("/a/site", ["site"]), "site 2");
  assert.equal(deriveWorkspaceName("/a/site", ["site", "site 2"]), "site 3");
  assert.equal(deriveWorkspaceName(null, ["Workspace"]), "Workspace 2");
});

// -------------------------------------------------------- terminal scoping

const shells = [
  { id: "a1", workspaceId: "site" },
  { id: "a2", workspaceId: "site" },
  { id: "b1", workspaceId: "game" },
  { id: "a3", workspaceId: "site" },
];

test("lists only the terminals a workspace owns, in order", () => {
  assert.deepEqual(
    terminalsForWorkspace(shells, "site").map((t) => t.id),
    ["a1", "a2", "a3"],
  );
  assert.deepEqual(
    terminalsForWorkspace(shells, "game").map((t) => t.id),
    ["b1"],
  );
  assert.deepEqual(terminalsForWorkspace(shells, "gone"), []);
  assert.deepEqual(terminalsForWorkspace(shells, null), []);
});

test("keeps each workspace's own selection", () => {
  const selection = { site: "a2", game: "b1" };
  assert.equal(selectActiveTerminalId(shells, selection, "site"), "a2");
  assert.equal(selectActiveTerminalId(shells, selection, "game"), "b1");
});

test("never selects a terminal from another workspace", () => {
  assert.equal(
    selectActiveTerminalId(shells, { site: "b1" }, "site"),
    "a1",
    "a foreign id must fall back inside the workspace",
  );
});

test("falls back to the first terminal when the selection is stale", () => {
  assert.equal(selectActiveTerminalId(shells, { site: "dead" }, "site"), "a1");
  assert.equal(selectActiveTerminalId(shells, {}, "game"), "b1");
});

test("a workspace with no terminals selects nothing", () => {
  assert.equal(selectActiveTerminalId(shells, {}, "empty"), null);
  assert.equal(selectActiveTerminalId([], { site: "a1" }, "site"), null);
});
