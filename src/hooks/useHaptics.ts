import { useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/settingsStore";
import { isTauri } from "@/lib/ipc";

/** Default haptic pulse length in milliseconds. */
export const HAPTIC_PATTERN = 20;

const DEFAULT_CLICK_SOUND = "/click.wav";
const DEFAULT_FINISH_SOUND = "/finish.wav";
const DEFAULT_ERROR_SOUND = "/other.wav";

const INTERACTIVE_SELECTOR =
  'button, [role="button"], a, label:has(input[type="checkbox"], input[type="radio"]), [data-haptic]';

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

function resolveSoundUrl(sound: string, fallback: string): string {
  if (sound === "default" || !sound) return fallback;
  if (!isTauri) return fallback;
  try {
    return convertFileSrc(sound);
  } catch {
    return fallback;
  }
}

function playSound(url: string, volume: number): void {
  if (typeof window === "undefined") return;
  const audio = new Audio(url);
  audio.volume = Math.max(0, Math.min(1, volume));
  void audio.play().catch(() => {
    // Autoplay may be blocked by the browser; ignore silently.
  });
}

function playClickSound(): void {
  const { settings } = useSettingsStore.getState();
  if (!settings.haptics.enabled) return;
  const url = resolveSoundUrl(settings.haptics.clickSound, DEFAULT_CLICK_SOUND);
  playSound(url, settings.haptics.volume);
}

function playFinishSound(): void {
  const { settings } = useSettingsStore.getState();
  if (!settings.haptics.enabled) return;
  const url = resolveSoundUrl(settings.haptics.finishSound, DEFAULT_FINISH_SOUND);
  playSound(url, settings.haptics.volume);
}

function playErrorSound(): void {
  const { settings } = useSettingsStore.getState();
  if (!settings.haptics.enabled) return;
  const url = resolveSoundUrl(settings.haptics.errorSound, DEFAULT_ERROR_SOUND);
  playSound(url, settings.haptics.volume);
}

/**
 * Trigger a haptic pulse, click sound, and a tiny visual press fallback.
 * Returns early if haptics are disabled or if navigator.vibrate is unavailable.
 */
export function triggerHaptic(
  pattern: number | number[] = HAPTIC_PATTERN,
  element?: HTMLElement | null,
): void {
  const { settings } = useSettingsStore.getState();
  if (!settings.haptics.enabled) return;
  vibrate(pattern);
  playClickSound();
  if (element) addVisualFeedback(element);
}

export { playClickSound, playFinishSound, playErrorSound };

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

      triggerHaptic(HAPTIC_PATTERN, interactive);
    };

    document.addEventListener("click", handler, { passive: true });
    return () => document.removeEventListener("click", handler);
  }, []);
}
