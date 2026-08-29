import { useState } from "react";
import { Brain, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import { persistence } from "@/lib/persistence";
import { ALL_CATEGORY_IDS, PREDEFINED_CATEGORIES } from "@/lib/memory";
import { useSessionStore } from "@/stores/sessionStore";
import { MemoryViewer } from "./MemoryViewer";

function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function MemorySettings() {
  const { settings, updateSection } = useSettings();
  const loadAll = useSessionStore((s) => s.loadAll);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const clearMemory = async () => {
    setClearing(true);
    try {
      const sessions = await persistence.listSessions(true);
      for (const session of sessions) {
        const messages = await persistence.listMessages(session.id);
        const first = messages[0];
        if (first) await persistence.deleteMessagesFrom(session.id, first.id);
      }
      await loadAll();
      toast.success("Memory cleared");
      setConfirmOpen(false);
    } catch {
      toast.error("Failed to clear memory.");
    } finally {
      setClearing(false);
    }
  };

  const toggleCategory = (categoryId: string, checked: boolean) => {
    const current =
      settings.memory.memoryCategories.length === 0
        ? new Set(ALL_CATEGORY_IDS)
        : new Set(settings.memory.memoryCategories);
    if (checked) {
      current.add(categoryId);
    } else {
      current.delete(categoryId);
    }
    updateSection("memory", { memoryCategories: Array.from(current) });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="context-window-limit">Context window limit</Label>
            <Badge variant="secondary" className="font-mono">
              {settings.memory.contextWindowLimit} messages
            </Badge>
          </div>
          <Slider
            id="context-window-limit"
            aria-label="Context window limit"
            min={10}
            max={200}
            step={10}
            value={[settings.memory.contextWindowLimit]}
            onValueChange={(value) =>
              updateSection("memory", { contextWindowLimit: value[0] })
            }
          />
          <p className="text-xs text-muted-foreground">
            How many recent messages are sent as context with each request.
          </p>
        </div>

        <SwitchRow
          id="memory-persistence"
          label="Enable long-term memory"
          description="Recall stored facts across chats and restarts."
          checked={settings.memory.memoryPersistence}
          onCheckedChange={(memoryPersistence) =>
            updateSection("memory", { memoryPersistence })
          }
        />

        <SwitchRow
          id="auto-extract-memory"
          label="Auto-extract memories"
          description="The AI will record useful facts after each response."
          checked={settings.memory.autoExtractMemory}
          onCheckedChange={(autoExtractMemory) =>
            updateSection("memory", { autoExtractMemory })
          }
        />
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="max-memory-size">Maximum memory size</Label>
            <Badge variant="secondary" className="font-mono">
              {settings.memory.maxMemorySizeKb} KB
            </Badge>
          </div>
          <Slider
            id="max-memory-size"
            aria-label="Maximum memory size"
            min={64}
            max={2048}
            step={64}
            value={[settings.memory.maxMemorySizeKb]}
            onValueChange={(value) =>
              updateSection("memory", { maxMemorySizeKb: value[0] })
            }
          />
          <p className="text-xs text-muted-foreground">
            Older or less important memories are pruned when the bank reaches this size.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label>Memory categories</Label>
            {settings.memory.memoryCategories.length === 0 && (
              <span className="text-xs text-muted-foreground">All enabled</span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PREDEFINED_CATEGORIES.map((category) => {
              const checked =
                settings.memory.memoryCategories.length === 0 ||
                settings.memory.memoryCategories.includes(category.id);
              return (
                <div
                  key={category.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
                >
                  <div className="space-y-0.5">
                    <Label htmlFor={`category-${category.id}`} className="text-sm">
                      {category.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <Switch
                    id={`category-${category.id}`}
                    checked={checked}
                    onCheckedChange={(value) => toggleCategory(category.id, value)}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            If no categories are selected, all categories are used.
          </p>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Memory viewer</p>
            <p className="text-xs text-muted-foreground">
              Inspect, copy, and manage stored memories.
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setViewerOpen(true)}
          >
            <Brain className="mr-1.5 size-3.5" aria-hidden />
            Open memory viewer
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Clear chat history</p>
            <p className="text-xs text-muted-foreground">
              Remove all stored messages from every chat. Sessions are kept.
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            Clear chat history
          </Button>
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clear chat history?</DialogTitle>
            <DialogDescription>
              This removes all messages from all chats. Sessions and long-term memories are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={clearing}
              onClick={() => void clearMemory()}
            >
              {clearing && (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              )}
              Clear chat history
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden p-5">
          <DialogHeader>
            <DialogTitle>Memory viewer</DialogTitle>
            <DialogDescription>
              Stored facts extracted from your conversations.
            </DialogDescription>
          </DialogHeader>
          <MemoryViewer />
        </DialogContent>
      </Dialog>
    </div>
  );
}
