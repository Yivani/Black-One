import { useEffect, useRef } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { Toaster } from "sonner";
import { Composer } from "@/components/chat/Composer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppBootstrap } from "@/App";
import { useResolvedDark, useTheme } from "@/hooks/useTheme";
import { ipc, isTauri } from "@/lib/ipc";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import type { Attachment, Message } from "@/types/chat";

const EMPTY_MESSAGES: Message[] = [];

export function QuickChat() {
  const ready = useAppBootstrap(false);
  const dark = useResolvedDark();
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const messages = useChatStore((state) =>
    activeSessionId
      ? (state.messagesBySession[activeSessionId] ?? EMPTY_MESSAGES)
      : EMPTY_MESSAGES,
  );
  const expandedRef = useRef(false);
  useTheme();

  useEffect(() => {
    if (!isTauri) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen("quick-chat-opened", () =>
      useUiStore.getState().requestComposerFocus(),
    ).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauri || !ready) return;
    const expanded = messages.length > 0;
    if (expanded === expandedRef.current) return;
    expandedRef.current = expanded;
    void ipc.resizeQuickChat(expanded);
  }, [ready, messages.length]);

  useEffect(() => {
    if (!isTauri) return;
    let popoverExpanded = false;
    const syncSize = () => {
      const next = document.querySelector("[data-radix-popper-content-wrapper]") !== null;
      if (next === popoverExpanded) return;
      popoverExpanded = next;
      void ipc.resizeQuickChat(next || expandedRef.current);
    };
    const observer = new MutationObserver(syncSize);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    const hideOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      void ipc.hideQuickChat();
    };
    window.addEventListener("keydown", hideOnEscape);
    return () => window.removeEventListener("keydown", hideOnEscape);
  }, []);

  const submit = async (content: string, attachments: Attachment[]) => {
    void useChatStore
      .getState()
      .sendMessage(content, attachments, (sessionId) => {
        void emit("quick-chat-message-sent", { sessionId });
      });
  };

  return (
    <main className="flex h-screen w-screen flex-col bg-transparent p-2">
      <div className="flex max-h-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_14px_36px_rgba(0,0,0,0.24)]">
        <div
          data-tauri-drag-region
          aria-hidden
          className="flex h-5 shrink-0 cursor-move items-center justify-center"
        >
          <span className="h-0.5 w-8 rounded-full bg-muted-foreground/35" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {ready ? (
            <Composer variant="quick" onSubmit={submit} />
          ) : (
            <div className="p-2 pt-0">
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          )}
          {messages.length > 0 && (
            <ScrollArea className="flex-1 min-h-0 px-3 py-2">
              <div className="space-y-3">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
      <Toaster position="top-center" theme={dark ? "dark" : "light"} />
    </main>
  );
}
