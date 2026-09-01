import { useMemo, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  CircleDollarSign,
  Clock3,
  FolderGit2,
  ListTodo,
  MessageSquareText,
  RefreshCw,
  Rocket,
  TerminalSquare,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModels } from "@/hooks/useModels";
import { useTranslation } from "@/hooks/useTranslation";
import { useUsageStats, type UsageModeFilter } from "@/hooks/useUsageStats";
import { useWorkspaceStatuses } from "@/hooks/useWorkspace";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Message } from "@/types/chat";
import { cn, formatContextWindow, formatCurrency, formatTimestamp } from "@/lib/utils";
import { getErrors, subscribeErrors } from "@/lib/errors";
import { barHeight, peakActivity } from "@/lib/usageCore";
import {
  terminalsForWorkspace,
  type WorkspaceActivity,
} from "@/lib/workspaceCore";
import type { TranslationKey } from "@/locales";
import { ErrorLog } from "./ErrorLog";
import { MemoryViewer } from "@/components/settings/MemoryViewer";
import { Changelog } from "./Changelog";

const EMPTY_MESSAGES: Message[] = [];

const FILTERS: { value: UsageModeFilter; labelKey: TranslationKey }[] = [
  { value: "all", labelKey: "cc.filterAll" },
  { value: "chat", labelKey: "cc.filterAsk" },
  { value: "code", labelKey: "cc.filterCode" },
  { value: "agent", labelKey: "cc.filterAgent" },
];

/** Same palette the tray badge and the sidebar dots use. */
const ACTIVITY_TONE: Record<WorkspaceActivity, string> = {
  waiting: "bg-amber-500",
  running: "bg-blue-500",
  error: "bg-red-500",
  done: "bg-emerald-500",
  idle: "bg-muted-foreground/40",
};

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-md px-3 text-xs font-medium transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  detail,
  icon: Icon,
  mono,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-card p-4">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "truncate text-xl font-semibold text-foreground sm:text-2xl",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </div>
      <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">{detail}</p>
    </div>
  );
}

