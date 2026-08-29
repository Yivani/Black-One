import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  AppWindow,
  Check,
  EyeOff,
  LayoutGrid,
  MessageSquare,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Settings,
  Sun,
  Vibrate,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TITLE_BAR_LAYOUT,
  useUiStore,
  type TitleBarItemId,
  type TitleBarLayout,
  type TitleBarZone,
} from "@/stores/uiStore";

type PanelZone = "left" | "right" | "hidden";

const TITLE_ITEMS: Record<TitleBarItemId, { label: string; icon: LucideIcon }> = {
  sidebar: { label: "Sidebar control", icon: PanelLeft },
  identity: { label: "App title", icon: AppWindow },
  views: { label: "View switcher", icon: MessageSquare },
  layout: { label: "Layout control", icon: LayoutGrid },
  haptics: { label: "Haptics", icon: Vibrate },
  settings: { label: "Settings", icon: Settings },
  rightPanel: { label: "Right panel control", icon: PanelRight },
  theme: { label: "Theme", icon: Sun },
};

const TITLE_ITEM_IDS = Object.keys(TITLE_ITEMS) as TitleBarItemId[];

function cloneTitleBarLayout(layout: TitleBarLayout): TitleBarLayout {
  return {
    left: [...layout.left],
    center: [...layout.center],
    right: [...layout.right],
    hidden: [...layout.hidden],
  };
}

function titleZoneFor(layout: TitleBarLayout, item: TitleBarItemId): TitleBarZone {
  return (Object.keys(layout) as TitleBarZone[]).find((zone) =>
    layout[zone].includes(item),
  ) ?? "hidden";
}

