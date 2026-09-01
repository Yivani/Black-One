import { isTauri } from "@/lib/ipc";
import {
  minutesSinceMidnight,
  shouldNotify,
  type NotifyKind,
} from "@/lib/notifyCore";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Desktop notifications.
 *
 * The scheduling rules live in `notifyCore` where they are tested; this module
 * is only the part that has to touch the OS.
 */

type NotificationModule = typeof import("@tauri-apps/plugin-notification");

let modulePromise: Promise<NotificationModule> | null = null;
let permission: "granted" | "denied" | "unknown" = "unknown";

async function getModule(): Promise<NotificationModule> {
  modulePromise ??= import("@tauri-apps/plugin-notification");
  return modulePromise;
}

/**
 * Asks the OS once and caches the answer.
 *
 * Requesting on every notification would prompt repeatedly on platforms that
 * do not remember a denial, so a "denied" answer sticks for the session and
 * the settings page surfaces it instead of failing silently.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isTauri) return false;
  if (permission !== "unknown") return permission === "granted";
  try {
    const api = await getModule();
    const granted =
      (await api.isPermissionGranted()) ||
      (await api.requestPermission()) === "granted";
    permission = granted ? "granted" : "denied";
    return granted;
  } catch {
    permission = "denied";
    return false;
  }
}

/** Whether the OS has already refused us, for the settings page to explain. */
export function notificationPermissionDenied(): boolean {
  return permission === "denied";
}

/** Sends a notification unconditionally. Used by the "send a test" button. */
export async function sendNotification(
  title: string,
  body: string,
): Promise<boolean> {
  if (!(await ensureNotificationPermission())) return false;
  try {
    const api = await getModule();
    await api.sendNotification({ title, body });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a notification if the user's settings, quiet hours, and window focus
 * all allow it. Returns whether anything was raised.
 */
export async function notify(
  kind: NotifyKind,
  title: string,
  body: string,
): Promise<boolean> {
  const { notifications } = useSettingsStore.getState().settings;
  const focused =
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    document.hasFocus();

  const allowed = shouldNotify({
    kind,
    categoryEnabled:
      kind === "approval"
        ? notifications.desktopEnabled && notifications.approvalsEnabled
        : notifications.desktopEnabled,
    quietHours: {
      enabled: notifications.dndEnabled,
      start: notifications.dndStart,
      end: notifications.dndEnd,
    },
    nowMinutes: minutesSinceMidnight(new Date()),
    windowFocused: focused,
  });
  if (!allowed) return false;

  return sendNotification(title, body);
}
