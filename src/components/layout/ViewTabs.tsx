import { useUiStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { cn } from "@/lib/utils";

const VIEWS = [
  { id: "code" as const, label: "Code" },
  { id: "todo" as const, label: "Todo" },
];

export function ViewTabs() {
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const updateSessionMeta = useSessionStore((s) => s.updateSessionMeta);

  return (
    <div
      role="tablist"
      aria-label="Main view"
      className="flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5 [-webkit-app-region:no-drag]"
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {VIEWS.map((view) => {
        const active = viewMode === view.id;
        return (
          <button
            key={view.id}
            role="tab"
            aria-selected={active}
            onClick={() => {
              setViewMode(view.id);
              if (view.id !== "todo" && activeSessionId) {
                void updateSessionMeta(activeSessionId, { mode: view.id });
              }
            }}
            className={cn(
              "rounded-sm px-3 py-1 text-xs font-medium transition-standard [-webkit-app-region:no-drag]",
              active
                ? "bg-background text-foreground ring-1 ring-inset ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
