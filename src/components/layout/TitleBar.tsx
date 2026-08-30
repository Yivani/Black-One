import { useEffect, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useDroppable } from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  LayoutGrid,
  Minus,
  Moon,
  PanelLeft,
  PanelRight,
  Settings,
  Square,
  Sun,
  Vibrate,
  VibrateOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toggleDarkMode } from "@/hooks/useTheme";
import { isTauri } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { ViewTabs } from "@/components/layout/ViewTabs";
import { Logo } from "@/components/shared/Logo";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  useUiStore,
  type TitleBarItemId,
  type TitleBarZone,
} from "@/stores/uiStore";

type OsPlatform = "macos" | "windows" | "linux" | "web";

function useResolvedDark(): boolean {
  const theme = useSettingsStore((s) => s.settings.appearance.theme);
  const [dark, setDark] = useState(() => {
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(theme === "dark" || (theme === "system" && prefersDark));
  }, [theme]);
  return dark;
}

function useOsPlatform(): OsPlatform {
  const [os, setOs] = useState<OsPlatform>("web");
  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    void import("@tauri-apps/plugin-os").then((mod) => {
      if (cancelled) return;
      const name = mod.platform();
      setOs(name === "macos" ? "macos" : name === "windows" ? "windows" : "linux");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return os;
}

function minimizeWindow(): void {
  void getCurrentWindow().minimize();
}

function toggleMaximizeWindow(): void {
  void getCurrentWindow().toggleMaximize();
}

function closeWindow(): void {
  void getCurrentWindow().close();
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  pressed?: boolean;
  children: ReactNode;
}

function IconButton({ label, onClick, active, pressed, children }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          onDoubleClick={(event) => event.stopPropagation()}
          className={cn("size-8 [-webkit-app-region:no-drag]", active && "bg-accent text-accent-foreground")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SessionTitle() {
  const activeSession = useSessionStore((s) =>
    s.sessions.find((session) => session.id === s.activeSessionId),
  );
  const renameSession = useSessionStore((s) => s.renameSession);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setIsRenaming(false);
  }, [activeSession?.id]);

  const startRename = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!activeSession || activeSession.messageCount === 0) return;
    setDraft(activeSession.title);
    setIsRenaming(true);
  };

  const commitRename = () => {
    setIsRenaming(false);
    if (!activeSession) return;
    const title = draft.trim();
    if (title && title !== activeSession.title) {
      void renameSession(activeSession.id, title);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-2" onDoubleClick={(event) => event.stopPropagation()}>
      <div className="flex shrink-0 items-center gap-2">
        <Logo size={18} className="text-foreground" />
        <span className="text-sm font-medium">Black One</span>
      </div>
      {activeSession && activeSession.messageCount > 0 && (
        <>
          <span className="text-xs text-muted-foreground/60" aria-hidden>
            ·
          </span>
          {isRenaming ? (
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitRename();
                if (event.key === "Escape") setIsRenaming(false);
              }}
              autoFocus
              aria-label="Rename chat"
              className="h-7 w-48 text-sm [-webkit-app-region:no-drag]"
            />
          ) : (
            <div
              className="group flex min-w-0 items-center gap-1.5 [-webkit-app-region:no-drag]"
              onDoubleClick={startRename}
              title={`${activeSession.title} — double-click to rename`}
            >
              <span className="max-w-48 truncate text-sm text-muted-foreground">
                {activeSession.title}
              </span>
            </div>
          )}
          <span className="text-xs text-muted-foreground/60" aria-hidden>
            ·
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {activeSession.messageCount} {activeSession.messageCount === 1 ? "message" : "messages"}
          </span>
        </>
      )}
    </div>
  );
}

function LayoutEditorButton() {
  const setLayoutEditing = useUiStore((s) => s.setLayoutEditing);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit layout"
          className="size-8 [-webkit-app-region:no-drag]"
          onClick={() => setLayoutEditing(true)}
        >
          <LayoutGrid className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Edit layout</TooltipContent>
    </Tooltip>
  );
}

function EditableTitleBarItem({
  id,
  children,
}: {
  id: TitleBarItemId;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `title:${id}` });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/title relative flex h-9 cursor-grab items-center rounded-sm border border-foreground/20 bg-background px-0.5 [-webkit-app-region:no-drag] transition-standard hover:border-foreground/45 active:cursor-grabbing",
        isDragging && "z-[100] opacity-0",
      )}
    >
      <GripVertical
        className="size-3 shrink-0 text-muted-foreground/70 transition-colors group-hover/title:text-foreground"
        aria-hidden
      />
      <div className="pointer-events-none flex min-w-0 items-center">{children}</div>
    </div>
  );
}

function EditableTitleBarZone({
  zone,
  itemIds,
  children,
  className,
}: {
  zone: Exclude<TitleBarZone, "hidden">;
  itemIds: TitleBarItemId[];
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `title-zone:${zone}` });
  return (
    <div
      ref={setNodeRef}
      data-tauri-drag-region
      aria-label={`${zone} title bar section`}
      className={cn(
        "relative z-20 flex h-10 min-w-16 items-center gap-1 rounded-sm border border-border bg-muted/20 px-1 transition-standard",
        isOver && "border-foreground bg-accent",
        className,
      )}
    >
      <SortableContext
        items={itemIds.map((id) => `title:${id}`)}
        strategy={horizontalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </div>
  );
}

