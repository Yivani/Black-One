import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { ArrowDown } from "lucide-react";
import {
  List,
  useDynamicRowHeight,
  useListRef,
  type RowComponentProps,
} from "react-window";
import type { Message } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { ContextBanner } from "@/components/chat/ContextBanner";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Logo } from "@/components/shared/Logo";
import { useChat } from "@/hooks/useChat";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { MESSAGE_VIRTUALIZATION_THRESHOLD } from "@/lib/constants";

const AT_BOTTOM_THRESHOLD_PX = 80;

interface MessageRowsData {
  messages: Message[];
  showTyping: boolean;
}

function MessageRow({
  index,
  style,
  ariaAttributes,
  messages,
  showTyping,
}: RowComponentProps<MessageRowsData>) {
  const isTypingRow = showTyping && index === messages.length;
  return (
    <div style={style} {...ariaAttributes}>
      <div className="mx-auto w-full max-w-4xl px-6 pb-6">
        {isTypingRow ? (
          <TypingIndicator />
        ) : (
          <MessageBubble message={messages[index]} />
        )}
      </div>
    </div>
  );
}

export function MessageList() {
  const { messages, isThinking, contextMessageCount } = useChat();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const viewMode = useUiStore((s) => s.viewMode);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listRef = useListRef(null);
  const atBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;
  const showTyping =
    isThinking &&
    lastMessage !== null &&
    lastMessage.role === "assistant" &&
    lastMessage.status === "streaming" &&
    lastMessage.content.length === 0;

  const virtualized = messages.length > MESSAGE_VIRTUALIZATION_THRESHOLD;
  const rowCount = messages.length + (showTyping ? 1 : 0);
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 120,
    key: activeSessionId ?? "none",
  });
  const rowProps = useMemo<MessageRowsData>(
    () => ({ messages, showTyping }),
    [messages, showTyping],
  );
  const rowKey = useCallback(
    (index: number, data: MessageRowsData) =>
      index < data.messages.length
        ? data.messages[index].id
        : "typing-indicator",
    [],
  );

  const scrollToBottom = useCallback(() => {
    if (virtualized) {
      if (rowCount > 0) {
        listRef.current?.scrollToRow({
          index: rowCount - 1,
          align: "end",
          behavior: "auto",
        });
      }
      return;
    }
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [virtualized, rowCount, listRef]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < AT_BOTTOM_THRESHOLD_PX;
    atBottomRef.current = atBottom;
    if (atBottom) setShowScrollButton(false);
  };

  // Follow the stream while the user is at the bottom; otherwise surface the
  // floating jump button.
  useEffect(() => {
    if (messages.length === 0) return;
    if (atBottomRef.current) {
      scrollToBottom();
    } else {
      setShowScrollButton(true);
    }
  }, [messages, showTyping, scrollToBottom]);

  // Reset scroll tracking when switching chats.
  useEffect(() => {
    atBottomRef.current = true;
    setShowScrollButton(false);
  }, [activeSessionId]);

  if (messages.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center px-8 pb-[8vh]">
          <Logo size={28} className="mb-7 text-foreground/90" />
          <h1 className="max-w-lg text-3xl font-semibold tracking-[-0.03em] text-foreground">
            {viewMode === "chat"
              ? "What do you want to know?"
              : viewMode === "agent"
                ? "What should Agent finish?"
                : "What should we work on?"}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            {viewMode === "chat"
              ? "Ask for an explanation, analysis, plan, or writing help."
              : viewMode === "agent"
                ? "Attach the project and describe the outcome. Agent will inspect, act, and verify."
                : "Attach the project and describe the change while you work beside the terminal."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {contextMessageCount !== null && (
        <div className="mx-auto w-full max-w-4xl px-6 pt-3">
          <ContextBanner count={String(contextMessageCount)} />
        </div>
      )}
      {virtualized ? (
        <List
          listRef={listRef}
          rowComponent={MessageRow}
          rowCount={rowCount}
          rowHeight={rowHeight}
          rowProps={rowProps}
          rowKey={rowKey}
          overscanCount={8}
          onScroll={handleScroll}
        />
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
        >
          <div className="mx-auto w-full max-w-4xl space-y-7">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {showTyping && <TypingIndicator />}
          </div>
        </div>
      )}
      {showScrollButton && (
        <Button
          variant="outline"
          size="icon"
          aria-label="Scroll to bottom"
          onClick={() => {
            atBottomRef.current = true;
            setShowScrollButton(false);
            scrollToBottom();
          }}
          className="absolute bottom-4 right-4 size-8 rounded-lg bg-background shadow-sm"
        >
          <ArrowDown className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
