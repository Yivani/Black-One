import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { ipc, isTauri } from "@/lib/ipc";
import { subscribeTerminalEvents } from "@/lib/terminalChannel";
import { useTerminalStore } from "@/stores/terminalStore";

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

  useEffect(() => {
    if (!containerRef.current || !isTauri) return;
    const container = containerRef.current;

    let disposed = false;
    let unsubscribe: (() => void) | null = null;

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

      terminal.onData((data) => {
        void ipc.writeTerminal(terminalId, data);
      });

      terminal.onBinary((data) => {
        void ipc.writeTerminal(terminalId, data);
      });

      unsubscribe = subscribeTerminalEvents(
        terminalId,
        (event) => {
          try {
            const bytes = base64ToBytes(event.data);
            terminal.write(bytes);
          } catch {
            terminal.write(event.data);
          }
        },
        (_event) => {
          terminal.writeln("\r\n[process exited]");
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

    requestAnimationFrame(() => {
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
  }, [active, terminalId]);

  return (
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
  );
}
