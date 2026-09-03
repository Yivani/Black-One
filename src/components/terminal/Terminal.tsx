import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Copy, ClipboardPaste } from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import {
  copyText,
  isMacPlatform,
  readClipboardText,
} from "@/lib/clipboard";
import { clipboardActionFor } from "@/lib/clipboardKeys";
import { ipc, isTauri } from "@/lib/ipc";
import { subscribeTerminalEvents } from "@/lib/terminalChannel";
import { reportAppError } from "@/lib/errors";
import { forgetTerminalInput, recordTerminalInput } from "@/lib/memory";
import { useTerminalStore } from "@/stores/terminalStore";
import { ContextMenu, type ContextMenuEntry } from "@/components/shared/ContextMenu";

interface TerminalProps {
  terminalId: string;
  active: boolean;
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function waitForSize(element: HTMLElement): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      resolve({ width: rect.width, height: rect.height });
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          observer.disconnect();
          resolve({ width, height });
          return;
        }
      }
    });
    observer.observe(element);

    // Fallback: proceed after a short delay even if no size was reported.
    setTimeout(() => {
      observer.disconnect();
      const rect = element.getBoundingClientRect();
      resolve({ width: Math.max(rect.width, 1), height: Math.max(rect.height, 1) });
    }, 300);
  });
}

