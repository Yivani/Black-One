import { useState } from "react";
import {
  Brain,
  BriefcaseBusiness,
  ClipboardCopy,
  FolderKanban,
  Heart,
  MessageSquareText,
  Palette,
  RefreshCw,
  Shapes,
  SlidersHorizontal,
  Target,
  Trash2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemory } from "@/hooks/useMemory";
import { persistence } from "@/lib/persistence";
import {
  ALL_CATEGORY_IDS,
  estimateMemorySize,
  PREDEFINED_CATEGORIES,
  type MemoryEntry,
} from "@/lib/memory";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  personal: UserRound,
  work: BriefcaseBusiness,
  hobbies: Palette,
  projects: FolderKanban,
  preferences: SlidersHorizontal,
  writing_style: MessageSquareText,
  goals: Target,
  relationships: UsersRound,
  other: Shapes,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB"];
  const i = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
  const value = bytes / Math.pow(1000, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function Importance({ value }: { value: MemoryEntry["importance"] }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Importance ${value} of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={`size-1.5 rounded-full ${
            index < value ? "bg-foreground" : "bg-border"
          }`}
        />
      ))}
    </span>
  );
}

export function MemoryViewer() {
  const { bank, loading, error, refresh, deleteAll, deleteOne } = useMemory();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MemoryEntry | null>(null);

  const handleCopyMarkdown = async () => {
    const markdown = await persistence.getSetting("app:memory-md");
    if (!markdown) {
      toast.error("No memory markdown found.");
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Memory markdown copied to clipboard.");
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await deleteAll();
      setSelectedCategory("all");
      toast.success("All memories deleted.");
    } catch {
      toast.error("Failed to delete memories.");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteOne = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteOne(pendingDelete.id);
      toast.success("Memory deleted.");
    } catch {
      toast.error("Failed to delete memory.");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const totalEntries = bank?.entries.length ?? 0;
  const estimatedSize = bank ? estimateMemorySize(bank) : 0;
  const grouped = new Map<string, MemoryEntry[]>();
  for (const entry of bank?.entries ?? []) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }
  const visibleCategories = ALL_CATEGORY_IDS.filter(
    (id) =>
      grouped.has(id) && (selectedCategory === "all" || selectedCategory === id),
  );

  return (
    <div className="grid h-full min-h-0 overflow-hidden rounded-lg border bg-background md:grid-cols-[12rem_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b bg-muted/20 md:border-b-0 md:border-r">
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            <Brain className="size-5" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Memory bank</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {totalEntries} {totalEntries === 1 ? "memory" : "memories"} · {formatBytes(estimatedSize)}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-y-auto" aria-label="Memory categories">
          <button
            type="button"
            aria-pressed={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
            className="flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium md:w-full"
          >
            <Brain className="size-3.5" aria-hidden />
            <span className="flex-1">All memories</span>
            <span className="text-xs tabular-nums text-muted-foreground">{totalEntries}</span>
          </button>
          {PREDEFINED_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category.id] ?? Shapes;
            const count = grouped.get(category.id)?.length ?? 0;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selectedCategory === category.id}
                onClick={() => setSelectedCategory(category.id)}
                className="flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium md:w-full"
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="flex-1">{category.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 border-t p-2">
          <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </Button>
          <Button variant="ghost" size="icon" aria-label="Copy as Markdown" onClick={() => void handleCopyMarkdown()}>
            <ClipboardCopy className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete all memories"
            className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      </aside>

      <ScrollArea className="h-full min-h-0 bg-muted/10">
        <div className="min-h-full p-5 [background-image:radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px] sm:p-7">
          {loading && !bank ? (
            <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
              <div className="text-center">
                <RefreshCw className="mx-auto mb-2 size-5 animate-spin" aria-hidden />
                Loading memory map…
              </div>
            </div>
          ) : error ? (
            <div className="grid min-h-72 place-items-center text-center">
              <div>
                <p className="text-sm font-medium text-destructive">Memory map unavailable</p>
                <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
                  Try again
                </Button>
              </div>
            </div>
          ) : totalEntries === 0 ? (
            <div className="grid min-h-72 place-items-center text-center">
              <div>
                <Heart className="mx-auto size-5 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-sm font-medium">Your memory map is empty</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Stored memory entries will appear here. Copy the Markdown to
                  use them with a terminal CLI.
                </p>
              </div>
            </div>
          ) : visibleCategories.length === 0 ? (
            <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
              No memories in this category yet.
            </div>
          ) : (
            <div className="mx-auto max-w-6xl space-y-5">
              <div className="inline-flex items-center gap-2 rounded-sm border bg-background px-3 py-2">
                <Brain className="size-4" aria-hidden />
                <span className="text-sm font-semibold">You</span>
                <span className="size-1.5 rounded-full bg-foreground" aria-label="Memory bank active" />
              </div>

              <div className="space-y-4 border-l pl-5 sm:pl-7">
                {visibleCategories.map((categoryId) => {
                  const entries = grouped.get(categoryId) ?? [];
                  const category = PREDEFINED_CATEGORIES.find((item) => item.id === categoryId);
                  const Icon = CATEGORY_ICONS[categoryId] ?? Shapes;
                  return (
                    <section key={categoryId} className="relative grid gap-3 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-5">
                      <span className="absolute -left-5 top-5 h-px w-5 bg-border sm:-left-7 sm:w-7" aria-hidden />
                      <div className="self-start rounded-sm border bg-background p-3">
                        <div className="flex items-center gap-2">
                          <Icon className="size-4" aria-hidden />
                          <h3 className="text-sm font-semibold">{category?.label ?? categoryId}</h3>
                        </div>
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                          {entries.length} {entries.length === 1 ? "memory" : "memories"}
                        </p>
                      </div>

                      <ul className="grid gap-2 sm:grid-cols-2">
                        {entries.map((entry) => (
                          <li key={entry.id} className="rounded-sm border bg-background p-3 transition-colors hover:border-foreground/30">
                            <p className="text-sm leading-relaxed">{entry.content}</p>
                            <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                              <time dateTime={new Date(entry.createdAt).toISOString()}>
                                {new Date(entry.createdAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </time>
                              <span className="ml-auto"><Importance value={entry.importance} /></span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-destructive"
                                aria-label="Delete memory"
                                onClick={() => setPendingDelete(entry)}
                              >
                                <Trash2 className="size-3" aria-hidden />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete all memories?</DialogTitle>
            <DialogDescription>
              This permanently removes every stored memory. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteAll()} disabled={deleting}>
              {deleting && <RefreshCw className="mr-1.5 size-3.5 animate-spin" aria-hidden />}
              Delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this memory?"
        description={pendingDelete?.content ?? "This permanently removes the selected memory."}
        confirmLabel="Delete"
        danger
        onConfirm={() => void handleDeleteOne()}
      />
    </div>
  );
}
