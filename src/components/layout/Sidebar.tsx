import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Folder,
  GitBranch,
  ListOrdered,
  Loader2,
  MessageSquare,
  MoreVertical,
  PauseCircle,
  Pencil,
  Pin,
  PinOff,
  Plus,
  SearchX,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import { CommandCenterButton } from "@/components/analytics/CommandCenterButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  ContextMenu,
  type ContextMenuEntry,
} from "@/components/shared/ContextMenu";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchInput } from "@/components/shared/SearchInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { isTauri } from "@/lib/ipc";
import { SESSION_TITLE_MAX_LENGTH } from "@/lib/constants";
import { cn, compactTitle, groupSessionsByDate } from "@/lib/utils";
import { generateSessionTitle, type OutgoingMessage } from "@/lib/api";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useUiStore } from "@/stores/uiStore";
import type { ChatFolder, ChatSession, DateGroup } from "@/types/session";

const CHATS_ROOT_ID = "chats-root";

const FOLDER_COLORS = [
  { name: "Slate", value: "#64748b" },
  { name: "Moss", value: "#2e7d4f" },
  { name: "Ochre", value: "#b45309" },
  { name: "Iris", value: "#6d5bd0" },
] as const;

interface TipButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

function TipButton({ label, onClick, children, className }: TipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          className={cn("size-8", className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

async function exportAndSave(
  session: ChatSession,
  format: "json" | "markdown",
): Promise<void> {
  const content = await useSessionStore
    .getState()
    .exportSession(session.id, format);
  if (!content) return;
  const extension = format === "json" ? "json" : "md";
  const filename = `${session.title.replace(/[\\/:*?"<>|]/g, "_")}.${extension}`;
  if (isTauri) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await save({
      defaultPath: filename,
      filters: [
        {
          name: format === "json" ? "JSON" : "Markdown",
          extensions: [extension],
        },
      ],
    });
    if (path) await writeTextFile(path, content);
  } else {
    const blob = new Blob([content], {
      type: format === "json" ? "application/json" : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

function openInNewWindow(): void {
  if (isTauri) {
    void import("@tauri-apps/api/webviewWindow")
      .then(({ WebviewWindow }) => {
        const label = `black-one-${Date.now()}`;
        new WebviewWindow(label, {
          url: window.location.href,
          title: "Black One",
          width: 1200,
          height: 800,
        });
      })
      .catch(() => toast.error("Could not open a new window."));
    return;
  }
  window.open(window.location.href, "_blank", "noopener");
}

interface SessionRowProps {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  onStartRename: () => void;
  onCommitRename: (title: string) => void;
  onCancelRename: () => void;
  onRequestDelete: () => void;
}

function SessionRow({
  session,
  isActive,
  isEditing,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onRequestDelete,
}: SessionRowProps) {
  const selectSession = useSessionStore((s) => s.selectSession);
  const togglePin = useSessionStore((s) => s.togglePin);
  const isRunning = useChatStore((s) => s.streamingSessionId === session.id);
  const isQueued = useChatStore((s) =>
    s.queue.some((q) => q.sessionId === session.id),
  );
  const messages = useChatStore((s) => s.messagesBySession[session.id]);
  const duplicateSession = useSessionStore((s) => s.duplicateSession);
  const archiveSession = useSessionStore((s) => s.archiveSession);
  const moveToFolder = useSessionStore((s) => s.moveToFolder);
  const markUnread = useSessionStore((s) => s.markUnread);
  const folders = useSessionStore((s) => s.folders);
  const branchFromMessage = useChatStore((s) => s.branchFromMessage);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const createTerminal = useTerminalStore((s) => s.createTerminal);
  const [draft, setDraft] = useState(session.title);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `session:${session.id}`,
    });

  useEffect(() => {
    if (isActive && session.unread) {
      void markUnread(session.id, false);
    }
  }, [isActive, session.id, session.unread, markUnread]);

  const moveItems: ContextMenuEntry[] = folders
    .filter((folder) => folder.id !== session.folderId)
    .map((folder) => ({
      label: `Move to “${folder.name}”`,
      onSelect: () => void moveToFolder(session.id, folder.id),
    }));

  if (session.folderId) {
    moveItems.push({
      label: "Remove from folder",
      onSelect: () => void moveToFolder(session.id, null),
      separatorAfter: true,
    });
  } else if (moveItems.length > 0) {
    moveItems[moveItems.length - 1].separatorAfter = true;
  }

  const handleGenerateTitle = async () => {
    const selected = useModelStore.getState().getSelectedModel();
    if (!selected || selected.provider.type === "demo") {
      toast.error("Connect a real provider to generate titles with AI.");
      return;
    }
    const apiKey = await useModelStore
      .getState()
      .getApiKey(selected.provider.id);
    if (!apiKey) {
      toast.error("No API key found for the selected provider.");
      return;
    }

    let sessionMessages = messages;
    if (!sessionMessages) {
      await useChatStore.getState().loadMessages(session.id);
      sessionMessages = useChatStore.getState().messagesBySession[session.id];
    }

    const outgoing: OutgoingMessage[] = (sessionMessages ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    if (outgoing.length === 0) {
      toast.error("No messages to base a title on.");
      return;
    }

    const customHeaders =
      useSettingsStore.getState().settings.advanced.customHeaders;
    const title = await generateSessionTitle(
      outgoing,
      selected.provider,
      selected.model,
      apiKey,
      customHeaders,
    );

    if (title) {
      await useSessionStore.getState().renameSession(session.id, title);
      toast.success("Title updated", { description: title });
    } else {
      toast.error("Could not generate a title.");
    }
  };

  const menuItems: ContextMenuEntry[] = [
    { label: "Rename", icon: Pencil, onSelect: onStartRename },
    {
      label: "Generate title with AI",
      icon: Sparkles,
      onSelect: () => void handleGenerateTitle(),
      separatorAfter: true,
    },
    {
      label: "Duplicate",
      icon: Copy,
      onSelect: () => void duplicateSession(session.id),
    },
    {
      label: "Archive",
      icon: Archive,
      onSelect: () => void archiveSession(session.id, true),
      separatorAfter: true,
    },
    ...moveItems,
    {
      label: "Export JSON",
      icon: Download,
      onSelect: () => void exportAndSave(session, "json"),
    },
    {
      label: "Export Markdown",
      icon: Download,
      onSelect: () => void exportAndSave(session, "markdown"),
      separatorAfter: true,
    },
    {
      label: "Delete",
      icon: Trash2,
      danger: true,
      onSelect: onRequestDelete,
    },
  ];

  const startRename = () => {
    setDraft(session.title);
    onStartRename();
  };

  const lastUserMessage = useMemo(
    () => messages?.slice().reverse().find((m) => m.role === "user"),
    [messages],
  );

  const status = useMemo<
    "running" | "queued" | "error" | "approval" | "idle" | null
  >(() => {
    if (isRunning) return "running";
    if (isQueued) return "queued";
    const lastAssistant = messages
      ? [...messages].reverse().find((m) => m.role === "assistant")
      : undefined;
    if (lastAssistant?.status === "error") return "error";
    if (lastAssistant?.status === "stopped") return "approval";
    if (lastAssistant?.status === "complete") return "idle";
    return null;
  }, [isRunning, isQueued, messages]);

  const statusConfig: Record<
    Exclude<typeof status, null>,
    { icon: React.ElementType; label: string; className: string }
  > = {
    running: {
      icon: Loader2,
      label: "Agent running",
      className: "text-primary animate-spin",
    },
    queued: {
      icon: ListOrdered,
      label: "Queued",
      className: "text-muted-foreground",
    },
    error: { icon: AlertCircle, label: "Error", className: "text-destructive" },
    approval: {
      icon: PauseCircle,
      label: "Needs approval",
      className: "text-amber-500",
    },
    idle: {
      icon: CheckCircle2,
      label: "Finished",
      className: "text-muted-foreground/70",
    },
  };

  const StatusIcon = status ? statusConfig[status].icon : null;
  const statusClassName = status ? statusConfig[status].className : "";
  const statusLabel = status ? statusConfig[status].label : "";

  return (
    <ContextMenu items={menuItems}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={{ transform: CSS.Translate.toString(transform) }}
        role="button"
        tabIndex={0}
        onClick={() => selectSession(session.id)}
        onDoubleClick={startRename}
        onKeyDown={(event) => {
          if (event.key === "Enter") selectSession(session.id);
        }}
        className={cn(
          "group flex w-full cursor-default items-center gap-1.5 rounded-md px-2 py-1.5 text-left",
          isActive
            ? "bg-accent text-accent-foreground ring-1 ring-inset ring-primary/30"
            : "ring-1 ring-inset ring-transparent",
          isDragging && "opacity-50",
        )}
      >
        {isEditing ? (
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => onCommitRename(draft)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") onCommitRename(draft);
              if (event.key === "Escape") onCancelRename();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            autoFocus
            maxLength={SESSION_TITLE_MAX_LENGTH}
            aria-label="Rename chat"
            className="h-6 flex-1 px-1 text-sm"
          />
        ) : (
          <>
            {StatusIcon && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex shrink-0 items-center">
                    <StatusIcon
                      className={cn("size-3.5", statusClassName)}
                      aria-hidden
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{statusLabel}</TooltipContent>
              </Tooltip>
            )}
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                session.unread && "font-semibold",
              )}
              title={session.title}
            >
              {compactTitle(session.title)}
            </span>
            {session.unread && (
              <span
                className="mr-1 size-2 rounded-full bg-primary"
                aria-label="Unread"
              />
            )}
          </>
        )}
        <span className="flex shrink-0 items-center gap-0.5">
          {session.pinned && (
            <Pin className="size-3 text-muted-foreground" aria-label="Pinned" />
          )}
          {!isEditing && (
            <span className="relative flex h-5 items-center">
              {session.messageCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] transition-opacity group-hover:opacity-0"
                >
                  {session.messageCount}
                </Badge>
              )}
              <span className="pointer-events-none absolute right-0 flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Chat actions"
                      onClick={(event) => event.stopPropagation()}
                      className="flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    >
                      <MoreVertical className="size-3.5" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => openInNewWindow()}>
                      <ExternalLink className="size-4" aria-hidden />
                      Open in new window
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setViewMode("code");
                        void createTerminal();
                      }}
                    >
                      <Terminal className="size-4" aria-hidden />
                      Open in terminal
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={startRename}>
                      <Pencil className="size-4" aria-hidden />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void togglePin(session.id)}>
                      {session.pinned ? (
                        <>
                          <PinOff className="size-4" aria-hidden />
                          Unpin
                        </>
                      ) : (
                        <>
                          <Pin className="size-4" aria-hidden />
                          Pin
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void markUnread(session.id, !session.unread)}
                    >
                      <MessageSquare className="size-4" aria-hidden />
                      {session.unread ? "Mark as read" : "Mark as unread"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        navigator.clipboard
                          .writeText(session.id)
                          .then(() => toast.success("Chat ID copied."))
                          .catch(() => toast.error("Copy failed."))
                      }
                    >
                      <Copy className="size-4" aria-hidden />
                      Copy ID
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!lastUserMessage}
                      onClick={() => {
                        if (lastUserMessage) void branchFromMessage(lastUserMessage.id);
                      }}
                    >
                      <GitBranch className="size-4" aria-hidden />
                      Branch
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Download className="size-4" aria-hidden />
                        Export
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem
                          onClick={() => void exportAndSave(session, "json")}
                        >
                          Export JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void exportAndSave(session, "markdown")}
                        >
                          Export Markdown
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {folders.length > 0 && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Folder className="size-4" aria-hidden />
                          Move to
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {folders
                            .filter((folder) => folder.id !== session.folderId)
                            .map((folder) => (
                              <DropdownMenuItem
                                key={folder.id}
                                onClick={() =>
                                  void moveToFolder(session.id, folder.id)
                                }
                              >
                                {folder.name}
                              </DropdownMenuItem>
                            ))}
                          {session.folderId && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => void moveToFolder(session.id, null)}
                              >
                                Remove from folder
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void archiveSession(session.id, true)}
                    >
                      <Archive className="size-4" aria-hidden />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={onRequestDelete}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </span>
          )}
        </span>
      </div>
    </ContextMenu>
  );
}

