/**
 * Notification scheduling rules.
 *
 * Import-free so every branch — quiet hours that wrap midnight, the "only when
 * you can't already see it" rule — is unit-tested without a desktop shell.
 */

export type NotifyKind = "response" | "approval";

export interface QuietHours {
  enabled: boolean;
  /** "HH:MM", 24-hour. */
  start: string;
  end: string;
}

export interface NotifyDecision {
  kind: NotifyKind;
  /** Whether the user has that category switched on. */
  categoryEnabled: boolean;
  quietHours: QuietHours;
  /** Minutes since local midnight. */
  nowMinutes: number;
  /** True when the main window is visible and focused. */
  windowFocused: boolean;
}

/** Minutes since midnight, or null if the value is not a real "HH:MM". */
export function parseHhMm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Whether `nowMinutes` falls in the quiet window.
 *
 * The common case (22:00 → 08:00) wraps midnight, so a naive `start <= now &&
 * now < end` silences nothing at all. Equal start and end means a zero-length
 * window, not a whole silent day.
 */
export function isWithinQuietHours(
  nowMinutes: number,
  start: string,
  end: string,
): boolean {
  const from = parseHhMm(start);
  const to = parseHhMm(end);
  if (from === null || to === null) return false;
  if (from === to) return false;
  if (from < to) return nowMinutes >= from && nowMinutes < to;
  return nowMinutes >= from || nowMinutes < to;
}

/**
 * The single rule for whether to raise a desktop notification.
 *
 * Approvals are deliberately exempt from the focus check: the agent is blocked
 * until the user answers, and a prompt buried under another window is exactly
 * the case a notification exists for.
 */
export function shouldNotify(input: NotifyDecision): boolean {
  if (!input.categoryEnabled) return false;
  if (
    input.quietHours.enabled &&
    isWithinQuietHours(input.nowMinutes, input.quietHours.start, input.quietHours.end)
  ) {
    return false;
  }
  if (input.kind === "response" && input.windowFocused) return false;
  return true;
}

/** Trims a session title down to something a notification body can carry. */
export function notificationTitle(raw: string | undefined, max = 48): string {
  const text = (raw ?? "").trim();
  if (!text) return "Untitled chat";
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
