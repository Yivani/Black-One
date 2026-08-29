import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

/** Return false to let the event propagate (e.g. Escape closing a modal). */
export type ShortcutHandlers = Record<string, () => void | boolean>;

function normalizeBinding(event: KeyboardEvent): string | null {
  const key = event.key;
  if (["Control", "Meta", "Shift", "Alt"].includes(key)) return null;
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("Mod");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");
  let normalized = key.length === 1 ? key.toUpperCase() : key;
  if (normalized === " ") normalized = "Space";
  if (normalized === "ArrowUp") normalized = "Up";
  if (normalized === "ArrowDown") normalized = "Down";
  if (normalized === "ArrowLeft") normalized = "Left";
  if (normalized === "ArrowRight") normalized = "Right";
  if (normalized === "Escape") normalized = "Escape";
  parts.push(normalized);
  return parts.join("+");
}

export function bindingFromEvent(event: KeyboardEvent): string | null {
  return normalizeBinding(event);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable || tag === "SELECT"
  );
}

/**
 * Registers global keyboard shortcuts from the user's settings.
 * Escape and modal-level shortcuts fire even inside editable elements;
 * everything else is suppressed while typing.
 */
export function useKeyboardShortcut(handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const binding = normalizeBinding(event);
      if (!binding) return;
      const shortcuts = useSettingsStore.getState().settings.shortcuts;
      const actionId = Object.entries(shortcuts).find(([, b]) => b === binding)?.[0];
      if (!actionId) return;
      const handler = handlersRef.current[actionId];
      if (!handler) return;
      const globalActions = new Set(["stop-generation", "open-settings", "command-palette", "new-terminal"]);
      if (isEditableTarget(event.target) && !globalActions.has(actionId)) return;
      const result = handler();
      if (result !== false) event.preventDefault();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
