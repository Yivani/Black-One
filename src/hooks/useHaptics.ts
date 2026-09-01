import { useEffect } from "react";
import { playAppSound } from "@/lib/sounds";
import type { SoundId } from "@/lib/soundCore";
import { useSettingsStore } from "@/stores/settingsStore";

/** Default haptic pulse length in milliseconds. */
export const HAPTIC_PATTERN = 20;

const INTERACTIVE_SELECTOR =
  'button, [role="button"], a, label:has(input[type="checkbox"], input[type="radio"]), [data-haptic]';

/**
 * Controls that get the toggle sound rather than the click.
 *
 * A switch and a button are different actions, and hearing the same tick for
 * both is what makes an interface sound like a toy. Radix marks its switches,
 * tabs and checkboxes with these roles.
 */
const TOGGLE_SELECTOR =
  '[role="switch"], [role="checkbox"], [role="radio"], [role="tab"], input[type="checkbox"], input[type="radio"]';

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration API may be disabled; ignore.
  }
}

function addVisualFeedback(element: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.classList.add("haptic-feedback");
  window.setTimeout(() => {
    element.classList.remove("haptic-feedback");
  }, 120);
}

/**
 * The one way the rest of the app makes a sound.
 *
 * Named after what happened, never after what it sounds like — so the sound
 * set can be changed here without touching a single caller.
 */
export function playSound(id: SoundId): void {
  playAppSound(id);
}

/** Kept for the callers that predate the named sounds. */
export function playClickSound(): void {
  playAppSound("click");
}
export function playFinishSound(): void {
  playAppSound("complete");
}
export function playErrorSound(): void {
  playAppSound("error");
}

/**
 * Trigger a haptic pulse, the press sound, and a tiny visual press fallback.
 * Returns early if haptics are disabled.
 */
export function triggerHaptic(
  pattern: number | number[] = HAPTIC_PATTERN,
  element?: HTMLElement | null,
): void {
  const { settings } = useSettingsStore.getState();
  if (!settings.haptics.enabled) return;
  vibrate(pattern);
  playAppSound("click");
  if (element) addVisualFeedback(element);
}

/**
 * Global haptic feedback hook. Attach it once near the app root.
 * Listens for clicks on interactive elements and triggers haptics unless
 * the element has `data-haptic="false"` or haptics are disabled.
 */
export function useHapticFeedback(): void {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest<HTMLElement>(INTERACTIVE_SELECTOR);
      if (!interactive) return;
      if (interactive.getAttribute("data-haptic") === "false") return;

      const { settings } = useSettingsStore.getState();
      if (!settings.haptics.enabled) return;

      vibrate(HAPTIC_PATTERN);
      playAppSound(interactive.closest(TOGGLE_SELECTOR) ? "toggle" : "click");
      addVisualFeedback(interactive);
    };

    document.addEventListener("click", handler, { passive: true });
    return () => document.removeEventListener("click", handler);
  }, []);
}
