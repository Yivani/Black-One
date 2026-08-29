import { useState } from "react";
import { LayoutGrid, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LAYOUT_PRESETS,
  useUiStore,
  type LayoutId,
  type SavedLayout,
} from "@/stores/uiStore";

function LayoutThumbnail({ layout }: { layout: SavedLayout }) {
  const boxes: Record<string, string> = {
    default: "grid-cols-[14px_1fr] grid-rows-1",
    focus: "grid-cols-1 grid-rows-1",
    terminal: "grid-cols-[1fr_14px] grid-rows-[1fr_12px]",
    quad: "grid-cols-[14px_1fr_14px] grid-rows-[1fr_12px]",
  };
  return (
    <div
      className={cn(
        "grid h-16 w-full gap-1 rounded-md border border-border/50 bg-muted/30 p-1",
        boxes[layout.id] ?? boxes.default,
      )}
      aria-hidden
    >
      {layout.id === "default" && (
        <>
          <div className="rounded-sm bg-muted-foreground/20" />
          <div className="rounded-sm bg-muted-foreground/10" />
        </>
      )}
      {layout.id === "focus" && <div className="rounded-sm bg-muted-foreground/10" />}
      {layout.id === "terminal" && (
        <>
          <div className="col-span-1 rounded-sm bg-muted-foreground/10" />
          <div className="row-span-2 rounded-sm bg-muted-foreground/20" />
          <div className="col-span-1 rounded-sm bg-muted-foreground/15" />
        </>
      )}
      {layout.id === "quad" && (
        <>
          <div className="row-span-2 rounded-sm bg-muted-foreground/20" />
          <div className="rounded-sm bg-muted-foreground/10" />
          <div className="rounded-sm bg-muted-foreground/20" />
          <div className="col-span-2 rounded-sm bg-muted-foreground/15" />
        </>
      )}
      {!boxes[layout.id] && (
        <>
          <div className="rounded-sm bg-muted-foreground/20" />
          <div className="rounded-sm bg-muted-foreground/10" />
        </>
      )}
    </div>
  );
}

function LayoutCard({
  layout,
  selected,
  onClick,
}: {
  layout: SavedLayout;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-2 text-left transition-standard hover:bg-accent/50",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-background",
      )}
    >
      <LayoutThumbnail layout={layout} />
      <span className="px-1 text-xs font-medium">{layout.name}</span>
    </button>
  );
}

interface LayoutPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LayoutPicker({ open, onOpenChange }: LayoutPickerProps) {
  const layout = useUiStore((s) => s.layout);
  const savedLayouts = useUiStore((s) => s.savedLayouts);
  const applyLayout = useUiStore((s) => s.applyLayout);
  const saveCurrentLayout = useUiStore((s) => s.saveCurrentLayout);
  const deleteSavedLayout = useUiStore((s) => s.deleteSavedLayout);
  const setLayoutEditing = useUiStore((s) => s.setLayoutEditing);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const allLayouts: SavedLayout[] = [...LAYOUT_PRESETS, ...savedLayouts];
  const active = allLayouts.find((l) => l.id === layout) ?? LAYOUT_PRESETS[0];

  const handleSelect = (id: LayoutId) => {
    applyLayout(id);
    onOpenChange(false);
  };

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    saveCurrentLayout(name);
    setSaveName("");
    setIsSaving(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="size-4" aria-hidden />
            Layouts
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Pick a layout template. Sidebar, right panel, and focus mode update instantly.
        </p>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Templates
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {LAYOUT_PRESETS.map((preset) => (
              <LayoutCard
                key={preset.id}
                layout={preset}
                selected={active?.id === preset.id}
                onClick={() => handleSelect(preset.id)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Custom
          </h3>
          {savedLayouts.length === 0 && !isSaving && (
            <p className="text-xs text-muted-foreground">No custom layouts yet.</p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {savedLayouts.map((saved) => (
              <div key={saved.id} className="relative">
                <LayoutCard
                  layout={saved}
                  selected={active?.id === saved.id}
                  onClick={() => handleSelect(saved.id)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${saved.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteSavedLayout(saved.id);
                  }}
                  className="absolute right-1 top-1 size-6 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
          {isSaving ? (
            <div className="flex items-center gap-2">
              <Input
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="Layout name"
                autoFocus
                className="h-8 text-sm"
              />
              <Button size="sm" disabled={!saveName.trim()} onClick={handleSave}>
                <Save className="mr-1.5 size-3.5" aria-hidden />
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSaving(false);
                  setSaveName("");
                }}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setIsSaving(true)}
            >
              <Plus className="mr-1.5 size-3.5" aria-hidden />
              Save current arrangement
            </Button>
          )}
        </section>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              setLayoutEditing(true);
            }}
          >
            <Pencil className="mr-1.5 size-3.5" aria-hidden />
            Edit layout
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleSelect("default")}>
            Reset
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
