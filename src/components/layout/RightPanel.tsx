
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Eye,
  FileAudio,
  FileText,
  Film,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  PanelRightClose,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { AgentDetail } from "@/components/agent/AgentDetail";
import { GitControls } from "@/components/layout/GitControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ipc, isTauri, type DirEntry } from "@/lib/ipc";

import { cn, formatFileSize, generateId } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore, type RightPanelTab } from "@/stores/uiStore";
import type {
  Attachment,
  AttachmentKind,
  Citation,
  Message,
} from "@/types/chat";

const EMPTY_MESSAGES: Message[] = [];

const ATTACHMENT_ICONS: Record<AttachmentKind, LucideIcon> = {
  file: FileText,
  image: ImageIcon,
  folder: Folder,
  url: Link2,
};

const TABS: Array<{ value: RightPanelTab; label: string; icon: LucideIcon }> = [
  { value: "sources", label: "Sources", icon: BookOpen },
  { value: "files", label: "Files", icon: FolderOpen },
  { value: "preview", label: "Preview", icon: Eye },
  { value: "agent", label: "Agent", icon: Activity },
];

function useActiveMessages(): Message[] {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  return useChatStore((s) =>
    activeSessionId
      ? (s.messagesBySession[activeSessionId] ?? EMPTY_MESSAGES)
      : EMPTY_MESSAGES,
  );
}

