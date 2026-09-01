import assert from "node:assert/strict";
import test from "node:test";
import {
  isWithinQuietHours,
  minutesSinceMidnight,
  notificationTitle,
  parseHhMm,
  shouldNotify,
  type NotifyDecision,
} from "./notifyCore.ts";

// ------------------------------------------------------------------ parsing

test("parses a 24-hour time into minutes", () => {
  assert.equal(parseHhMm("00:00"), 0);
  assert.equal(parseHhMm("08:30"), 510);
  assert.equal(parseHhMm("23:59"), 1439);
  assert.equal(parseHhMm(" 9:05 "), 545, "a single-digit hour is still valid");
});

test("rejects anything that is not a real time", () => {
  assert.equal(parseHhMm("24:00"), null);
  assert.equal(parseHhMm("12:60"), null);
  assert.equal(parseHhMm("12"), null);
  assert.equal(parseHhMm("12:5"), null);
  assert.equal(parseHhMm(""), null);
  assert.equal(parseHhMm("noon"), null);
});

test("reads minutes off a Date", () => {
  assert.equal(minutesSinceMidnight(new Date(2026, 0, 1, 14, 45)), 885);
});

// -------------------------------------------------------------- quiet hours

test("a same-day window silences only inside itself", () => {
  assert.equal(isWithinQuietHours(600, "09:00", "17:00"), true);
  assert.equal(isWithinQuietHours(540, "09:00", "17:00"), true, "start is inclusive");
  assert.equal(isWithinQuietHours(1020, "09:00", "17:00"), false, "end is exclusive");
  assert.equal(isWithinQuietHours(60, "09:00", "17:00"), false);
});

test("an overnight window wraps midnight", () => {
  const inWindow = (m: number) => isWithinQuietHours(m, "22:00", "08:00");
  assert.equal(inWindow(1380), true, "22:00 itself");
  assert.equal(inWindow(1439), true, "23:59");
  assert.equal(inWindow(0), true, "midnight");
  assert.equal(inWindow(419), true, "06:59");
  assert.equal(inWindow(480), false, "08:00 ends it");
  assert.equal(inWindow(720), false, "midday is not quiet");
});

test("an equal start and end is a zero-length window, not a silent day", () => {
  assert.equal(isWithinQuietHours(600, "09:00", "09:00"), false);
});

test("an unparseable window silences nothing", () => {
  assert.equal(isWithinQuietHours(600, "nope", "17:00"), false);
  assert.equal(isWithinQuietHours(600, "09:00", "25:00"), false);
});

// ------------------------------------------------------------- the decision

const base: NotifyDecision = {
  kind: "response",
  categoryEnabled: true,
  quietHours: { enabled: false, start: "22:00", end: "08:00" },
  nowMinutes: 600,
  windowFocused: false,
};

test("notifies about a finished response when the window is not focused", () => {
  assert.equal(shouldNotify(base), true);
});

test("stays silent about a response the user is already looking at", () => {
  assert.equal(shouldNotify({ ...base, windowFocused: true }), false);
});

test("an approval interrupts even a focused window", () => {
  assert.equal(
    shouldNotify({ ...base, kind: "approval", windowFocused: true }),
    true,
    "the agent is blocked until the user answers",
  );
});

test("a disabled category wins over everything", () => {
  assert.equal(shouldNotify({ ...base, categoryEnabled: false }), false);
  assert.equal(
    shouldNotify({ ...base, kind: "approval", categoryEnabled: false }),
    false,
  );
});

test("quiet hours silence both kinds", () => {
  const quiet = {
    ...base,
    nowMinutes: 1400,
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
  };
  assert.equal(shouldNotify(quiet), false);
  assert.equal(shouldNotify({ ...quiet, kind: "approval" }), false);
});

test("quiet hours only apply while switched on", () => {
  assert.equal(
    shouldNotify({
      ...base,
      nowMinutes: 1400,
      quietHours: { enabled: false, start: "22:00", end: "08:00" },
    }),
    true,
  );
});

// ----------------------------------------------------------------- titles

test("shortens a long session title", () => {
  const long = "A very long conversation title that will not fit in a toast at all";
  const result = notificationTitle(long);
  assert.ok(result.length <= 48);
  assert.ok(result.endsWith("…"));
});

test("keeps a short title as-is and names an empty one", () => {
  assert.equal(notificationTitle("Refactor the parser"), "Refactor the parser");
  assert.equal(notificationTitle("   "), "Untitled chat");
  assert.equal(notificationTitle(undefined), "Untitled chat");
});