type RowPropsFactory = (session: ChatSession) => SessionRowProps;

interface PendingDelete {
  type: "session" | "folder";
  id: string;
  name: string;
}

interface FolderItemProps {
  folder: ChatFolder;
  sessions: ChatSession[];
  rowProps: RowPropsFactory;
  onRequestDelete: () => void;
}

function FolderItem({
  folder,
  sessions,
  rowProps,
  onRequestDelete,
}: FolderItemProps) {
  const renameFolder = useSessionStore((s) => s.renameFolder);
  const setFolderColor = useSessionStore((s) => s.setFolderColor);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const { setNodeRef, isOver } = useDroppable({ id: `folder:${folder.id}` });

  const commitRename = () => {
    setIsRenaming(false);
    const name = draft.trim();
    if (name && name !== folder.name) void renameFolder(folder.id, name);
  };

  const menuItems: ContextMenuEntry[] = [
    {
      label: "Rename",
      icon: Pencil,
      onSelect: () => {
        setDraft(folder.name);
        setIsRenaming(true);
      },
    },
    ...FOLDER_COLORS.map((color) => ({
      label: color.name,
      swatch: {
        color: color.value,
        selected: folder.color === color.value,
      },
      onSelect: () => void setFolderColor(folder.id, color.value),
    })),
    {
      label: "Clear color",
      disabled: !folder.color,
      onSelect: () => void setFolderColor(folder.id, undefined),
      separatorAfter: true,
    },
    {
      label: "Delete",
      icon: Trash2,
      danger: true,
      onSelect: onRequestDelete,
    },
  ];

  return (
    <Collapsible defaultOpen>
      <ContextMenu items={menuItems}>
        <div
          ref={setNodeRef}
          className={cn("rounded-md transition-colors", isOver && "bg-accent")}
        >
          {isRenaming ? (
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <Folder
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitRename();
                  if (event.key === "Escape") setIsRenaming(false);
                }}
                autoFocus
                aria-label="Rename folder"
                className="h-6 flex-1 px-1 text-sm"
              />
            </div>
          ) : (
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left"
              >
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground transition-standard group-data-[state=open]:rotate-90"
                  aria-hidden
                />
                <Folder
                  className={cn(
                    "size-3.5 shrink-0",
                    !folder.color && "text-muted-foreground",
                  )}
                  style={folder.color ? { color: folder.color } : undefined}
                  aria-hidden
                />
                <span className="flex-1 truncate text-sm">{folder.name}</span>
                <span className="text-xs text-muted-foreground">
                  {sessions.length}
                </span>
              </button>
            </CollapsibleTrigger>
          )}
        </div>
      </ContextMenu>
      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 pl-3">
          {sessions.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground/70">
              Drop chats here
            </p>
          )}
          {sessions.map((session) => (
            <SessionRow key={session.id} {...rowProps(session)} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface WorkspaceSectionProps {
  rowProps: RowPropsFactory;
  onRequestDeleteFolder: (folder: ChatFolder) => void;
}

function WorkspaceSection({
  rowProps,
  onRequestDeleteFolder,
}: WorkspaceSectionProps) {
  const folders = useSessionStore((s) => s.folders);
  const sessions = useSessionStore((s) => s.sessions);
  const createFolder = useSessionStore((s) => s.createFolder);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState("");

  const commitCreate = () => {
    setIsCreating(false);
    const name = draft.trim();
    setDraft("");
    if (name) void createFolder(name);
  };

  return (
    <Collapsible defaultOpen className="px-2 pt-2">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="group flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-muted-foreground">
          <ChevronRight
            className="size-3 transition-standard group-data-[state=open]:rotate-90"
            aria-hidden
          />
          Workspace
        </CollapsibleTrigger>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="New folder"
              onClick={() => {
                setDraft("");
                setIsCreating(true);
              }}
              className="flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent>New folder</TooltipContent>
        </Tooltip>
      </div>
      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 pt-0.5">
          {folders.length === 0 && !isCreating && (
            <p className="px-2 py-1 text-xs text-muted-foreground/70">
              Organize chats into folders
            </p>
          )}
          {isCreating && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <Folder
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitCreate}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitCreate();
                  if (event.key === "Escape") {
                    setDraft("");
                    setIsCreating(false);
                  }
                }}
                autoFocus
                placeholder="Folder name"
                aria-label="Folder name"
                className="h-6 flex-1 px-1 text-sm"
              />
            </div>
          )}
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              sessions={sessions.filter((s) => s.folderId === folder.id)}
              rowProps={rowProps}
              onRequestDelete={() => onRequestDeleteFolder(folder)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChatsSection({
  groups,
  rowProps,
}: {
  groups: Array<[DateGroup, ChatSession[]]>;
  rowProps: RowPropsFactory;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: CHATS_ROOT_ID });

  return (
    <div className="px-2 pt-2">
      <p className="px-2 text-xs font-medium text-muted-foreground">Chats</p>
      <div
        ref={setNodeRef}
        className={cn(
          "mt-1 flex min-h-8 flex-col gap-0.5 rounded-md transition-colors",
          isOver && "bg-accent",
        )}
      >
        {groups.map(([group, sessions]) => (
          <div key={group}>
            <p className="px-2 pb-0.5 pt-1.5 text-xs text-muted-foreground">
              {group}
            </p>
            <div className="flex flex-col gap-0.5">
              {sessions.map((session) => (
                <SessionRow key={session.id} {...rowProps(session)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollapsedRail() {
  const createSession = useSessionStore((s) => s.createSession);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <div className="flex h-full flex-col items-center gap-1 py-2">
      <TipButton label="New chat" onClick={() => void createSession()}>
        <Plus className="size-4" aria-hidden />
      </TipButton>
      <TipButton label="Expand sidebar" onClick={toggleSidebar}>
        <MessageSquare className="size-4" aria-hidden />
      </TipButton>
      <div className="flex-1" />
      <CommandCenterButton collapsed />
    </div>
  );
}

function ExpandedSidebar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const createSession = useSessionStore((s) => s.createSession);
  const renameSession = useSessionStore((s) => s.renameSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const deleteFolder = useSessionStore((s) => s.deleteFolder);
  const folders = useSessionStore((s) => s.folders);
  const sidebarSearch = useUiStore((s) => s.sidebarSearch);
  const setSidebarSearch = useUiStore((s) => s.setSidebarSearch);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );

  const query = sidebarSearch.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query
        ? sessions.filter((s) => s.title.toLowerCase().includes(query))
        : sessions,
    [sessions, query],
  );
  const pinned = useMemo(() => sessions.filter((s) => s.pinned), [sessions]);
  const groups = useMemo(
    () => groupSessionsByDate(sessions.filter((s) => !s.folderId)),
    [sessions],
  );

  const rowProps: RowPropsFactory = (session) => ({
    session,
    isActive: session.id === activeSessionId,
    isEditing: editingSessionId === session.id,
    onStartRename: () => setEditingSessionId(session.id),
    onCommitRename: (title) => {
      setEditingSessionId(null);
      const trimmed = title.trim();
      if (trimmed && trimmed !== session.title)
        void renameSession(session.id, trimmed);
    },
    onCancelRename: () => setEditingSessionId(null),
    onRequestDelete: () =>
      setPendingDelete({
        type: "session",
        id: session.id,
        name: session.title,
      }),
  });

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === "session") {
      void deleteSession(pendingDelete.id);
    } else {
      void deleteFolder(pendingDelete.id);
    }
    setPendingDelete(null);
  };

  return (
    <>
      <div className="px-2 pb-2 pt-3">
        <Button
          className="w-full justify-start gap-2 rounded-md"
          onClick={() => void createSession()}
        >
          <Plus className="size-4" aria-hidden />
          New chat
        </Button>
      </div>
      <div className="px-2 pb-1">
        <SearchInput
          value={sidebarSearch}
          onChange={setSidebarSearch}
          placeholder="Search chats…"
          aria-label="Search chats"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {sessions.length === 0 && !query ? (
          <EmptyState
            icon={MessageSquare}
            title="No chats yet"
            description="Start a new conversation to see it here."
            className="mt-6"
          />
        ) : query ? (
          <div className="flex flex-col gap-0.5 p-2">
            {filtered.length === 0 ? (
              <EmptyState icon={SearchX} title="No matches" className="mt-6" />
            ) : (
              filtered.map((session) => (
                <SessionRow key={session.id} {...rowProps(session)} />
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 pb-2">
            {pinned.length > 0 && (
              <div className="px-2 pt-1">
                <p className="px-2 text-xs font-medium text-muted-foreground">
                  Pinned
                </p>
                <div className="mt-1 flex flex-col gap-0.5">
                  {pinned.map((session) => (
                    <SessionRow key={session.id} {...rowProps(session)} />
                  ))}
                </div>
              </div>
            )}
            <WorkspaceSection
              rowProps={rowProps}
              onRequestDeleteFolder={(folder) =>
                setPendingDelete({
                  type: "folder",
                  id: folder.id,
                  name: folder.name,
                })
              }
            />
            <ChatsSection groups={groups} rowProps={rowProps} />
          </div>
        )}
      </ScrollArea>
      <div className="px-2 pb-2 pt-1">
        <CommandCenterButton />
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.type === "folder" ? "Delete folder?" : "Delete chat?"
        }
        description={
          pendingDelete?.type === "folder"
            ? `“${pendingDelete?.name}” will be deleted. Chats inside will be moved back to the main list.`
            : `“${pendingDelete?.name}” will be permanently deleted.`
        }
        danger
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const width = useUiStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const moveToFolder = useSessionStore((s) => s.moveToFolder);
  const sidebarPosition = useSettingsStore(
    (s) => s.settings.appearance.sidebarPosition,
  );
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragState.current = { startX: event.clientX, startWidth: width };
    setIsDraggingHandle(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    setSidebarWidth(
      sidebarPosition === "left"
        ? drag.startWidth + delta
        : drag.startWidth - delta,
    );
  };

  const endHandleDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current = null;
    setIsDraggingHandle(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith("session:")) return;
    const sessionId = activeId.slice("session:".length);
    if (overId.startsWith("folder:")) {
      void moveToFolder(sessionId, overId.slice("folder:".length));
    } else if (overId === CHATS_ROOT_ID) {
      void moveToFolder(sessionId, null);
    }
  };

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col bg-background",
        sidebarPosition === "left"
          ? "border-r border-border"
          : "border-l border-border",
        collapsed && "w-sidebar-collapsed",
        !isDraggingHandle && "transition-standard",
      )}
      style={collapsed ? undefined : { width }}
    >
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {collapsed ? <CollapsedRail /> : <ExpandedSidebar />}
      </DndContext>
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endHandleDrag}
          onPointerCancel={endHandleDrag}
          className={cn(
            "absolute inset-y-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-accent",
            sidebarPosition === "left" ? "right-0" : "left-0",
          )}
        />
      )}
    </aside>
  );
}
