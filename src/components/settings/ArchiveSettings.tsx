import { useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchInput } from "@/components/shared/SearchInput";
import { useSettings } from "@/hooks/useSettings";
import { formatRelativeDate } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import type { ChatSession } from "@/types/session";

export function ArchiveSettings() {
  const { settings, updateSection } = useSettings();
  const archivedSessions = useSessionStore((s) => s.archivedSessions);
  const archiveSession = useSessionStore((s) => s.archiveSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ChatSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? archivedSessions.filter((s) => s.title.toLowerCase().includes(normalized))
    : archivedSessions;

  const restore = async (id: string) => {
    try {
      await archiveSession(id, false);
      toast.success("Chat restored");
    } catch {
      toast.error("Failed to restore the chat.");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSession(pendingDelete.id);
      toast.success("Chat permanently deleted");
      setPendingDelete(null);
    } catch {
      toast.error("Failed to delete the chat.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="auto-archive-days">Auto-archive</Label>
            <p className="text-xs text-muted-foreground">
              Archive chats after this many days of inactivity. 0 means never.
            </p>
          </div>
          <Input
            id="auto-archive-days"
            type="number"
            min={0}
            className="w-20"
            value={settings.archive.autoArchiveDays}
            onChange={(event) => {
              const days = event.target.valueAsNumber;
              if (Number.isFinite(days) && days >= 0) {
                updateSection("archive", { autoArchiveDays: Math.floor(days) });
              }
            }}
          />
        </div>
      </section>
      <Separator />
      <section className="space-y-3">
        <p className="text-sm font-medium leading-none">Archived chats</p>
        {archivedSessions.length === 0 ? (
          <EmptyState icon={Archive} title="No archived chats" />
        ) : (
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search archived chats…"
              aria-label="Search archived chats"
            />
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No archived chats match your search.
              </p>
            ) : (
              <div className="space-y-2">
                {filtered.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{session.title}</p>
                        <Badge variant="secondary" className="shrink-0">
                          Archived
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeDate(session.updatedAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Restore ${session.title}`}
                      onClick={() => void restore(session.id)}
                    >
                      <ArchiveRestore className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${session.title} forever`}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(session)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete chat forever?</DialogTitle>
            <DialogDescription>
              This permanently deletes {pendingDelete?.title ?? "this chat"} and all of its
              messages. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
