import { useCallback, useEffect, useMemo } from "react";
import type { Attachment, Message } from "@/types/chat";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";

export interface UseChatResult {
  messages: Message[];
  isStreaming: boolean;
  isThinking: boolean;
  contextMessageCount: number | null;
  send: (content: string, attachments?: Attachment[]) => Promise<void>;
  stop: () => void;
  regenerate: () => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  branchFrom: (messageId: string) => Promise<void>;
}

export function useChat(): UseChatResult {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const messagesBySession = useChatStore((s) => s.messagesBySession);
  const streamingSessionId = useChatStore((s) => s.streamingSessionId);
  const isThinking = useChatStore((s) => s.isThinking);
  const contextNotice = useChatStore((s) => s.contextNotice);
  const loadMessages = useChatStore((s) => s.loadMessages);

  const messages = useMemo(
    () =>
      activeSessionId
        ? (messagesBySession[activeSessionId] ?? []).filter(
            (message) => message.role !== "system",
          )
        : [],
    [activeSessionId, messagesBySession],
  );
  const contextMessageCount = useMemo(
    () => (activeSessionId ? (contextNotice[activeSessionId] ?? null) : null),
    [activeSessionId, contextNotice],
  );

  useEffect(() => {
    if (activeSessionId) {
      void loadMessages(activeSessionId);
    }
  }, [activeSessionId, loadMessages]);

  const send = useCallback(
    (content: string, attachments?: Attachment[]) =>
      useChatStore.getState().sendMessage(content, attachments),
    [],
  );
  const stop = useCallback(() => useChatStore.getState().stopStreaming(), []);
  const regenerate = useCallback(() => useChatStore.getState().regenerateLast(), []);
  const editMessage = useCallback(
    (messageId: string, content: string) =>
      useChatStore.getState().editMessage(messageId, content),
    [],
  );
  const branchFrom = useCallback(
    (messageId: string) => useChatStore.getState().branchFromMessage(messageId),
    [],
  );

  return {
    messages,
    isStreaming: streamingSessionId !== null && streamingSessionId === activeSessionId,
    isThinking: isThinking && streamingSessionId === activeSessionId,
    contextMessageCount,
    send,
    stop,
    regenerate,
    editMessage,
    branchFrom,
  };
}