function PanelPlacement({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  value: PanelZone;
  onChange: (zone: PanelZone) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {label}
      </div>
      <div className="grid grid-cols-3 rounded-md border border-border p-0.5">
        {(["left", "hidden", "right"] as const).map((zone) => (
          <button
            key={zone}
            type="button"
            aria-pressed={value === zone}
            onClick={() => onChange(zone)}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground transition-standard hover:bg-accent hover:text-accent-foreground focus-visible:z-10",
              value === zone && "bg-foreground text-background hover:bg-foreground hover:text-background",
            )}
          >
            {zone === "hidden" && <EyeOff className="size-3.5" aria-hidden />}
            {zone[0].toUpperCase() + zone.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LayoutEditor({ children }: { children: ReactNode }) {
  const zenMode = useUiStore((s) => s.zenMode);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const sidebarPosition = useUiStore((s) => s.sidebarPosition);
  const rightPanelPosition = useUiStore((s) => s.rightPanelPosition);
  const titleBarLayout = useUiStore((s) => s.titleBarLayout);
  const [dragging, setDragging] = useState<string | null>(null);
  const original = useRef({
    layout: useUiStore.getState().layout,
    zenMode,
    rightPanelOpen,
    sidebarPosition,
    rightPanelPosition,
    titleBarLayout: cloneTitleBarLayout(titleBarLayout),
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDragging(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) return;
    const active = String(event.active.id);
    const over = String(event.over.id);
    if (!active.startsWith("title:")) return;

    const store = useUiStore.getState();
    const item = active.slice(6) as TitleBarItemId;
    const currentZone = titleZoneFor(store.titleBarLayout, item);
    const before = over.startsWith("title:")
      ? (over.slice(6) as TitleBarItemId)
      : undefined;
    const targetZone = over.startsWith("title-zone:")
      ? (over.slice(11) as TitleBarZone)
      : before
        ? titleZoneFor(store.titleBarLayout, before)
        : undefined;

    if (targetZone && targetZone !== "hidden" && targetZone !== currentZone) {
      store.moveTitleBarItem(item, targetZone);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    if (!event.over) return;

    const active = String(event.active.id);
    const over = String(event.over.id);
    if (!active.startsWith("title:")) return;

    const store = useUiStore.getState();
    const item = active.slice(6) as TitleBarItemId;
    if (over.startsWith("title-zone:")) {
      store.moveTitleBarItem(item, over.slice(11) as TitleBarZone);
      return;
    }
    if (!over.startsWith("title:")) return;

    const before = over.slice(6) as TitleBarItemId;
    const zone = titleZoneFor(store.titleBarLayout, before);
    const currentZone = titleZoneFor(store.titleBarLayout, item);
    if (before === item) return;
    if (zone !== currentZone) {
      store.moveTitleBarItem(item, zone, before);
      return;
    }

    const items = store.titleBarLayout[zone];
    const from = items.indexOf(item);
    const to = items.indexOf(before);
    if (from !== to) {
      const next = cloneTitleBarLayout(store.titleBarLayout);
      next[zone] = arrayMove(items, from, to);
      store.setTitleBarLayout(next);
    }
  };

  const handleCancel = () => {
    const store = useUiStore.getState();
    const initial = original.current;
    store.applyLayout(initial.layout);
    store.setZenMode(initial.zenMode);
    store.setRightPanelOpen(initial.rightPanelOpen);
    store.setSidebarPosition(initial.sidebarPosition);
    store.setRightPanelPosition(initial.rightPanelPosition);
    store.setTitleBarLayout(initial.titleBarLayout);
    store.setLayoutEditing(false);
  };

  const handleReset = () => {
    const store = useUiStore.getState();
    store.applyLayout("default");
    store.setTitleBarLayout(DEFAULT_TITLE_BAR_LAYOUT);
  };

  const isDirty =
    zenMode !== original.current.zenMode ||
    rightPanelOpen !== original.current.rightPanelOpen ||
    sidebarPosition !== original.current.sidebarPosition ||
    rightPanelPosition !== original.current.rightPanelPosition ||
    JSON.stringify(titleBarLayout) !== JSON.stringify(original.current.titleBarLayout);

  const handleSave = () => {
    if (isDirty) useUiStore.getState().saveCurrentLayout("Custom layout");
    useUiStore.getState().setLayoutEditing(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !dragging) handleCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const setSidebarZone = (zone: PanelZone) => {
    const store = useUiStore.getState();
    store.setZenMode(zone === "hidden");
    if (zone !== "hidden") store.setSidebarPosition(zone);
  };

  const setRightPanelZone = (zone: PanelZone) => {
    const store = useUiStore.getState();
    store.setRightPanelOpen(zone !== "hidden");
    if (zone !== "hidden") store.setRightPanelPosition(zone);
  };

  const dragLabel = dragging?.startsWith("title:")
    ? TITLE_ITEMS[dragging.slice(6) as TitleBarItemId]?.label
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      {children}

      <aside
        aria-label="Edit app layout"
        className="fixed bottom-3 right-3 top-[68px] z-50 flex w-[min(340px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border border-foreground/20 bg-background shadow-[0_16px_40px_hsl(var(--foreground)/0.14)] max-sm:left-3 max-sm:w-auto"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Edit layout</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Changes appear in the app immediately.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel layout editing"
            onClick={handleCancel}
            className="-mr-1 -mt-1 size-8"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="space-y-4 px-4 py-4" aria-labelledby="panel-placement-heading">
            <div>
              <h3 id="panel-placement-heading" className="text-sm font-semibold">
                Workspace panels
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Place each panel on an edge or hide it.
              </p>
            </div>
            <PanelPlacement
              label="Chat sidebar"
              icon={PanelLeft}
              value={zenMode ? "hidden" : sidebarPosition}
              onChange={setSidebarZone}
            />
            <PanelPlacement
              label="Context panel"
              icon={PanelRight}
              value={rightPanelOpen ? rightPanelPosition : "hidden"}
              onChange={setRightPanelZone}
            />
          </section>

          <section className="border-t border-border px-4 py-4" aria-labelledby="titlebar-heading">
            <div>
              <h3 id="titlebar-heading" className="text-sm font-semibold">
                Title bar controls
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Choose a section here. Drag controls above to reorder them.
              </p>
            </div>
            <div className="mt-3 divide-y divide-border">
              {TITLE_ITEM_IDS.map((id) => {
                const { label, icon: Icon } = TITLE_ITEMS[id];
                return (
                  <label key={id} className="grid grid-cols-[minmax(0,1fr)_104px] items-center gap-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-xs font-medium">
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{label}</span>
                    </span>
                    <select
                      value={titleZoneFor(titleBarLayout, id)}
                      onChange={(event) =>
                        useUiStore.getState().moveTitleBarItem(id, event.target.value as TitleBarZone)
                      }
                      aria-label={`${label} position`}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none transition-standard hover:border-foreground/40 focus-visible:border-ring"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <div className="border-t border-border bg-muted/20 px-3 py-3">
          <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground" aria-live="polite">
            <span className={cn("size-1.5 rounded-full", isDirty ? "bg-foreground" : "bg-muted-foreground/50")} />
            {isDirty ? "Unsaved changes" : "No changes yet"}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="size-3.5" aria-hidden />
              Reset
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Check className="size-3.5" aria-hidden />
                {isDirty ? "Save layout" : "Done"}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <DragOverlay zIndex={200} dropAnimation={null}>
        {dragLabel ? (
          <div className="rounded-md border border-foreground/30 bg-background px-3 py-2 text-xs font-medium shadow-lg">
            {dragLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
