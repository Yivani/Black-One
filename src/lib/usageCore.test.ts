import assert from "node:assert/strict";
import test from "node:test";
import { barHeight, dailyActivity, peakActivity } from "./usageCore.ts";

/** Local noon on a given day, so timezone offsets cannot push it across midnight. */
function noon(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

const NOW = noon(2026, 9, 1);

test("returns exactly the requested number of days, oldest first", () => {
  const buckets = dailyActivity([], 7, NOW);
  assert.equal(buckets.length, 7);
  assert.equal(buckets[0].key, "2026-08-26");
  assert.equal(buckets[6].key, "2026-09-01", "today is the last bucket");
});

test("counts messages into their local day", () => {
  const buckets = dailyActivity(
    [
      { createdAt: noon(2026, 9, 1), role: "user" },
      { createdAt: noon(2026, 9, 1), role: "assistant" },
      { createdAt: noon(2026, 8, 31), role: "user" },
    ],
    3,
    NOW,
  );
  assert.deepEqual(
    buckets.map((bucket) => bucket.total),
    [0, 1, 2],
  );
  assert.deepEqual(
    buckets.map((bucket) => bucket.sent),
    [0, 1, 1],
    "only user messages count as sent",
  );
});

test("a quiet day stays in the series as a zero", () => {
  const buckets = dailyActivity([{ createdAt: NOW, role: "user" }], 5, NOW);
  assert.equal(buckets.length, 5);
  assert.deepEqual(
    buckets.slice(0, 4).map((bucket) => bucket.total),
    [0, 0, 0, 0],
    "gaps must be visible, not compressed away",
  );
});

test("messages outside the window are ignored", () => {
  const buckets = dailyActivity(
    [
      { createdAt: noon(2026, 1, 1), role: "user" },
      { createdAt: noon(2026, 12, 1), role: "user" },
      { createdAt: NOW, role: "user" },
    ],
    7,
    NOW,
  );
  assert.equal(
    buckets.reduce((sum, bucket) => sum + bucket.total, 0),
    1,
    "an old message and a future one both fall outside",
  );
});

test("counts every hour of today, not just the last 24", () => {
  const earlyToday = new Date(NOW);
  earlyToday.setHours(0, 15, 0, 0);
  const buckets = dailyActivity(
    [{ createdAt: earlyToday.getTime(), role: "user" }],
    2,
    NOW,
  );
  assert.equal(buckets[1].total, 1);
});

test("a window of zero or less still yields one day", () => {
  assert.equal(dailyActivity([], 0, NOW).length, 1);
  assert.equal(dailyActivity([], -5, NOW).length, 1);
});

test("the window steps by calendar day across a month boundary", () => {
  const buckets = dailyActivity([], 3, noon(2026, 3, 2));
  assert.deepEqual(
    buckets.map((bucket) => bucket.key),
    ["2026-02-28", "2026-03-01", "2026-03-02"],
  );
});

// ------------------------------------------------------------------ scaling

test("peak is the largest total, floored at one", () => {
  assert.equal(peakActivity(dailyActivity([], 7, NOW)), 1, "an empty week is not zero");
  assert.equal(
    peakActivity([
      { day: 0, key: "a", total: 3, sent: 1 },
      { day: 1, key: "b", total: 9, sent: 4 },
    ]),
    9,
  );
});

test("a non-zero day always gets a visible bar", () => {
  assert.equal(barHeight(0, 100), 0, "a zero day draws nothing");
  assert.equal(barHeight(1, 100), 6, "one message out of a hundred is still visible");
  assert.equal(barHeight(50, 100), 50);
  assert.equal(barHeight(100, 100), 100);
});
