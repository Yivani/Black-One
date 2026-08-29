import { useMemo } from "react";
import {
  Bot,
  FolderOpen,
  Gauge,
  Hand,
  ShieldAlert,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModels } from "@/hooks/useModels";
import { classifyRisk, parseToolCalls } from "@/lib/tools";
import { cn, formatTimestamp } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useToolRuntimeStore } from "@/stores/toolRuntimeStore";
import { useUiStore } from "@/stores/uiStore";
import { findAgentPreset } from "@/lib/agentPresets";

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function AgentDetail() {
  const selectedId = useUiStore((s) => s.selectedAgentPresetId);
  const preset = findAgentPreset(selectedId);
  const { selected } = useModels();
  const permissionMode = useToolRuntimeStore((s) => s.permissionMode);
  const streamingSessionId = useChatStore((s) => s.streamingSessionId);
  const queueLength = useChatStore((s) => s.queue.length);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const messages = useChatStore((s) =>
    activeSessionId ? (s.messagesBySession[activeSessionId] ?? []) : [],
  );

  const attachedFolder = useMemo(() => {
    return messages
      .flatMap((m) => m.attachments ?? [])
      .find((a) => a.kind === "folder" && a.path)?.path;
  }, [messages]);

  const recentToolCalls = useMemo(() => {
    const attachedFolders = attachedFolder ? [attachedFolder] : [];
    const calls: { name: string; risk: string; when: number }[] = [];
    for (const message of [...messages].reverse()) {
      if (message.role !== "assistant") continue;
      const parsed = parseToolCalls(message.content, message.id);
      for (const call of parsed) {
        calls.push({
          name: call.name,
          risk: classifyRisk(call, attachedFolders),
          when: message.createdAt,
        });
      }
      if (calls.length >= 8) break;
    }
    return calls.slice(0, 8);
  }, [messages, attachedFolder]);

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages],
  );

  const permissionIcon =
    permissionMode === "yolo" ? (
      <ShieldAlert className="size-3 text-destructive" aria-hidden />
    ) : permissionMode === "auto" ? (
      <Sparkles className="size-3 text-primary" aria-hidden />
    ) : (
      <Hand className="size-3 text-muted-foreground" aria-hidden />
    );

  return (
    <ScrollArea className="h-full">
      <div className="py-2">
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-accent">
              {preset ? (
                <preset.icon className="size-4 text-accent-foreground" aria-hidden />
              ) : (
                <Bot className="size-4 text-accent-foreground" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {preset?.name ?? "Agent"}
              </p>
              <p className="line-clamp-2 text-[10px] text-muted-foreground">
                {preset?.description ?? "No preset selected."}
              </p>
            </div>
          </div>
        </div>

        <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Status</p>
        <StatusRow
          label="State"
          value={
            streamingSessionId ? (
              <span className="inline-flex items-center gap-1.5 text-primary">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                Streaming…
              </span>
            ) : queueLength > 0 ? (
              `${queueLength} queued`
            ) : (
              "Idle"
            )
          }
        />
        <StatusRow label="Model" value={selected?.model.name ?? "—"} />
        <StatusRow label="Provider" value={selected?.provider.name ?? "—"} />
        <StatusRow
          label="Permission"
          value={
            <span className="flex items-center gap-1.5 capitalize">
              {permissionIcon}
              {permissionMode}
            </span>
          }
        />
        <StatusRow
          label="Loop cap"
          value={
            <span className="flex items-center gap-1.5">
              <Gauge className="size-3 text-muted-foreground" aria-hidden />
              10 max
            </span>
          }
        />

        {attachedFolder && (
          <>
            <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
              Workspace
            </p>
            <div className="px-3">
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                <FolderOpen className="size-3.5 text-muted-foreground" aria-hidden />
                <span className="truncate">{attachedFolder}</span>
              </div>
            </div>
          </>
        )}

        <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
          Recent tool calls
        </p>
        {recentToolCalls.length === 0 ? (
          <p className="px-3 py-1 text-xs text-muted-foreground">
            No tool calls yet.
          </p>
        ) : (
          <div className="space-y-0.5 px-2">
            {recentToolCalls.map((call, index) => (
              <div
                key={`${call.name}-${index}`}
                className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-muted/40"
              >
                <span className="flex items-center gap-1.5">
                  <Terminal className="size-3 text-muted-foreground" aria-hidden />
                  <span className="font-mono">{call.name}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={call.risk === "high" ? "destructive" : "outline"}
                    className="h-4 px-1 py-0 text-[9px] capitalize"
                  >
                    {call.risk}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimestamp(call.when)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {lastAssistant?.tokensUsed !== undefined && (
          <>
            <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
              Last response
            </p>
            <StatusRow label="Tokens" value={lastAssistant.tokensUsed.toLocaleString()} />
          </>
        )}
      </div>
    </ScrollArea>
  );
}
