import { Channel } from "@tauri-apps/api/core";
import { invokeTauri, isTauri } from "./ipc";
import type { TerminalClosedEvent, TerminalOutputEvent } from "@/lib/ipc";

export type TerminalEvent =
  | { kind: "Output"; payload: TerminalOutputEvent }
  | { kind: "Closed"; payload: TerminalClosedEvent };

type OutputHandler = (event: TerminalOutputEvent) => void;
type ClosedHandler = (event: TerminalClosedEvent) => void;

interface Handlers {
  onOutput: OutputHandler;
  onClosed: ClosedHandler;
}

const handlersById = new Map<string, Set<Handlers>>();
const pendingById = new Map<string, TerminalEvent[]>();
const MAX_PENDING_EVENTS = 64;

let registerPromise: Promise<void> | null = null;

function ensureRegistered(): Promise<void> {
  if (!isTauri) {
    return Promise.reject(new Error("Terminal channel is only available in Tauri."));
  }
  if (registerPromise) return registerPromise;

  registerPromise = (async () => {
    const channel = new Channel<TerminalEvent>();
    channel.onmessage = (event) => {
      const id =
        event.kind === "Output" ? event.payload.id : event.payload.id;
      const handlers = handlersById.get(id);
      if (handlers) {
        for (const handler of handlers) {
          if (event.kind === "Output") {
            handler.onOutput(event.payload);
          } else {
            handler.onClosed(event.payload);
          }
        }
        return;
      }

      // Buffer events that arrive before the terminal component has mounted
      // and subscribed (e.g., the shell's initial prompt).
      let pending = pendingById.get(id);
      if (!pending) {
        pending = [];
        pendingById.set(id, pending);
      }
      pending.push(event);
      if (pending.length > MAX_PENDING_EVENTS) {
        pending.shift();
      }
    };
    await invokeTauri<void>("register_terminal_channel", { channel });
  })();

  return registerPromise;
}

export function subscribeTerminalEvents(
  id: string,
  onOutput: OutputHandler,
  onClosed: ClosedHandler,
): () => void {
  let handlers = handlersById.get(id);
  if (!handlers) {
    handlers = new Set();
    handlersById.set(id, handlers);
  }
  const entry: Handlers = { onOutput, onClosed };
  handlers.add(entry);

  // Flush any events that arrived before subscription.
  const pending = pendingById.get(id);
  if (pending) {
    pendingById.delete(id);
    for (const event of pending) {
      if (event.kind === "Output") {
        onOutput(event.payload);
      } else {
        onClosed(event.payload);
      }
    }
  }

  return () => {
    handlers?.delete(entry);
    if (handlers && handlers.size === 0) {
      handlersById.delete(id);
      pendingById.delete(id);
    }
  };
}

export async function waitForTerminalChannel(): Promise<void> {
  await ensureRegistered();
}