function openExternal(url: string): void {
  if (isTauri) {
    void import("@tauri-apps/plugin-opener").then((m) => m.openUrl(url));
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function CitationUrl({ url }: { url: string }) {
  return (
    <button
      type="button"
      onClick={() => openExternal(url)}
      className="mt-1 flex max-w-full items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ExternalLink className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{url}</span>
    </button>
  );
}

function CitationCard({
  citation,
  highlighted,
}: {
  citation: Citation;
  highlighted?: boolean;
}) {
  return (
    <div
      data-preview={highlighted || undefined}
      className={cn(
        "rounded-lg border border-border p-3",
        highlighted && "ring-1 ring-primary",
      )}
    >
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {citation.index}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{citation.title}</p>
          {citation.snippet && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {citation.snippet}
            </p>
          )}
          {citation.url && <CitationUrl url={citation.url} />}
        </div>
      </div>
    </div>
  );
}

function SourcesPane() {
  const messages = useActiveMessages();
  const previewMessageId = useUiStore((s) => s.previewMessageId);
  const listRef = useRef<HTMLDivElement | null>(null);

  const citations = useMemo(
    () =>
      messages.flatMap((m) =>
        (m.citations ?? []).map((citation) => ({ citation, messageId: m.id })),
      ),
    [messages],
  );

  useEffect(() => {
    if (!previewMessageId) return;
    listRef.current
      ?.querySelector('[data-preview="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [previewMessageId, citations.length]);

  if (citations.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No sources yet"
        description="Citations from responses will appear here."
      />
    );
  }

  return (
    <ScrollArea className="h-full">
      <div ref={listRef} className="flex flex-col gap-2 p-3">
        {citations.map(({ citation, messageId }) => (
          <CitationCard
            key={citation.id}
            citation={citation}
            highlighted={messageId === previewMessageId}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

function imageMimeType(name: string): string {
  const ext = extensionOf(name);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  return ext ? `image/${ext}` : "image/png";
}

function mediaMimeType(name: string): string | null {
  const ext = extensionOf(name);
  if (IMAGE_EXTENSIONS.includes(ext)) return imageMimeType(name);
  if (ext === "mov") return "video/quicktime";
  if (ext === "m4v") return "video/x-m4v";
  if (ext === "ogv") return "video/ogg";
  if (VIDEO_EXTENSIONS.includes(ext)) return `video/${ext}`;
  if (ext === "m4a") return "audio/mp4";
  if (AUDIO_EXTENSIONS.includes(ext)) return `audio/${ext}`;
  return null;
}

function FolderTree({
  attachment,
  onFileSelect,
}: {
  attachment: Attachment;
  onFileSelect: (attachment: Attachment) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!expanded && entries === null && isTauri && attachment.path) {
      setLoading(true);
      try {
        const list = await ipc.readDirEntries(attachment.path);
        setEntries(list);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    setExpanded((prev) => !prev);
  };

  const handleFileClick = async (entry: DirEntry) => {
    if (!isTauri) return;
    const mimeType = mediaMimeType(entry.name);

    if (mimeType) {
      try {
        const { convertFileSrc } = await import("@tauri-apps/api/core");
        const allowedPath = await ipc.allowMediaPreview(entry.path);
        onFileSelect({
          id: generateId(),
          kind: mimeType.startsWith("image/") ? "image" : "file",
          name: entry.name,
          path: entry.path,
          mimeType,
          preview: convertFileSrc(allowedPath),
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    try {
      const textContent = await ipc.readFileText(entry.path);
      onFileSelect({
        id: generateId(),
        kind: "file",
        name: entry.name,
        path: entry.path,
        textContent,
        size: textContent.length,
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("not a text file")) {
        onFileSelect({
          id: generateId(),
          kind: "file",
          name: entry.name,
          path: entry.path,
        });
        return;
      }
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const listing = attachment.textContent
    ? attachment.textContent.split("\n").filter(Boolean)
    : [];

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
        <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 truncate text-sm">{attachment.name}</span>
        {attachment.size !== undefined && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatFileSize(attachment.size)}
          </span>
        )}
      </button>
      {expanded && (
        <div className="ml-3 border-l border-border pl-1.5">
          {loading ? (
            <span className="block px-2 py-1 text-xs text-muted-foreground">Loading…</span>
          ) : entries ? (
            entries.map((entry) => {
              if (entry.isDir) {
                return (
                  <FolderTree
                    key={entry.path}
                    attachment={{
                      id: generateId(),
                      kind: "folder",
                      name: entry.name,
                      path: entry.path,
                    }}
                    onFileSelect={onFileSelect}
                  />
                );
              }

              const mimeType = mediaMimeType(entry.name);
              const EntryIcon = mimeType?.startsWith("image/")
                ? ImageIcon
                : mimeType?.startsWith("video/")
                  ? Film
                  : mimeType?.startsWith("audio/")
                    ? FileAudio
                    : FileText;
              return (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => handleFileClick(entry)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent"
                >
                  <EntryIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-sm">{entry.name}</span>
                </button>
              );
            })
          ) : (
            listing.map((line, index) => (
              <span
                key={`${line}-${index}`}
                className="block px-2 py-1 text-xs text-muted-foreground"
              >
                {line}
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FilesPane({
  onSelect,
}: {
  onSelect: (attachment: Attachment) => void;
}) {
  const messages = useActiveMessages();
  const attachments = useMemo(
    () => messages.flatMap((m) => m.attachments ?? []),
    [messages],
  );

  if (attachments.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No files yet"
        description="Attachments in this chat will appear here."
      />
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-0.5 p-2">
        {attachments.map((attachment) => {
          if (attachment.kind === "folder") {
            return (
              <FolderTree
                key={attachment.id}
                attachment={attachment}
                onFileSelect={onSelect}
              />
            );
          }
          const Icon = ATTACHMENT_ICONS[attachment.kind];
          return (
            <button
              key={attachment.id}
              type="button"
              onClick={() => onSelect(attachment)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
            >
              <Icon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="flex-1 truncate text-sm">{attachment.name}</span>
              {attachment.size !== undefined && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function PreviewPane({ attachment }: { attachment: Attachment | null }) {
  const messages = useActiveMessages();
  const previewMessageId = useUiStore((s) => s.previewMessageId);

  const previewCitations = useMemo(
    () => messages.find((m) => m.id === previewMessageId)?.citations ?? [],
    [messages, previewMessageId],
  );

  let body: ReactNode = null;
  if (attachment?.mimeType?.startsWith("image/") && attachment.preview) {
    body = (
      <img
        src={attachment.preview}
        alt={attachment.name}
        className="w-full rounded-lg border border-border object-contain"
      />
    );
  } else if (attachment?.mimeType?.startsWith("video/") && attachment.preview) {
    body = (
      <video
        src={attachment.preview}
        controls
        preload="metadata"
        className="w-full rounded-lg border border-border bg-black"
      >
        Your system cannot preview this video format.
      </video>
    );
  } else if (attachment?.mimeType?.startsWith("audio/") && attachment.preview) {
    body = (
      <audio src={attachment.preview} controls preload="metadata" className="w-full">
        Your system cannot preview this audio format.
      </audio>
    );
  } else if (attachment?.kind === "url" && attachment.url) {
    body = (
      <iframe
        src={attachment.url}
        sandbox="allow-scripts"
        title={attachment.name}
        className="w-full flex-1 rounded-lg border border-border"
      />
    );
  } else if (attachment?.textContent) {
    body = (
      <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border">
        <pre className="whitespace-pre-wrap p-3 font-mono text-xs">
          {attachment.textContent}
        </pre>
      </ScrollArea>
    );
  }

  if (!body && previewCitations.length === 0) {
    return (
      <EmptyState
        icon={Eye}
        title="Nothing to preview"
        description="Select a file from the Files tab."
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {body}
      {previewCitations.length > 0 && (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-2">
            {previewCitations.map((citation) => (
              <CitationCard key={citation.id} citation={citation} highlighted />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function AgentPane() {
  return <AgentDetail />;
}

interface RightPanelProps {
  position?: "left" | "right";
}

export function RightPanel({ position = "right" }: RightPanelProps) {
  const tab = useUiStore((s) => s.rightPanelTab);
  const setRightPanelTab = useUiStore((s) => s.setRightPanelTab);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const rightPanelWidth = useUiStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useUiStore((s) => s.setRightPanelWidth);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null,
  );
  const messages = useActiveMessages();
  const repositoryPath = useMemo(
    () =>
      messages
        .flatMap((message) => message.attachments ?? [])
        .find((attachment) => attachment.kind === "folder" && attachment.path)
        ?.path,
    [messages],
  );
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const activeTab = TABS.find((t) => t.value === tab) ?? TABS[0];

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragState.current = { startX: event.clientX, startWidth: rightPanelWidth };
    setIsDraggingHandle(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    setRightPanelWidth(
      position === "right" ? drag.startWidth - delta : drag.startWidth + delta,
    );
  };

  const endHandleDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current = null;
    setIsDraggingHandle(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col bg-card/40",
        position === "left"
          ? "border-r border-border"
          : "border-l border-border",
        !isDraggingHandle && "transition-standard",
      )}
      style={{ width: rightPanelWidth }}
    >
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <activeTab.icon className="size-3.5" aria-hidden />
          <span>{activeTab.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {tab === "files" && <GitControls path={repositoryPath} />}
          <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
            {TABS.map(({ value, label, icon: Icon }) => {
              const active = tab === value;
              return (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={label}
                      aria-pressed={active}
                      onClick={() => setRightPanelTab(value)}
                      className={cn(
                        "size-6 rounded-sm",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close right sidebar"
                onClick={toggleRightPanel}
                className="size-6 text-muted-foreground hover:text-foreground"
              >
                <PanelRightClose className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "sources" && <SourcesPane />}
        {tab === "files" && (
          <FilesPane
            onSelect={(attachment) => {
              setPreviewAttachment(attachment);
              setRightPanelTab("preview");
            }}
          />
        )}
        {tab === "preview" && <PreviewPane attachment={previewAttachment} />}
        {tab === "agent" && <AgentPane />}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize right panel"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={endHandleDrag}
        onPointerCancel={endHandleDrag}
        className={cn(
          "absolute inset-y-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-accent",
          position === "right" ? "left-0" : "right-0",
        )}
      />
    </aside>
  );
}
