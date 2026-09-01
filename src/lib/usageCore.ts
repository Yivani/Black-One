/**
 * Usage roll-ups for the Command Center.
 *
 * Import-free so the bucketing rules — local days, empty days still present,
 * the window anchored on "today" rather than on the newest message — are
 * unit-tested without a database or a React tree.
 */

export interface DailyBucket {
  /** Local calendar day at midnight, as a timestamp. */
  day: number;
  /** ISO-ish `YYYY-MM-DD` key, useful as a React key. */
  key: string;
  total: number;
  /** Messages the user sent, as opposed to assistant replies. */
  sent: number;
}

export interface DatedMessage {
  createdAt: number;
  role: string;
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Message counts for the last `days` local days, oldest first.
 *
 * Days with no activity are returned as zeros rather than omitted, so the chart
 * shows a real gap instead of silently compressing a quiet week.
 */
export function dailyActivity(
  messages: readonly DatedMessage[],
  days: number,
  now: number = Date.now(),
): DailyBucket[] {
  const span = Math.max(1, Math.floor(days));
  const today = startOfLocalDay(now);

  const buckets: DailyBucket[] = [];
  const index = new Map<number, DailyBucket>();
  for (let offset = span - 1; offset >= 0; offset -= 1) {
    // Step by calendar day rather than by 86_400_000ms so a DST change does
    // not shift every bucket by an hour and drop a day off the end.
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const day = date.getTime();
    const bucket: DailyBucket = { day, key: dayKey(day), total: 0, sent: 0 };
    buckets.push(bucket);
    index.set(day, bucket);
  }

  for (const message of messages) {
    const bucket = index.get(startOfLocalDay(message.createdAt));
    if (!bucket) continue;
    bucket.total += 1;
    if (message.role === "user") bucket.sent += 1;
  }

  return buckets;
}

/** Largest total in a series, floored at 1 so a chart never divides by zero. */
export function peakActivity(buckets: readonly DailyBucket[]): number {
  return buckets.reduce((max, bucket) => Math.max(max, bucket.total), 0) || 1;
}

/** Bar height as a percentage of the peak, with a visible floor for non-zero days. */
export function barHeight(value: number, peak: number, minPercent = 6): number {
  if (value <= 0) return 0;
  return Math.max(minPercent, (value / peak) * 100);
}