/** Shared frame so every panel on the tab has one header shape. */
function Panel({
  title,
  detail,
  aside,
  children,
  className,
}: {
  title: string;
  detail: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border/70 bg-card p-4 sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-foreground">{title}</h4>
          <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
        </div>
        {aside && (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
            {aside}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  hint: string;
}) {
  return (
    <div className="grid min-h-40 place-items-center px-6 text-center">
      <div>
        <Icon className="mx-auto size-5 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto mt-1 max-w-64 text-xs leading-5 text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/**
 * Seven-day message volume.
 *
 * Deliberately a bare bar row rather than a charting library: the only question
 * it answers is "when was I busy", and a dependency for that is not worth it.
 */
function ActivityChart({ daily, locale }: { daily: ReturnType<typeof useUsageStats>["stats"]["daily"]; locale: string }) {
  const peak = peakActivity(daily);
  const weekday = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short" }),
    [locale],
  );

  return (
    <div className="flex h-28 items-end gap-1.5">
      {daily.map((bucket) => (
        <div key={bucket.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex h-full w-full items-end justify-center">
            {/* A quiet day keeps a 3px baseline so seven zeroes read as "no
                activity" rather than as a chart that failed to render. */}
            <div
              className={cn(
                "min-h-[3px] w-full rounded-sm transition-all duration-500 ease-out",
                bucket.total > 0 ? "bg-primary" : "bg-muted",
              )}
              style={{ height: `${barHeight(bucket.total, peak)}%` }}
              title={`${bucket.key}: ${bucket.total}`}
            />
          </div>
          <span className="truncate text-[9px] tabular-nums text-muted-foreground">
            {weekday.format(new Date(bucket.day))}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Live workspace roll-up.
 *
 * The Overview used to describe only the active conversation, which hid the
 * whole point of workspaces: knowing what the *other* boards are doing without
 * switching to them.
 */
function WorkspacePanel() {
  const { t } = useTranslation();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const terminals = useTerminalStore((s) => s.terminals);
  const statuses = useWorkspaceStatuses();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  if (workspaces.length === 0) {
    return (
      <EmptyState
        icon={FolderGit2}
        title={t("cc.noWorkspaces")}
        hint={t("cc.workspacesDetail")}
      />
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {workspaces.map((workspace) => {
        const status = statuses[workspace.id];
        const activity = status?.activity ?? "idle";
        const shells = terminalsForWorkspace(terminals, workspace.id).length;
        return (
          <div
            key={workspace.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn("size-2 shrink-0 rounded-full", ACTIVITY_TONE[activity])}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {workspace.name}
                  {workspace.id === activeWorkspaceId && (
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                      ●
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {t(`status.${activity}`)}
                  {status && status.total > 0 && (
                    <> · {t("status.doneOf", { done: status.done, total: status.total })}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 font-mono text-[10px] tabular-nums text-muted-foreground">
              <span className="flex items-center gap-1" title={t("cc.terminalsOpen", { count: shells })}>
                <TerminalSquare className="size-3" aria-hidden />
                {shells}
              </span>
              <span className="flex items-center gap-1" title={t("cc.tasksOpen", { count: status?.open ?? 0 })}>
                <ListTodo className="size-3" aria-hidden />
                {status?.open ?? 0}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModelUsageChart({
  rows,
}: {
  rows: ReturnType<typeof useUsageStats>["stats"]["byModel"];
}) {
  const maxTokens = useMemo(() => Math.max(...rows.map((row) => row.tokens), 1), [rows]);

  return (
    <div className="divide-y divide-border/60">
      {rows.map((row) => (
        <div key={`${row.providerId}::${row.modelId}`} className="py-3 first:pt-0 last:pb-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{row.modelName}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {row.providerName || row.providerId} · {row.messageCount} response
                {row.messageCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="text-right font-mono text-[11px] tabular-nums">
              <p className="text-foreground">{formatContextWindow(row.tokens)} tokens</p>
              <p className="mt-0.5 text-muted-foreground">
                {formatCurrency(row.estimatedCost, row.currency)}
              </p>
            </div>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${(row.tokens / maxTokens) * 100}%` }}
            />
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
        {isAssistant ? (
          <Bot className="size-3.5" aria-hidden />
        ) : (
          <User className="size-3.5" aria-hidden />
        )}
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
        {message.tokensUsed !== undefined && (
          <span>{formatContextWindow(message.tokensUsed)} tok</span>
        )}
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: LucideTab;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 items-center gap-1.5 border-b-2 px-0.5 text-xs font-medium transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

type LucideTab = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export function CommandCenter() {
  const { t, locale } = useTranslation();
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
    () =>
      activeMessages
        .filter(
          (message) =>
            filter === "all" ||
            message.mode === filter ||
            (!message.mode && filter === "chat"),
        )
        .slice(-20)
        .reverse(),
    [activeMessages, filter],
  );
  const totalCostCurrency = useMemo(() => {
    const currencies = new Set(stats.byModel.map((model) => model.currency));
    return currencies.size === 1 ? Array.from(currencies)[0] : undefined;
  }, [stats.byModel]);

  const statusLabel = streamingSessionId
    ? t("status.running")
    : queueLength > 0
      ? t("status.queuedCount", { count: queueLength })
      : t("status.idle");
  const statusDetail = streamingSessionId
    ? t("cc.statusRunning")
    : queueLength > 0
      ? t("cc.statusQueued")
      : t("cc.statusIdle");
  const selectedFilterLabel = t(
    FILTERS.find((item) => item.value === filter)?.labelKey ?? "cc.filterAll",
  );

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border/70 bg-muted/20 px-5 pr-14 sm:px-6 sm:pr-14">
        <div className="flex min-w-0 items-center gap-3">
          <BarChart3 className="size-4 shrink-0 text-foreground" aria-hidden />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{t("cc.title")}</h2>
              <Badge
                variant={
                  streamingSessionId ? "default" : queueLength > 0 ? "secondary" : "outline"
                }
                className="text-[10px]"
              >
                {statusLabel}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{statusDetail}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="max-w-48 truncate text-xs font-medium text-foreground">
              {selected?.model.name ?? t("cc.noModel")}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {selected?.provider.name ?? t("cc.chooseProvider")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("cc.refresh")}
            onClick={refresh}
            disabled={isLoading}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </header>

      <nav
        className="flex h-10 shrink-0 items-end gap-5 border-b border-border/70 px-5 sm:px-6"
        aria-label={t("cc.title")}
      >
        <Tab active={tab === "overview"} onClick={() => setTab("overview")}>
          {t("cc.overview")}
        </Tab>
        <Tab active={tab === "memory"} onClick={() => setTab("memory")} icon={Brain}>
          {t("cc.memory")}
        </Tab>
        <Tab active={tab === "updates"} onClick={() => setTab("updates")} icon={Rocket}>
          {t("cc.updates")}
        </Tab>
        <Tab active={tab === "errors"} onClick={() => setTab("errors")}>
          {t("cc.errors")}
          {errors.length > 0 && (
            <Badge
              variant="destructive"
              className="h-4 min-w-4 rounded-sm px-1 font-mono text-[9px]"
            >
              {errors.length}
            </Badge>
          )}
        </Tab>
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "overview" && (
          <ScrollArea className="h-full">
            <div className="space-y-5 p-5 sm:p-6">
              <section
                aria-label={t("cc.overview")}
                className="grid grid-cols-2 gap-3 lg:grid-cols-4"
              >
                <Stat
                  icon={Clock3}
                  label={t("cc.sessions")}
                  detail={t("cc.sessionsDetail")}
                  value={isLoading ? "—" : formatContextWindow(stats.sessions)}
                />
                <Stat
                  icon={MessageSquareText}
                  label={t("cc.messages")}
                  detail={t("cc.messagesDetail")}
                  value={isLoading ? "—" : formatContextWindow(stats.messages)}
                />
                <Stat
                  icon={Activity}
                  label={t("cc.tokens")}
                  detail={t("cc.tokensDetail")}
                  value={isLoading ? "—" : formatContextWindow(stats.tokens)}
                  mono
                />
                <Stat
                  icon={CircleDollarSign}
                  label={t("cc.spend")}
                  detail={t("cc.spendDetail")}
                  value={
                    isLoading ? "—" : formatCurrency(stats.estimatedCost, totalCostCurrency)
                  }
                  mono
                />
              </section>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <div
                  className="flex items-center gap-1 rounded-lg bg-muted/60 p-1"
                  aria-label={t("cc.overview")}
                >
                  {FILTERS.map((item) => (
                    <FilterChip
                      key={item.value}
                      label={t(item.labelKey)}
                      active={filter === item.value}
                      onClick={() => setFilter(item.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Panel
                  title={t("cc.workspaces")}
                  detail={t("cc.workspacesDetail")}
                  aside={<WorkspaceCount />}
                >
                  <WorkspacePanel />
                </Panel>

                <Panel
                  title={t("cc.activity7d")}
                  detail={t("cc.activity7dDetail")}
                  aside={`${stats.daily.reduce((sum, bucket) => sum + bucket.total, 0)}`}
                >
                  <ActivityChart daily={stats.daily} locale={locale} />
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
                <Panel
                  title={t("cc.modelUsage")}
                  detail={t("cc.modelUsageDetail")}
                  aside={t("cc.modelCount", { count: stats.byModel.length })}
                  className="min-h-72"
                >
                  {isLoading ? (
                    <div className="grid min-h-40 place-items-center text-xs text-muted-foreground">
                      {t("common.loading")}
                    </div>
                  ) : stats.byModel.length === 0 ? (
                    <EmptyState
                      icon={Bot}
                      title={t("cc.noModelUsage")}
                      hint={t("cc.noModelUsageHint", {
                        mode:
                          filter === "all"
                            ? `${t("cc.filterAsk")}, ${t("cc.filterCode")}, ${t("cc.filterAgent")}`
                            : selectedFilterLabel,
                      })}
                    />
                  ) : (
                    <ModelUsageChart rows={stats.byModel} />
                  )}
                </Panel>

                <Panel
                  title={t("cc.recentActivity")}
                  detail={t("cc.recentActivityDetail")}
                  aside={t("cc.shown", { count: recent.length })}
                  className="min-h-72"
                >
                  {recent.length === 0 ? (
                    <EmptyState
                      icon={Activity}
                      title={t("cc.nothingYet")}
                      hint={t("cc.nothingYetHint")}
                    />
                  ) : (
                    <div>
                      {recent.map((message) => (
                        <ActivityRow key={message.id} message={message} />
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              <p className="text-[10px] leading-4 text-muted-foreground">
                {t("cc.pricingNote")}
              </p>
            </div>
          </ScrollArea>
        )}
        {tab === "memory" && <MemoryViewer />}
        {tab === "updates" && <Changelog />}
        {tab === "errors" && <ErrorLog />}
      </div>
    </div>
  );
}

function WorkspaceCount() {
  const count = useWorkspaceStore((s) => s.workspaces.length);
  return <>{count}</>;
}
