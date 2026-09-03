import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "@/lib/ipc";

/**
 * Clipboard access for the desktop shell.
 *
 * The webview's own Clipboard API is not dependable here: reads are refused
 * outside a user gesture the webview recognises, and a hardened context can
 * refuse both directions outright. Tauri's clipboard plugin talks to the OS
 * clipboard directly, so it is tried first and the browser paths are kept as
 * fallbacks for the dev server in a normal tab.
 */

export function isMacPlatform(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac")
  );
}

/** Copies text, resolving false when every path was refused. */
export async function copyText(text: string): Promise<boolean> {
  if (isTauri) {
    try {
      await writeText(text);
      return true;
    } catch {
      // Plugin refused (missing capability, no clipboard owner) — try the DOM.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be unavailable in hardened contexts; fall back to a
    // hidden textarea + selection copy.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  textarea.remove();
  return copied;
}

/** Reads the clipboard, resolving empty when every path was refused. */
export async function readClipboardText(): Promise<string> {
  if (isTauri) {
    try {
      const text = await readText();
      if (typeof text === "string") return text;
    } catch {
      // As above: fall through to the DOM API.
    }
  }
  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}