export function Terminal({ terminalId, active }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);

  /**
   * Sends input only while the shell is still alive.
   *
   * A keystroke can land after the tab was closed or the shell exited, and the
   * backend rightly reports that as "not found: terminal <id>". Nothing can act
   * on it, so it must not reach the error log.
   */
  const sendInput = (data: string) => {
    if (!useTerminalStore.getState().isTerminalLive(terminalId)) return;
    void ipc.writeTerminal(terminalId, data);
    // Watch for "remember that …" typed at a CLI agent running in this pane.
    // Fire-and-forget: memory must never delay a keystroke reaching the shell.
    void recordTerminalInput(terminalId, data).catch((error) => {
      // Typing must never break, but a silent catch made a broken recorder
      // undiagnosable — report it so it shows up in Command Center → Errors.
      reportAppError(error, {
        category: "storage",
        source: "Terminal memory",
      });
    });
  };

  useEffect(() => {
    if (!containerRef.current || !isTauri) return;
    const container = containerRef.current;

    let disposed = false;
    let unsubscribe: (() => void) | null = null;
    let handleKeyDown: ((event: KeyboardEvent) => void) | undefined;

    void (async () => {
      // Wait until the container has a real size before opening xterm.js.
      // Opening at 0x0 causes the terminal to compute 0 columns/rows and the
      // shell may never render a prompt.
      await waitForSize(container);
      if (disposed) return;

      const terminal = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "JetBrains Mono, monospace",
        theme: {
          background: "#0a0a0a",
          foreground: "#e5e5e5",
          cursor: "#e5e5e5",
          selectionBackground: "#262626",
          black: "#0a0a0a",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#e5e5e5",
          brightBlack: "#404040",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#facc15",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#ffffff",
        },
        convertEol: true,
        screenReaderMode: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(container);

      // xterm.js relies on the browser paste event, which the webview does not
      // deliver here, so the shortcuts are read directly and routed through the
      // clipboard helper.
      handleKeyDown = async (event: KeyboardEvent) => {
        const action = clipboardActionFor(event, isMacPlatform());
        // Cut has no meaning at a prompt: Ctrl+X belongs to the shell.
        if (action !== "copy" && action !== "paste") return;

        if (action === "paste") {
          event.preventDefault();
          event.stopPropagation();
          const text = await readClipboardText();
          if (text) terminal.paste(text);
          return;
        }

        // Ctrl+C with nothing selected is an interrupt, not a copy. Leaving it
        // alone is what lets xterm send the signal through to the shell.
        const selection = terminal.getSelection();
        if (!selection) return;
        event.preventDefault();
        event.stopPropagation();
        await copyText(selection);
        // Dropping the selection means the next Ctrl+C interrupts again,
        // rather than copying the same text for as long as it is highlighted.
        terminal.clearSelection();
      };
      container.addEventListener("keydown", handleKeyDown, true);

      terminal.onData(sendInput);
      terminal.onBinary(sendInput);

      unsubscribe = subscribeTerminalEvents(
        terminalId,
        (event) => {
          try {
            const bytes = base64ToBytes(event.data);
            // Only auto-scroll if the user is already at the bottom; otherwise
            // preserve their scrollback position.
            const wasAtBottom =
              terminal.buffer.active.viewportY === terminal.buffer.active.baseY;
            terminal.write(bytes);
            if (wasAtBottom) {
              terminal.scrollToBottom();
            }
          } catch {
            terminal.write(event.data);
          }
        },
        (_event) => {
          terminal.writeln("\r\n[process exited]");
          forgetTerminalInput(terminalId);
        },
      );

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      const resizeObserver = new ResizeObserver(() => {
        if (!active || !terminalRef.current || !fitAddonRef.current) return;
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = terminalRef.current;
          if (cols > 0 && rows > 0) {
            void ipc.resizeTerminal(terminalId, cols, rows);
          }
        } catch (error) {
          // Fit can fail when the container is hidden or collapsed.
          console.debug("terminal fit failed", error);
        }
      });
      resizeObserver.observe(container);
      resizeObserverRef.current = resizeObserver;

      // Initial fit and focus.
      try {
        fitAddon.fit();
        const { cols, rows } = terminal;
        if (cols > 0 && rows > 0) {
          void ipc.resizeTerminal(terminalId, cols, rows);
        }
      } catch (error) {
        console.debug("initial terminal fit failed", error);
      }

      if (active) {
        terminal.focus();
      }
    })();

    return () => {
      disposed = true;
      if (handleKeyDown) container.removeEventListener("keydown", handleKeyDown, true);
      resizeObserverRef.current?.disconnect();
      unsubscribe?.();
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      resizeObserverRef.current = null;
    };
  }, [terminalId]);

  // Re-fit and focus when this tab becomes active so the terminal uses the real size.
  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;

    const frame = requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        const { cols, rows } = terminal;
        if (cols > 0 && rows > 0) {
          void ipc.resizeTerminal(terminalId, cols, rows);
        }
      } catch (error) {
        console.debug("active terminal fit failed", error);
      }
      if (active) {
        terminal.focus();
      }
    });
    // Without this the frame still runs after an unmount, fitting a disposed
    // terminal and resizing a session the backend may already have dropped.
    return () => cancelAnimationFrame(frame);
  }, [active, terminalId]);

  const pasteFromClipboard = async () => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const text = await readClipboardText();
    if (text) terminal.paste(text);
  };

  const copyToClipboard = async () => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const selection = terminal.getSelection();
    if (!selection) return;
    await copyText(selection);
    terminal.clearSelection();
  };

  const contextMenuItems: ContextMenuEntry[] = [
    {
      label: "Copy",
      icon: Copy,
      shortcut: isMacPlatform() ? "⌘C" : "Ctrl+C",
      onSelect: () => void copyToClipboard(),
    },
    {
      label: "Paste",
      icon: ClipboardPaste,
      shortcut: isMacPlatform() ? "⌘V" : "Ctrl+V",
      onSelect: () => void pasteFromClipboard(),
    },
  ];

  return (
    <ContextMenu items={contextMenuItems}>
      <div
        ref={containerRef}
        tabIndex={0}
        role="application"
        aria-label="Terminal"
        className="h-full w-full outline-none"
        onClick={() => {
          setActiveTerminal(terminalId);
          terminalRef.current?.focus();
        }}
        onFocus={() => {
          setActiveTerminal(terminalId);
          terminalRef.current?.focus();
        }}
      />
    </ContextMenu>
  );
}
