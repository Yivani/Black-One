import { useMemo, useState, useSyncExternalStore, type ComponentType } from "react";
import { Activity, AlertTriangle, BarChart3, Bot, Brain, CircleDollarSign, Clock3, MessageSquareText, RefreshCw, Rocket, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModels } from "@/hooks/useModels";
import { useUsageStats, type UsageModeFilter } from "@/hooks/useUsageStats";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { Message } from "@/types/chat";
import { cn, formatContextWindow, formatCurrency, formatTimestamp } from "@/lib/utils";
import { getErrors, subscribeErrors } from "@/lib/errors";
import { ErrorLog } from "./ErrorLog";
import { MemoryViewer } from "@/components/settings/MemoryViewer";
import { Changelog } from "./Changelog";

const EMPTY_MESSAGES: Message[] = [];
const FILTERS: { value: UsageModeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chat", label: "Ask" },
  { value: "code", label: "Code" },
  { value: "agent", label: "Agent" },
];

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-md px-3 text-xs font-medium transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Stat({ label, value, detail, icon: Icon, mono }: {
  label: string;
  value: React.ReactNode;
  detail: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 px-3 py-4 first:pl-0 last:pr-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        <span>{label}</span>
      </div>
      <div className={cn("text-xl font-semibold text-foreground sm:text-2xl", mono && "font-mono tabular-nums")}>
        {value}
      </div>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ModelUsageChart({ rows }: { rows: ReturnType<typeof useUsageStats>["stats"]["byModel"] }) {
  const maxTokens = useMemo(() => Math.max(...rows.map((row) => row.tokens), 1), [rows]);

  return (
    <div className="divide-y divide-border/60">
      {rows.map((row) => (
        <div key={`${row.providerId}::${row.modelId}`} className="py-3 first:pt-0 last:pb-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{row.modelName}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {row.providerName || row.providerId} · {row.messageCount} response{row.messageCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="text-right font-mono text-[11px] tabular-nums">
              <p className="text-foreground">{formatContextWindow(row.tokens)} tokens</p>
              <p className="mt-0.5 text-muted-foreground">{formatCurrency(row.estimatedCost, row.currency)}</p>
            </div>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden bg-muted">
            <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${(row.tokens / maxTokens) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityRow({ message }: { message: Message }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-3 border-b border-border/50 py-3 last:border-b-0">
      <div className="mt-0.5 flex size-6 items-center justify-center text-muted-foreground">
        {isAssistant ? <Bot className="size-3.5" aria-hidden /> : <User className="size-3.5" aria-hidden />}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium capitalize text-foreground">{message.role}</span>
          {message.mode && (
            <Badge variant="outline" className="h-4 px-1 py-0 text-[9px]">
              {message.mode === "chat" ? "Ask" : message.mode}
            </Badge>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
          {message.content.trim().slice(0, 140) || "No text content"}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 font-mono text-[10px] tabular-nums text-muted-foreground">
        <span>{formatTimestamp(message.createdAt)}</span>
        {message.tokensUsed !== undefined && <span>{formatContextWindow(message.tokensUsed)} tok</span>}
      </div>
    </div>
  );
}

export function CommandCenter() {
  const streamingSessionId = useChatStore((state) => state.streamingSessionId);
  const queueLength = useChatStore((state) => state.queue.length);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeMessages = useChatStore((state) =>
    activeSessionId ? (state.messagesBySession[activeSessionId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const { selected } = useModels();
  const errors = useSyncExternalStore(subscribeErrors, getErrors, getErrors);
  const [tab, setTab] = useState<"overview" | "memory" | "updates" | "errors">("overview");
  const [filter, setFilter] = useState<UsageModeFilter>("all");
  const { stats, isLoading, refresh } = useUsageStats(filter);

  const recent = useMemo(
    () => activeMessages
      .filter((message) => filter === "all" || message.mode === filter || (!message.mode && filter === "chat"))
      .slice(-20)
      .reverse(),
    [activeMessages, filter],
  );
  const totalCostCurrency = useMemo(() => {
    const currencies = new Set(stats.byModel.map((model) => model.currency));
    return currencies.size === 1 ? Array.from(currencies)[0] : undefined;
  }, [stats.byModel]);
  const statusLabel = streamingSessionId ? "Running" : queueLength > 0 ? `${queueLength} queued` : "Idle";
  const statusDetail = streamingSessionId
    ? "A response is being generated"
    : queueLength > 0 ? "Requests are waiting to run" : "Ready for your next request";
  const selectedFilterLabel = FILTERS.find((item) => item.value === filter)?.label;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border/70 bg-muted/20 px-5 pr-14 sm:px-6 sm:pr-14">
        <div className="flex min-w-0 items-center gap-3">
          <BarChart3 className="size-4 shrink-0 text-foreground" aria-hidden />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Command Center</h2>
              <Badge variant={streamingSessionId ? "default" : queueLength > 0 ? "secondary" : "outline"} className="text-[10px]">
                {statusLabel}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{statusDetail}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="max-w-48 truncate text-xs font-medium text-foreground">{selected?.model.name ?? "No model selected"}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{selected?.provider.name ?? "Choose a provider"}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Refresh analytics" onClick={refresh} disabled={isLoading} className="size-8 text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </header>

      <nav className="flex h-10 shrink-0 items-end gap-5 border-b border-border/70 px-5 sm:px-6" aria-label="Command Center sections">
        <button type="button" onClick={() => setTab("overview")} className={cn("h-10 border-b-2 px-0.5 text-xs font-medium transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === "overview" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Overview
        </button>
        <button type="button" onClick={() => setTab("memory")} className={cn("flex h-10 items-center gap-1.5 border-b-2 px-0.5 text-xs font-medium transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === "memory" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          <Brain className="size-3.5" aria-hidden />
          Memory
        </button>
        <button type="button" onClick={() => setTab("updates")} className={cn("flex h-10 items-center gap-1.5 border-b-2 px-0.5 text-xs font-medium transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === "updates" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          <Rocket className="size-3.5" aria-hidden />
          Updates
        </button>
        <button type="button" onClick={() => setTab("errors")} className={cn("flex h-10 items-center gap-1.5 border-b-2 px-0.5 text-xs font-medium transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === "errors" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Errors
          {errors.length > 0 && <Badge variant="destructive" className="h-4 min-w-4 rounded-sm px-1 font-mono text-[9px]">{errors.length}</Badge>}
        </button>
      </nav>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "overview" && <ScrollArea className="h-full">
        <div className="p-5 sm:p-6">
          <section aria-label="Usage summary" className="grid grid-cols-2 border-b border-border/70 pb-4 sm:grid-cols-4">
            <Stat icon={Clock3} label="Sessions" detail="Saved conversations" value={isLoading ? "—" : formatContextWindow(stats.sessions)} />
            <Stat icon={MessageSquareText} label="Messages" detail="Across the selected mode" value={isLoading ? "—" : formatContextWindow(stats.messages)} />
            <Stat icon={Activity} label="Tokens" detail="Assistant output tracked" value={isLoading ? "—" : formatContextWindow(stats.tokens)} mono />
            <Stat icon={CircleDollarSign} label="Estimated spend" detail="Based on model pricing" value={isLoading ? "—" : formatCurrency(stats.estimatedCost, totalCostCurrency)} mono />
          </section>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Usage overview</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Saved usage and activity for the current conversation</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1" aria-label="Filter analytics by mode">
              {FILTERS.map((item) => (
                <FilterChip key={item.value} label={item.label} active={filter === item.value} onClick={() => setFilter(item.value)} />
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <section className="min-h-72 border border-border/70 bg-card p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Model usage</h4>
                  <p className="mt-1 text-[10px] text-muted-foreground">Tokens, responses, and estimated cost</p>
                </div>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{stats.byModel.length} model{stats.byModel.length === 1 ? "" : "s"}</span>
              </div>
              {isLoading ? (
                <div className="grid min-h-48 place-items-center text-xs text-muted-foreground">Loading usage…</div>
              ) : stats.byModel.length === 0 ? (
                <div className="grid min-h-48 place-items-center px-6 text-center">
                  <div>
                    <Bot className="mx-auto size-5 text-muted-foreground" aria-hidden />
                    <p className="mt-3 text-sm font-medium text-foreground">No model usage yet</p>
                    <p className="mx-auto mt-1 max-w-64 text-xs leading-5 text-muted-foreground">
                      Send a request in {filter === "all" ? "Ask, Code, or Agent" : selectedFilterLabel} to start tracking tokens and cost.
                    </p>
                  </div>
                </div>
              ) : <ModelUsageChart rows={stats.byModel} />}
            </section>

            <section className="min-h-72 border border-border/70 bg-card p-4 sm:p-5">
              <div className="mb-1 flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Recent activity</h4>
                  <p className="mt-1 text-[10px] text-muted-foreground">Latest messages in this conversation</p>
                </div>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{recent.length} shown</span>
              </div>
              {recent.length === 0 ? (
                <div className="grid min-h-48 place-items-center px-6 text-center">
                  <div>
                    <Activity className="mx-auto size-5 text-muted-foreground" aria-hidden />
                    <p className="mt-3 text-sm font-medium text-foreground">Nothing here yet</p>
                    <p className="mx-auto mt-1 max-w-64 text-xs leading-5 text-muted-foreground">Messages from the active conversation will appear here as you work.</p>
                  </div>
                </div>
              ) : <div>{recent.map((message) => <ActivityRow key={message.id} message={message} />)}</div>}
            </section>
          </div>

          <p className="mt-4 text-[10px] leading-4 text-muted-foreground">Cost figures use built-in model pricing and may differ from your provider invoice.</p>
        </div>
      </ScrollArea>}
        {tab === "memory" && <MemoryViewer />}
        {tab === "updates" && <Changelog />}
        {tab === "errors" && <ErrorLog />}
      </div>
    </div>
  );
}