function AgentStatusIndicator() {
  const streamingSessionId = useChatStore((s) => s.streamingSessionId);
  const queueLength = useChatStore((s) => s.queue.length);
  const isRunning = streamingSessionId !== null || queueLength > 0;
  if (!isRunning) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      {streamingSessionId ? "Work running" : `${queueLength} queued`}
    </span>
  );
}

function WindowControls() {
  return (
    <div className="ml-1 flex items-center" onDoubleClick={(event) => event.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Minimize window"
        onClick={minimizeWindow}
        onDoubleClick={(event) => event.stopPropagation()}
        className="size-9 rounded-sm [-webkit-app-region:no-drag]"
      >
        <Minus className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Maximize or restore window"
        onClick={toggleMaximizeWindow}
        onDoubleClick={(event) => event.stopPropagation()}
        className="size-9 rounded-sm [-webkit-app-region:no-drag]"
      >
        <Square className="size-3.5" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close window"
        onClick={closeWindow}
        onDoubleClick={(event) => event.stopPropagation()}
        className="size-9 rounded-sm [-webkit-app-region:no-drag] hover:bg-destructive hover:text-destructive-foreground"
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function TitleBar() {
  const os = useOsPlatform();
  const isDark = useResolvedDark();
  const hapticsEnabled = useSettingsStore((s) => s.settings.haptics.enabled);
  const updateHaptics = useSettingsStore((s) => s.updateSection);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const zenMode = useUiStore((s) => s.zenMode);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openSettings = useUiStore((s) => s.openSettings);
  const layoutEditing = useUiStore((s) => s.layoutEditing);
  const titleBarLayout = useUiStore((s) => s.titleBarLayout);

  const showWindowControls = os === "windows" || os === "linux";
  const items: Record<TitleBarItemId, ReactNode> = {
    sidebar: (
      <IconButton
        label={sidebarCollapsed || zenMode ? "Expand sidebar" : "Collapse sidebar"}
        onClick={toggleSidebar}
        active={!sidebarCollapsed && !zenMode}
        pressed={!sidebarCollapsed && !zenMode}
      >
        <PanelLeft className="size-4" aria-hidden />
      </IconButton>
    ),
    identity: (
      <div className="flex min-w-0 items-center gap-3 px-1">
        <SessionTitle />
        <AgentStatusIndicator />
      </div>
    ),
    views: <ViewTabs />,
    layout: <LayoutEditorButton />,
    haptics: (
      <IconButton
        label="Haptics"
        onClick={() => updateHaptics("haptics", { enabled: !hapticsEnabled })}
        pressed={hapticsEnabled}
      >
        {hapticsEnabled ? (
          <Vibrate className="size-4" aria-hidden />
        ) : (
          <VibrateOff className="size-4" aria-hidden />
        )}
      </IconButton>
    ),
    settings: (
      <IconButton label="Settings" onClick={() => openSettings()}>
        <Settings className="size-4" aria-hidden />
      </IconButton>
    ),
    rightPanel: (
      <IconButton
        label="Toggle right sidebar"
        onClick={toggleRightPanel}
        active={rightPanelOpen}
        pressed={rightPanelOpen}
      >
        <PanelRight className="size-4" aria-hidden />
      </IconButton>
    ),
    theme: (
      <IconButton label={isDark ? "Light mode" : "Dark mode"} onClick={toggleDarkMode}>
        {isDark ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )}
      </IconButton>
    ),
  };

  const renderZone = (zone: Exclude<TitleBarZone, "hidden">) => {
    const content = titleBarLayout[zone].map((id) =>
      layoutEditing ? (
        <EditableTitleBarItem key={id} id={id}>
          {items[id]}
        </EditableTitleBarItem>
      ) : (
        <div key={id} className="flex min-w-0 shrink-0 items-center">
          {items[id]}
        </div>
      ),
    );

    if (layoutEditing) {
      return (
        <EditableTitleBarZone
          zone={zone}
          itemIds={titleBarLayout[zone]}
          className={cn(
            zone === "left" && "justify-start",
            zone === "center" && "justify-center",
            zone === "right" && "justify-end",
          )}
        >
          {content}
        </EditableTitleBarZone>
      );
    }

    return (
      <div
        data-tauri-drag-region
        className={cn(
          "relative z-10 flex min-w-0 items-center gap-1",
          zone === "left" && "justify-start",
          zone === "center" && "justify-center",
          zone === "right" && "justify-end",
        )}
      >
        {content}
      </div>
    );
  };

  return (
    <header
      className={cn(
        "relative grid h-header shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-border/50 bg-background px-2",
        layoutEditing &&
          "h-14 border-b-foreground/25 bg-muted/20",
        os === "macos" && "pl-20",
      )}
    >
      {/* Drag region sits behind all interactive title-bar content. */}
      <div data-tauri-drag-region className="absolute inset-0" />
      {layoutEditing && (
        <div
          data-tauri-drag-region
          className="absolute inset-x-0 top-0 z-40 h-1.5 cursor-move"
          title="Drag to move window"
        />
      )}

      {renderZone("left")}
      {renderZone("center")}
      <div className="relative z-30 flex items-center justify-end gap-1">
        {renderZone("right")}
        {showWindowControls && <WindowControls />}
      </div>
    </header>
  );
}
