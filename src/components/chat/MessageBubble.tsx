import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bot,
  Brain,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Folder,
  GitBranch,
  Image,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { AttachmentKind, Message } from "@/types/chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { StreamingCursor } from "@/components/chat/StreamingCursor";
import { ToolCallCard } from "@/components/chat/ToolCallCard";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { cn, formatTimestamp } from "@/lib/utils";
import {
  parseToolCalls,
  parseToolResults,
  stripToolCalls,
  type ToolCall,
  type ToolContext,
} from "@/lib/tools";

const EMPTY_MESSAGES: Message[] = [];

interface MessageBubbleProps {
  message: Message;
  turnMessages?: Message[];
}

const ATTACHMENT_ICONS: Record<AttachmentKind, LucideIcon> = {
  file: FileText,
  folder: Folder,
  image: Image,
  url: Link2,
};

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function reportError(error: unknown): void {
  toast.error(error instanceof Error ? error.message : String(error));
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
}

function ActionButton({ label, onClick, children }: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface MemoryEventPayload {
  count: number;
  durationMs: number;
  entries: Array<{ category: string; content: string }>;
}

function parseMemoryPayload(content: string): MemoryEventPayload | null {
  try {
    const parsed = JSON.parse(content) as MemoryEventPayload;
    if (typeof parsed.count === "number" && Array.isArray(parsed.entries)) {
      return parsed;
    }
  } catch {
    // Fall through to null.
  }
  return null;
}

interface AgentActivityProps {
  reasoning: string[];
  calls: ToolCall[];
  context: ToolContext;
  sessionId: string;
  running: boolean;
}

function AgentActivity({
  reasoning,
  calls,
  context,
  sessionId,
  running,
}: AgentActivityProps) {
  const pendingCount = calls.filter((call) => call.status === "pending").length;
  const hasPending = pendingCount > 0;
  const [open, setOpen] = useState(running || hasPending);

  useEffect(() => {
    setOpen(running || hasPending);
  }, [running, hasPending]);

  const detail = hasPending
    ? "Approval required"
    : calls.length > 0
      ? `${calls.length} ${calls.length === 1 ? "action" : "actions"}`
      : reasoning.length > 0
        ? "Reasoning"
        : "Working";

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => setOpen(hasPending ? true : next)}
      className={cn(
        "mb-3 overflow-hidden rounded-md border border-border/70 bg-muted/10",
        hasPending && "border-amber-500/40",
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left transition-standard hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={open ? "Hide thinking details" : "Show thinking details"}
        >
          {running ? (
            <Loader2
              className="size-3.5 shrink-0 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : (
            <Brain className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="text-xs font-medium text-foreground">Thinking</span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[11px] text-muted-foreground",
              hasPending && "text-amber-500",
            )}
          >
            {detail}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/60">
          {reasoning.map((entry, index) => (
            <div
              key={`reasoning-${index}`}
              className="border-b border-border/50 px-3 py-2 text-xs text-muted-foreground last:border-b-0"
            >
              <MarkdownRenderer
                content={entry}
                className="text-xs text-muted-foreground [&_.message-body]:text-xs"
              />
            </div>
          ))}
          {calls.length > 0 && (
            <div className="divide-y divide-border/50">
              {calls.map((call) => (
                <ToolCallCard
                  key={call.id}
                  call={call}
                  context={context}
                  sessionId={sessionId}
                  showApprove={call.status === "pending"}
                />
              ))}
            </div>
          )}
          {reasoning.length === 0 && calls.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Preparing the next step...
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  turnMessages,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isMemory = message.role === "memory";
  const showAvatars = useSettingsStore(
    (s) => s.settings.appearance.showAvatars,
  );
  const showTimestamps = useSettingsStore(
    (s) => s.settings.chat.showTimestamps,
  );
  const showReasoningBlocks = useSettingsStore(
    (s) => s.settings.chat.showReasoningBlocks,
  );
  const modelName = useModelStore((s) => {
    if (!message.modelId) return null;
    for (const provider of s.providers) {
      const model = provider.models.find((m) => m.id === message.modelId);
      if (model) return model.name;
    }
    return message.modelId;
  });

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const activityMessages = turnMessages ?? [message];

  const sessionMessages = useChatStore(
    (s) => s.messagesBySession[message.sessionId] ?? EMPTY_MESSAGES,
  );
  const attachedFolders = useMemo(() => {
    const seen = new Set<string>();
    const folders: string[] = [];
    for (const msg of sessionMessages) {
      for (const att of msg.attachments ?? []) {
        if (att.kind === "folder" && att.path && !seen.has(att.path)) {
          seen.add(att.path);
          folders.push(att.path);
        }
      }
    }
    return folders;
  }, [sessionMessages]);
  const toolContext: ToolContext = {
    attachedFolders:
      message.toolWorkspace?.length ? message.toolWorkspace : attachedFolders,
  };
  const toolCalls = useMemo(
    () =>
      activityMessages.flatMap(
        (entry) =>
          entry.toolCalls ?? parseToolCalls(entry.content, entry.id),
      ),
    [activityMessages],
  );
  const reasoningEntries = useMemo(
    () =>
      showReasoningBlocks
        ? activityMessages
            .map((entry) => entry.reasoning?.trim())
            .filter((entry): entry is string => Boolean(entry))
        : [],
    [activityMessages, showReasoningBlocks],
  );
  const visibleToolCalls = useMemo(() => {
    const results = new Map(
      sessionMessages
        .flatMap((entry) =>
          entry.toolResults ??
          (entry.role === "system" ? parseToolResults(entry.content) : []),
        )
        .map((call) => [call.id, call]),
    );
    return toolCalls.map((call) => results.get(call.id) ?? call);
  }, [sessionMessages, toolCalls]);
  const displayContent = useMemo(
    () =>
      toolCalls.some((call) => call.id.startsWith(message.id)) ||
      /<tool(?:\s|>)/i.test(message.content)
        ? ""
        : stripToolCalls(message.content),
    [message.content, message.id, toolCalls],
  );
  const activityRunning =
    message.status === "streaming" ||
    visibleToolCalls.some(
      (call) => call.status === "approved" || call.status === "running",
    );
  const hasActivity =
    activityRunning ||
    reasoningEntries.length > 0 ||
    visibleToolCalls.length > 0;

  if (isMemory) {
    const payload = parseMemoryPayload(message.content);
    if (!payload) return null;
    return (
      <div
        className="flex items-center gap-1.5 py-1 text-[11px] text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Brain className="size-3" aria-hidden />
        <span>Saved to memory</span>
        <span aria-hidden>·</span>
        <span>
          {payload.count} {payload.count === 1 ? "entry" : "entries"}
        </span>
      </div>
    );
  }

  const handleCopy = () => {
    void copyText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRegenerate = () => {
    useChatStore.getState().regenerateLast().catch(reportError);
  };

  const handleBranch = () => {
    useChatStore.getState().branchFromMessage(message.id).catch(reportError);
  };

  const handleSaveEdit = () => {
    const next = draft.trim();
    if (!next) return;
    setEditing(false);
    useChatStore.getState().editMessage(message.id, next).catch(reportError);
  };

  const handleOpenSources = () => {
    const ui = useUiStore.getState();
    ui.openRightPanel("sources");
    ui.setPreviewMessageId(message.id);
  };

  const avatar = showAvatars ? (
    <Avatar className="mt-0.5 size-6 shrink-0">
      <AvatarFallback className="text-[10px]">
        {isUser ? "U" : <Bot className="size-3.5" aria-hidden />}
      </AvatarFallback>
    </Avatar>
  ) : null;

  const hasFooter =
    !isUser &&
    (modelName !== null || showTimestamps || message.tokensUsed !== undefined);

  return (
    <div
      role="article"
      className={cn(
        "group relative flex w-full gap-3",
        isUser && "justify-end",
      )}
    >
      {!isUser && avatar}
      <div
        className={cn(
          "min-w-0",
          isUser ? "max-w-3xl rounded-lg bg-accent px-4 py-2.5" : "flex-1",
        )}
      >
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-20 text-sm"
              aria-label="Edit message"
            />
            <div className="flex justify-end gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!draft.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        ) : isUser ? (
          <>
            <div className="message-body whitespace-pre-wrap text-sm">
              {message.content}
            </div>
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {message.attachments.map((attachment) => {
                  const Icon = ATTACHMENT_ICONS[attachment.kind];
                  return (
                    <span
                      key={attachment.id}
                      className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      <Icon className="size-3" aria-hidden />
                      <span className="max-w-32 truncate">
                        {attachment.name}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {message.status === "error" ? (
              <div className="space-y-3">
                {hasActivity && (
                  <AgentActivity
                    reasoning={reasoningEntries}
                    calls={visibleToolCalls}
                    context={toolContext}
                    sessionId={message.sessionId}
                    running={false}
                  />
                )}
                {displayContent.trim().length > 0 && (
                  <MarkdownRenderer content={displayContent} />
                )}
                <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3.5">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/10">
                    <TriangleAlert
                      className="size-4 text-destructive"
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      Couldn’t generate a response
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {message.errorMessage ??
                        "The provider request failed. Check your connection and provider settings."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    className="shrink-0"
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Retry
                  </Button>
                </div>
              </div>
            ) : message.status === "streaming" ? (
              <div aria-live="polite">
                {hasActivity && (
                  <AgentActivity
                    reasoning={reasoningEntries}
                    calls={visibleToolCalls}
                    context={toolContext}
                    sessionId={message.sessionId}
                    running={activityRunning}
                  />
                )}
                {displayContent.trim().length > 0 && (
                  <>
                    <MarkdownRenderer content={displayContent} />
                    <StreamingCursor />
                  </>
                )}
              </div>
            ) : (
              <>
                {hasActivity && (
                  <AgentActivity
                    reasoning={reasoningEntries}
                    calls={visibleToolCalls}
                    context={toolContext}
                    sessionId={message.sessionId}
                    running={activityRunning}
                  />
                )}
                {displayContent.trim().length > 0 && (
                  <MarkdownRenderer content={displayContent} />
                )}
                {message.status === "stopped" && (
                  <span className="text-xs text-muted-foreground">
                    (stopped)
                  </span>
                )}
              </>
            )}
            {message.citations && message.citations.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {message.citations.map((citation) => (
                  <button
                    key={citation.id}
                    type="button"
                    title={citation.title}
                    aria-label={`View source ${citation.index}: ${citation.title}`}
                    onClick={handleOpenSources}
                    className="rounded-sm border border-border px-1 font-mono text-[10px] text-muted-foreground transition-standard hover:bg-accent"
                  >
                    [{citation.index}]
                  </button>
                ))}
              </div>
            )}
            {hasFooter &&
              message.status !== "streaming" &&
              message.status !== "error" && (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {modelName && <span>{modelName}</span>}
                  {showTimestamps && (
                    <span>{formatTimestamp(message.createdAt)}</span>
                  )}
                  {message.tokensUsed !== undefined && (
                    <span>{message.tokensUsed} tok</span>
                  )}
                </div>
              )}
          </>
        )}
      </div>
      {isUser && avatar}
      {!editing && (
        <div className="absolute -top-3 right-0 flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 opacity-0 shadow-sm transition-standard group-hover:opacity-100">
          <ActionButton label={copied ? "Copied" : "Copy"} onClick={handleCopy}>
            {copied ? (
              <Check className="size-3.5 text-muted-foreground" aria-hidden />
            ) : (
              <Copy className="size-3.5 text-muted-foreground" aria-hidden />
            )}
          </ActionButton>
          {!isUser && (
            <ActionButton label="Regenerate" onClick={handleRegenerate}>
              <RefreshCw
                className="size-3.5 text-muted-foreground"
                aria-hidden
              />
            </ActionButton>
          )}
          {isUser && (
            <ActionButton
              label="Edit"
              onClick={() => {
                setDraft(message.content);
                setEditing(true);
              }}
            >
              <Pencil className="size-3.5 text-muted-foreground" aria-hidden />
            </ActionButton>
          )}
          <ActionButton label="Branch from here" onClick={handleBranch}>
            <GitBranch className="size-3.5 text-muted-foreground" aria-hidden />
          </ActionButton>
        </div>
      )}
    </div>
  );
});
