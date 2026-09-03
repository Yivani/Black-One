/**
 * Which clipboard action a key event is asking for.
 *
 * Pure, so the terminal and the app-wide bridge agree on what counts. It also
 * keeps the Shift variants covered: with Shift held the browser reports "C"
 * rather than "c", which is what made Ctrl+Shift+C and Ctrl+Shift+V miss.
 */
export type ClipboardAction = "copy" | "cut" | "paste";

export interface ClipboardKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

const ACTION_BY_KEY: Record<string, ClipboardAction> = {
  c: "copy",
  x: "cut",
  v: "paste",
};

/**
 * Returns the action `event` asks for, or null when it is not a clipboard
 * shortcut. `mac` picks the modifier: Command there, Control everywhere else.
 *
 * The other modifier must be absent — Ctrl+Cmd+C is not a copy — while Shift
 * is allowed, because terminals bind copy and paste to Ctrl+Shift+C/V.
 */
export function clipboardActionFor(
  event: ClipboardKeyEvent,
  mac: boolean,
): ClipboardAction | null {
  if (event.altKey) return null;
  const action = ACTION_BY_KEY[event.key.toLowerCase()];
  if (!action) return null;
  if (mac) return event.metaKey && !event.ctrlKey ? action : null;
  return event.ctrlKey && !event.metaKey ? action : null;
}
