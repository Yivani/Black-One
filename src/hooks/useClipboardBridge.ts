import { useEffect } from "react";
import { copyText, isMacPlatform, readClipboardText } from "@/lib/clipboard";
import { clipboardActionFor } from "@/lib/clipboardKeys";

/**
 * How long to wait for the webview's own copy/paste to happen before stepping
 * in. Long enough for the default action to dispatch its clipboard event,
 * short enough that a repaired paste still feels like a keystroke.
 */
const NATIVE_GRACE_MS = 60;

type Editable = HTMLInputElement | HTMLTextAreaElement;

function editableTarget(node: EventTarget | null): Editable | null {
  if (node instanceof HTMLTextAreaElement) return node;
  if (node instanceof HTMLInputElement && !node.readOnly) return node;
  return null;
}

/** True while the terminal has focus — it runs its own clipboard handling. */
function inTerminal(node: EventTarget | null): boolean {
  return node instanceof Element && node.closest(".xterm") !== null;
}

function selectedText(target: EventTarget | null): string {
  const editable = editableTarget(target);
  if (editable) {
    const { selectionStart, selectionEnd, value } = editable;
    if (selectionStart !== null && selectionEnd !== null) {
      return value.slice(selectionStart, selectionEnd);
    }
  }
  return window.getSelection()?.toString() ?? "";
}

/**
 * Writes `text` at the caret, replacing the selection.
 *
 * `insertText` is preferred because it keeps the field's own undo stack and
 * emits the input event React listens to. Where the command is unavailable the
 * value is spliced through the native setter, which is what makes a controlled
 * React input notice a change it did not make itself.
 */
function insertText(field: Editable, text: string): void {
  field.focus();
  if (text) {
    try {
      if (document.execCommand("insertText", false, text)) return;
    } catch {
      // Fall through to the manual splice.
    }
  }
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  const next = field.value.slice(0, start) + text + field.value.slice(end);
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(field, next);
  else field.value = next;
  const caret = start + text.length;
  // Fields that report no caret — an <input type="number">, say — throw here.
  try {
    field.setSelectionRange(caret, caret);
  } catch {
    // The value is already in; the caret lands wherever the field puts it.
  }
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function deleteSelection(field: Editable): void {
  try {
    if (document.execCommand("delete")) return;
  } catch {
    // Fall through to the manual splice.
  }
  insertText(field, "");
}

/**
 * Makes Ctrl/Cmd+C, X and V work everywhere in the app.
 *
 * The webview is supposed to handle these itself, and where it does this hook
 * stays out of the way: it watches for the copy, cut and paste events the
 * default action fires and only acts when none arrives. That way a surface
 * with its own paste behaviour — the composer turning a pasted screenshot into
 * an attachment — keeps it, and a surface where the webview refuses the
 * clipboard still copies and pastes through Tauri's clipboard plugin.
 *
 * The terminal is skipped entirely; it owns its keys so Ctrl+C can still
 * interrupt what is running.
 */
export function useClipboardBridge(): void {
  useEffect(() => {
    // Bumped by the webview's own clipboard events. A keystroke that leaves it
    // unchanged did nothing, and is the one we repair.
    let nativeEvents = 0;
    const countNative = () => {
      nativeEvents += 1;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (inTerminal(target)) return;
      const action = clipboardActionFor(event, isMacPlatform());
      if (!action) return;

      const field = editableTarget(target);
      // Nothing to paste into, or nothing to copy from.
      if (action === "paste" && !field) return;
      const selection = action === "paste" ? "" : selectedText(target);
      if (action !== "paste" && !selection) return;
      if (action === "cut" && !field) return;

      const seen = nativeEvents;
      window.setTimeout(() => {
        if (nativeEvents !== seen) return; // the webview handled it
        if (action === "paste") {
          void readClipboardText().then((text) => {
            if (text && field) insertText(field, text);
          });
          return;
        }
        void copyText(selection).then((ok) => {
          if (ok && action === "cut" && field) deleteSelection(field);
        });
      }, NATIVE_GRACE_MS);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("copy", countNative, true);
    document.addEventListener("cut", countNative, true);
    document.addEventListener("paste", countNative, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("copy", countNative, true);
      document.removeEventListener("cut", countNative, true);
      document.removeEventListener("paste", countNative, true);
    };
  }, []);
}
