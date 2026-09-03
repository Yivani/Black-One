import assert from "node:assert/strict";
import test from "node:test";
import { clipboardActionFor } from "./clipboardKeys.ts";

const key = (
  value: string,
  modifiers: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {},
) => ({
  key: value,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...modifiers,
});

// ------------------------------------------------------------------ windows

test("reads Ctrl+C, Ctrl+X and Ctrl+V", () => {
  assert.equal(clipboardActionFor(key("c", { ctrlKey: true }), false), "copy");
  assert.equal(clipboardActionFor(key("x", { ctrlKey: true }), false), "cut");
  assert.equal(clipboardActionFor(key("v", { ctrlKey: true }), false), "paste");
});

test("the terminal's Ctrl+Shift+C arrives as an uppercase key", () => {
  // The regression this guards: matching on "c" alone missed every Shift
  // variant, because the browser reports "C" while Shift is held.
  assert.equal(clipboardActionFor(key("C", { ctrlKey: true }), false), "copy");
  assert.equal(clipboardActionFor(key("V", { ctrlKey: true }), false), "paste");
});

test("a bare keypress is not a clipboard shortcut", () => {
  assert.equal(clipboardActionFor(key("c"), false), null);
  assert.equal(clipboardActionFor(key("v"), false), null);
});

test("other letters are left alone", () => {
  assert.equal(clipboardActionFor(key("a", { ctrlKey: true }), false), null);
  assert.equal(clipboardActionFor(key("Enter", { ctrlKey: true }), false), null);
});

test("Alt rules a shortcut out", () => {
  assert.equal(
    clipboardActionFor(key("c", { ctrlKey: true, altKey: true }), false),
    null,
  );
});

test("Command does not copy away from macOS", () => {
  assert.equal(clipboardActionFor(key("c", { metaKey: true }), false), null);
});

// ---------------------------------------------------------------------- mac

test("reads Command+C and Command+V on macOS", () => {
  assert.equal(clipboardActionFor(key("c", { metaKey: true }), true), "copy");
  assert.equal(clipboardActionFor(key("v", { metaKey: true }), true), "paste");
});

test("Control does not copy on macOS", () => {
  assert.equal(clipboardActionFor(key("c", { ctrlKey: true }), true), null);
});

test("holding both modifiers is not a shortcut on either platform", () => {
  const both = key("c", { ctrlKey: true, metaKey: true });
  assert.equal(clipboardActionFor(both, true), null);
  assert.equal(clipboardActionFor(both, false), null);
});
