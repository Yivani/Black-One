import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Check,
  ClipboardCopy,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/useTranslation";
import { persistence } from "@/lib/persistence";
import { copyText } from "@/lib/clipboard";
import {
  estimateMemorySize,
  PREDEFINED_CATEGORIES,
  type MemoryEntry,
} from "@/lib/memory";
import { cn } from "@/lib/utils";
import { SAVE_HIGHLIGHT_MS, useMemoryStore } from "@/stores/memoryStore";

type SourceFilter = "all" | "terminal" | "chat" | "manual";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB"];
  const index = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
  const value = bytes / Math.pow(1000, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function Importance({ value }: { value: MemoryEntry["importance"] }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Importance ${value} of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={cn(
            "size-1 rounded-full",
            index < value ? "bg-foreground/70" : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

/** One memory, readable at a glance and editable in place. */
function MemoryRow({
  entry,
  fresh,
}: {
  entry: MemoryEntry;
  /** Highlighted because it was written moments ago. */
  fresh: boolean;
}) {
  const { t } = useTranslation();
  const edit = useMemoryStore((s) => s.edit);
  const remove = useMemoryStore((s) => s.remove);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.content);

  const category = PREDEFINED_CATEGORIES.find((item) => item.id === entry.category);
  const fromTerminal = entry.source === "terminal";

  const commit = async () => {
    const text = draft.trim();
    if (!text || text === entry.content) {
      setEditing(false);
      return;
    }
    await edit(entry.id, { content: text });
    setEditing(false);
    toast.success(t("memory.updated"));
  };

  return (
    <div
      className={cn(
        "group rounded-lg border p-3 transition-standard",
        fresh
          ? "border-primary/60 bg-primary/5"
          : "border-border/70 bg-card hover:border-border",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] font-normal">
          {fromTerminal ? (
            <Terminal className="size-2.5" aria-hidden />
          ) : (
            <Brain className="size-2.5" aria-hidden />
          )}
          {category?.label ?? entry.category}
        </Badge>
        {entry.pinned && (
          <Badge className="h-5 gap-1 px-1.5 text-[10px] font-normal">
            <Pin className="size-2.5" aria-hidden />
            {t("memory.pinned")}
          </Badge>
        )}
        {(entry.hits ?? 1) > 1 && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {t("memory.confirmations", { count: entry.hits ?? 1 })}
          </span>
        )}
        <span className="flex-1" />
        <Importance value={entry.importance} />
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            autoFocus
            rows={3}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(false);
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                void commit();
              }
            }}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">{t("memory.editHint")}</p>
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7" onClick={() => void commit()}>
              <Check className="mr-1 size-3" aria-hidden />
              {t("common.save")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                setDraft(entry.content);
                setEditing(false);
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t("common.edit")}
            className="min-w-0 flex-1 text-left text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {entry.content}
          </button>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={entry.pinned ? t("memory.unpin") : t("memory.pin")}
                  onClick={() => void edit(entry.id, { pinned: !entry.pinned })}
                  className="size-6 text-muted-foreground hover:text-foreground"
                >
                  {entry.pinned ? (
                    <PinOff className="size-3.5" aria-hidden />
                  ) : (
                    <Pin className="size-3.5" aria-hidden />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {entry.pinned ? t("memory.unpin") : t("memory.pin")}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("memory.deleteOne")}
                  onClick={() => void remove(entry.id)}
                  className="size-6 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("memory.deleteOne")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}

export function MemoryViewer() {
  const { t } = useTranslation();
  const entries = useMemoryStore((s) => s.entries);
  const loading = useMemoryStore((s) => s.loading);
  const error = useMemoryStore((s) => s.error);
  const load = useMemoryStore((s) => s.load);
  const clear = useMemoryStore((s) => s.clear);
  const add = useMemoryStore((s) => s.add);
  const recentSaves = useMemoryStore((s) => s.recentSaves);
  const acknowledgeSaves = useMemoryStore((s) => s.acknowledgeSaves);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  // Opening the bank is the user seeing the new facts, so stop flagging them.
  useEffect(() => () => acknowledgeSaves(), [acknowledgeSaves]);

  const freshIds = useMemo(() => {
    const cutoff = Date.now() - SAVE_HIGHLIGHT_MS;
    return new Set(
      recentSaves
        .filter((event) => (event.entry.lastSeenAt ?? 0) >= cutoff)
        .map((event) => event.entry.id),
    );
  }, [recentSaves]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries
      .filter((entry) => source === "all" || (entry.source ?? "chat") === source)
      .filter(
        (entry) => !needle || entry.content.toLowerCase().includes(needle),
      )
      .sort(
        (a, b) =>
          Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
          (b.lastSeenAt ?? b.createdAt) - (a.lastSeenAt ?? a.createdAt),
      );
  }, [entries, query, source]);

  const learnedCount = entries.filter((entry) => entry.source === "terminal").length;

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text) return;
    await add({ content: text, category: "conventions" });
    setDraft("");
    setAdding(false);
    toast.success(t("memory.saved"));
  };

  const handleCopyMarkdown = async () => {
    const markdown = await persistence.getSetting("app:memory-md");
    if (!markdown) {
      toast.error(t("memory.empty"));
      return;
    }
    if (await copyText(markdown)) toast.success(t("memory.copyMarkdown"));
    else toast.error(t("common.copyFailed"));
  };

  const filters: Array<{ id: SourceFilter; label: string }> = [
    { id: "all", label: t("memory.filterAll") },
    { id: "terminal", label: t("memory.sourceTerminal") },
    { id: "chat", label: t("memory.sourceChat") },
    { id: "manual", label: t("memory.sourceManual") },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("memory.search")}
            aria-label={t("memory.search")}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSource(filter.id)}
              className={cn(
                "h-6 rounded-md px-2 text-[11px] font-medium transition-standard",
                source === filter.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.refresh")}
          onClick={() => void load()}
          className="size-8 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
        </Button>
      </div>

      {adding ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Textarea
            value={draft}
            autoFocus
            rows={2}
            placeholder={t("memory.addPlaceholder")}
            onChange={(event) => setDraft(event.target.value)}
            className="text-sm"
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7" onClick={() => void handleAdd()}>
              {t("common.save")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                setDraft("");
                setAdding(false);
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-8 self-start text-xs"
          onClick={() => setAdding(true)}
        >
          <Plus className="mr-1 size-3.5" aria-hidden />
          {t("memory.addManual")}
        </Button>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {error ? (
          <p className="p-4 text-sm text-destructive">{error}</p>
        ) : entries.length === 0 ? (
          <div className="grid min-h-48 place-items-center px-6 text-center">
            <div>
              <Brain className="mx-auto size-5 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">{t("memory.empty")}</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                {t("memory.emptyHint")}
              </p>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("memory.noMatches")}</p>
        ) : (
          <div className="space-y-2 pr-3">
            {visible.map((entry) => (
              <MemoryRow key={entry.id} entry={entry} fresh={freshIds.has(entry.id)} />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p
          className="text-[11px] text-muted-foreground"
          title={`${entries.length} total · ${learnedCount} learned from the terminal`}
        >
          {entries.length} · {learnedCount}{" "}
          <Terminal className="inline size-3 align-[-1px]" aria-hidden /> ·{" "}
          {formatBytes(estimateMemorySize({ entries }))}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => void handleCopyMarkdown()}
          >
            <ClipboardCopy className="mr-1 size-3.5" aria-hidden />
            {t("memory.copyMarkdown")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={entries.length === 0}
            onClick={() => setConfirmClear(true)}
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="mr-1 size-3.5" aria-hidden />
            {t("memory.deleteAll")}
          </Button>
        </div>
      </div>

      <p className="text-[11px] leading-5 text-muted-foreground">{t("memory.autoNote")}</p>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t("memory.deleteAll")}
        description={t("memory.autoNote")}
        confirmLabel={t("memory.deleteAll")}
        onConfirm={() => void clear()}
      />
    </div>
  );
}
