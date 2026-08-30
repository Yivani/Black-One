import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUp,
  Brain,
  ChevronDown,
  FileText,
  Folder,
  Gauge,
  Image,
  Link2,
  LoaderCircle,
  Shield,
  Square,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { Attachment, AttachmentKind } from "@/types/chat";
import type { ChatFolder } from "@/types/session";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AttachmentMenu } from "@/components/chat/AttachmentMenu";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { PromptSnippets } from "@/components/chat/PromptSnippets";
import { useChatStore } from "@/stores/chatStore";
import { useModels } from "@/hooks/useModels";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { useToolRuntimeStore } from "@/stores/toolRuntimeStore";
import { COMPOSER_MAX_LINES, MAX_ATTACHMENTS } from "@/lib/constants";
import { cn, generateId } from "@/lib/utils";
import { checkPreviewSize } from "@/components/chat/AttachmentMenu";
import type { EffortLevel } from "@/types/settings";

const {
  fetchUrlAttachment,
  pickFileAttachments,
  pickFolderAttachment,
  pickImageAttachments,
} = AttachmentMenu;

const KIND_ICONS: Record<AttachmentKind, LucideIcon> = {
  file: FileText,
  folder: Folder,
  image: Image,
  url: Link2,
};

interface MentionState {
  type: "@" | "#";
  /** Index of the trigger character in the draft. */
  start: number;
  query: string;
}

interface MentionOption {
  id: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  action: () => void;
}

interface ComposerProps {
  variant?: "default" | "quick";
  onSubmit?: (content: string, attachments: Attachment[]) => Promise<void>;
}

const PERMISSION_MODES = [
  {
    id: "manual" as const,
    label: "Manual",
    description: "Approve every file or shell action before it runs.",
  },
  {
    id: "auto" as const,
    label: "Auto",
    description: "Reads and folder listings run instantly. Changes and commands still ask.",
  },
  {
    id: "yolo" as const,
    label: "YOLO",
    description: "All file and shell actions run without asking.",
  },
];

const DEFAULT_EFFORT_LEVELS: EffortLevel[] = ["low", "medium", "high"];
const EFFORT_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  max: "Max",
  minimal: "Min",
  instant: "Instant",
};

function formatEffortLabel(level: string): string {
  return EFFORT_LABELS[level] ?? level.charAt(0).toUpperCase() + level.slice(1);
}

function clampEffortIndex(levels: string[], current: string): number {
  const index = levels.indexOf(current);
  return Math.max(0, index !== -1 ? index : Math.floor((levels.length - 1) / 2));
}

function PermissionModeToggle() {
  const mode = useToolRuntimeStore((s) => s.permissionMode);
  const setMode = useToolRuntimeStore((s) => s.setPermissionMode);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const active = PERMISSION_MODES.find((m) => m.id === mode) ?? PERMISSION_MODES[0];

  const modeColor =
    mode === "yolo"
      ? "text-destructive border-destructive/30 bg-destructive/10 hover:bg-destructive/15"
      : mode === "auto"
        ? "text-amber-500 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
        : "text-muted-foreground border-border bg-muted/40 hover:text-foreground";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition-standard",
            modeColor,
          )}
          aria-label={`Tool permission: ${active.label}`}
        >
          <Shield className="size-3" aria-hidden />
          <span>{active.label}</span>
          <ChevronDown className="size-3 opacity-70" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => {
            const next = value as typeof mode;
            setMode(next);
            if (next !== "yolo") {
              updateSection("tools", {
                permission: next === "auto" ? "allowlisted" : "ask",
              });
            }
          }}
        >
          {PERMISSION_MODES.map((m) => (
            <DropdownMenuRadioItem
              key={m.id}
              value={m.id}
              className="flex flex-col items-start gap-0.5 rounded-md py-2 pr-2"
            >
              <span className="text-sm font-medium">{m.label}</span>
              <span className="text-[10px] leading-tight text-muted-foreground">{m.description}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModelOptions() {
  const { selected } = useModels();
  const effortLevel = useSettingsStore((s) => s.settings.model.effortLevel);
  const thinkingEnabled = useSettingsStore(
    (s) => s.settings.model.thinkingEnabled,
  );
  const updateSection = useSettingsStore((s) => s.updateSection);
  const supportsThinking =
    selected?.model.capabilities.includes("reasoning") ?? false;
  const [open, setOpen] = useState(false);

  if (!supportsThinking) return null;

  const effortLevels = selected?.model.effortLevels ?? DEFAULT_EFFORT_LEVELS;
  const effortIndex = clampEffortIndex(effortLevels, effortLevel);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!thinkingEnabled}
            className="flex h-7 items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 text-[10px] font-semibold text-muted-foreground transition-standard hover:text-foreground disabled:opacity-50"
            aria-label={`Reasoning effort: ${formatEffortLabel(effortLevel)}`}
          >
            <Gauge className="size-3" aria-hidden />
            <span>{formatEffortLabel(effortLevel)}</span>
            <ChevronDown className="size-3 opacity-70" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={8}
          className="w-56 p-3"
          onFocusOutside={(event) => event.preventDefault()}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold">Effort</span>
          </div>
          <div className="relative px-1">
            <Slider
              min={0}
              max={effortLevels.length - 1}
              step={1}
              value={[effortIndex]}
              onValueChange={(value) => {
                const level = effortLevels[value[0] ?? 0];
                if (level) updateSection("model", { effortLevel: level });
              }}
              className="[&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-thumb]]:size-5"
            />
            <div className="pointer-events-none absolute inset-x-1 top-1/2 flex -translate-y-1/2 justify-between px-0.5">
              {effortLevels.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    i === effortIndex ? "bg-primary-foreground" : "bg-primary/40",
                  )}
                  aria-hidden
                />
              ))}
            </div>
          </div>
          <div className="mt-2 flex justify-between px-0.5 text-[10px] text-muted-foreground">
            {effortLevels.map((level) => (
              <span
                key={level}
                className={cn(level === effortLevel && "font-medium text-foreground")}
              >
                {formatEffortLabel(level)}
              </span>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={() => updateSection("model", { thinkingEnabled: !thinkingEnabled })}
        className={cn(
          "flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold transition-standard",
          thinkingEnabled
            ? "border-transparent bg-primary text-primary-foreground shadow-sm"
            : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
        )}
        aria-label={thinkingEnabled ? "Thinking on" : "Thinking off"}
        aria-pressed={thinkingEnabled}
      >
        <Brain className="size-3" aria-hidden />
        <span>Think</span>
      </button>
    </div>
  );
}

function detectMention(value: string, cursor: number): MentionState | null {
  const before = value.slice(0, cursor);
  const match = /(^|\s)([@#])([\w./-]*)$/.exec(before);
  if (!match) return null;
  return {
    type: match[2] as "@" | "#",
    start: cursor - match[3].length - 1,
    query: match[3],
  };
}

function reportError(error: unknown): void {
  toast.error(error instanceof Error ? error.message : String(error));
}

export function Composer({ variant = "default", onSubmit }: ComposerProps) {
  const quick = variant === "quick";
  const sendWith = useSettingsStore((s) => s.settings.chat.sendWith);
  const isStreaming = useChatStore((s) => s.streamingSessionId !== null);
  const viewMode = useUiStore((s) => s.viewMode);
  const focusSignal = useUiStore((s) => s.composerFocusSignal);
  const attachFileSignal = useUiStore((s) => s.attachFileSignal);
  const attachFolderSignal = useUiStore((s) => s.attachFolderSignal);
  const editLastMessageSignal = useUiStore((s) => s.editLastMessageSignal);
  const folders = useSessionStore((s) => s.folders);
  const sessions = useSessionStore((s) => s.sessions);

  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [mentionUrlMode, setMentionUrlMode] = useState(false);
  const [mentionUrl, setMentionUrl] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 20;
    const maxHeight = lineHeight * (quick ? 4 : COMPOSER_MAX_LINES) + 16;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [quick]);

  useEffect(resizeTextarea, [draft, resizeTextarea]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    if (attachFileSignal === 0) return;
    pickFileAttachments()
      .then(addAttachments)
      .catch(reportError);
  }, [attachFileSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (attachFolderSignal === 0) return;
    pickFolderAttachment()
      .then((attachment) => {
        if (attachment) addAttachments([attachment]);
      })
      .catch(reportError);
  }, [attachFolderSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editLastMessageSignal === 0) return;
    const lastUser = useChatStore.getState().getLastUserMessage();
    if (!lastUser) return;
    setEditingMessageId(lastUser.id);
    setDraft(lastUser.content);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [editLastMessageSignal]);

  const addAttachments = (incoming: Attachment[]) => {
    if (incoming.length === 0) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_ATTACHMENTS} attachments per message.`);
      return;
    }
    if (incoming.length > room) {
      toast.error(`Up to ${MAX_ATTACHMENTS} attachments per message.`);
    }
    setAttachments((prev) => [
      ...prev,
      ...incoming.slice(0, Math.max(0, MAX_ATTACHMENTS - prev.length)),
    ]);
  };

  const runPicker = (picker: () => Promise<Attachment[]>) => {
    picker()
      .then(addAttachments)
      .catch(reportError);
  };

  const clearComposer = () => {
    setDraft("");
    setAttachments([]);
    setEditingMessageId(null);
    closeMention();
  };

  const handleSend = async () => {
    const content = draft.trim();
    if ((!content && attachments.length === 0) || isSubmitting) return;
    const outgoing = attachments;
    const editingId = editingMessageId;
    if (editingId) {
      clearComposer();
      useChatStore.getState().editMessage(editingId, content).catch(reportError);
      return;
    }
    if (onSubmit) {
      setIsSubmitting(true);
      try {
        await onSubmit(content, outgoing);
        clearComposer();
      } catch (error) {
        reportError(error);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    clearComposer();
    useChatStore.getState().sendMessage(content, outgoing).catch(reportError);
  };

  const closeMention = () => {
    setMention(null);
    setMentionUrlMode(false);
    setMentionUrl("");
    setMentionIndex(0);
  };

  /** Removes the trailing mention token, optionally inserting replacement text. */
  const stripMention = (insert = "") => {
    if (!mention) return;
    const before = draft.slice(0, mention.start);
    const after = draft.slice(mention.start + 1 + mention.query.length);
    setDraft(before + insert + after);
    closeMention();
    const caret = before.length + insert.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  const collectSessionAttachments = (): Attachment[] => {
    const sessionId = useSessionStore.getState().activeSessionId;
    if (!sessionId) return [];
    const messages = useChatStore.getState().messagesBySession[sessionId] ?? [];
    const seen = new Set<string>();
    const collected: Attachment[] = [];
    for (const message of messages) {
      for (const attachment of message.attachments ?? []) {
        const key = `${attachment.kind}:${attachment.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(attachment);
      }
    }
    return collected;
  };

  const buildFolderAttachment = (folder: ChatFolder): Attachment => {
    const titles = sessions.filter((s) => s.folderId === folder.id).map((s) => s.title);
    const listing = titles.length > 0 ? titles.join(", ") : "(empty)";
    return {
      id: generateId(),
      kind: "folder",
      name: folder.name,
      textContent: `Workspace folder "${folder.name}" containing chats: ${listing}`,
    };
  };

  const mentionOptions: MentionOption[] = [];
  if (mention && !mentionUrlMode) {
    const query = mention.query.toLowerCase();
    if (mention.type === "@") {
      const quickActions: Array<{ id: string; label: string; icon: LucideIcon; run: () => void }> = [
        {
          id: "attach-file",
          label: "Attach file",
          icon: FileText,
          run: () => runPicker(pickFileAttachments),
        },
        {
          id: "attach-image",
          label: "Attach image",
          icon: Image,
          run: () => runPicker(pickImageAttachments),
        },
      ];
      for (const quick of quickActions) {
        if (!quick.label.toLowerCase().includes(query)) continue;
        mentionOptions.push({
          id: quick.id,
          icon: quick.icon,
          label: quick.label,
          action: () => {
            stripMention();
            quick.run();
          },
        });
      }
      if ("attach url".includes(query)) {
        mentionOptions.push({
          id: "attach-url",
          icon: Link2,
          label: "Attach URL",
          action: () => setMentionUrlMode(true),
        });
      }
      for (const attachment of collectSessionAttachments()) {
        if (!attachment.name.toLowerCase().includes(query)) continue;
        mentionOptions.push({
          id: `session-${attachment.kind}-${attachment.name}`,
          icon: KIND_ICONS[attachment.kind],
          label: attachment.name,
          hint: "session",
          action: () => {
            stripMention(`@${attachment.name} `);
            if (!attachments.some((a) => a.name === attachment.name)) {
              addAttachments([attachment]);
            }
          },
        });
      }
    } else {
      for (const folder of folders) {
        if (!folder.name.toLowerCase().includes(query)) continue;
        mentionOptions.push({
          id: `folder-${folder.id}`,
          icon: Folder,
          label: folder.name,
          hint: "workspace",
          action: () => {
            stripMention();
            addAttachments([buildFolderAttachment(folder)]);
          },
        });
      }
    }
  }
  const activeMentionIndex =
    mentionOptions.length === 0 ? 0 : Math.min(mentionIndex, mentionOptions.length - 1);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setDraft(value);
    const cursor = event.target.selectionStart ?? value.length;
    setMention(detectMention(value, cursor));
    setMentionUrlMode(false);
    setMentionIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && !mentionUrlMode && mentionOptions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((activeMentionIndex + 1) % mentionOptions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex(
          (activeMentionIndex - 1 + mentionOptions.length) % mentionOptions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        mentionOptions[activeMentionIndex].action();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeMention();
        return;
      }
    }
    if (event.key === "Escape" && editingMessageId) {
      event.preventDefault();
      setEditingMessageId(null);
      setDraft("");
      return;
    }
    if (event.key !== "Enter") return;
    if ((quick || sendWith === "enter") && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    } else if (sendWith === "mod+enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItems = Array.from(event.clipboardData.items).filter((item) =>
      item.type.startsWith("image/"),
    );
    if (imageItems.length === 0) return;
    event.preventDefault();
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      if (!checkPreviewSize(file.size, "pasted-image.png")) continue;
      const reader = new FileReader();
      reader.onload = () => {
        addAttachments([
          {
            id: generateId(),
            kind: "image",
            name: "pasted-image.png",
            mimeType: item.type,
            size: file.size,
            preview: String(reader.result),
          },
        ]);
      };
      reader.onerror = () => toast.error("Failed to read pasted image.");
      reader.readAsDataURL(file);
    }
  };

  const submitMentionUrl = () => {
    fetchUrlAttachment(mentionUrl)
      .then((attachment) => {
        if (attachment) addAttachments([attachment]);
        stripMention();
      })
      .catch(reportError);
  };

  const insertPrompt = (text: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const before = draft.slice(0, start);
    const after = draft.slice(end);
    const spacer = before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";
    const trailing = after.length > 0 && !after.startsWith(" ") ? " " : "";
    const inserted = `${spacer}${text}${trailing}`;
    const next = before + inserted + after;
    setDraft(next);
    const caret = start + inserted.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
      resizeTextarea();
    });
  };

  return (
    <div className={cn(quick ? "p-2" : "border-t border-border p-3")}>
        {editingMessageId && (
          <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Editing last message</span>
            <span aria-hidden>·</span>
            <span>Esc to cancel</span>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((attachment) => {
              const Icon = KIND_ICONS[attachment.kind];
              return (
                <span
                  key={attachment.id}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                >
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="max-w-40 truncate">{attachment.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.name}`}
                    onClick={() =>
                      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id))
                    }
                    className="text-muted-foreground transition-standard hover:text-foreground"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-xl border border-border bg-background p-1.5 transition-[border-color,box-shadow]",
            "focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-ring/20",
            quick && "shadow-[0_10px_28px_rgba(0,0,0,0.18)]",
          )}
          onClick={() => textareaRef.current?.focus()}
          role="presentation"
        >
          <AttachmentMenu onAdd={addAttachments} />
          <PromptSnippets onInsert={insertPrompt} disabled={isStreaming} />
          <Popover
            open={mention !== null}
            onOpenChange={(open) => {
              if (!open) closeMention();
            }}
          >
            <PopoverTrigger asChild>
              <div className="min-w-0 flex-1">
                <Textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  rows={1}
                  placeholder={
                    viewMode === "agent"
                      ? "Describe the outcome…"
                      : "What should we change?"
                  }
                  aria-label="Message Black One"
                  className="min-h-8 resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-64 p-1"
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              {mentionUrlMode ? (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitMentionUrl();
                  }}
                >
                  <Input
                    value={mentionUrl}
                    onChange={(event) => setMentionUrl(event.target.value)}
                    placeholder="https://…"
                    aria-label="URL to attach"
                    className="h-8 text-xs"
                    autoFocus
                  />
                  <Button type="submit" size="sm" disabled={!mentionUrl.trim()}>
                    Add
                  </Button>
                </form>
              ) : mentionOptions.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches.</p>
              ) : (
                <div role="listbox" aria-label="Mention suggestions">
                  {mentionOptions.map((option, index) => (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={index === activeMentionIndex}
                      onMouseEnter={() => setMentionIndex(index)}
                      onClick={option.action}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-standard hover:bg-accent hover:text-accent-foreground",
                        index === activeMentionIndex && "bg-accent text-accent-foreground",
                      )}
                    >
                      <option.icon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="flex-1 truncate">{option.label}</span>
                      {option.hint && (
                        <span className="text-[10px] text-muted-foreground">{option.hint}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
          <ModelSelector />
          <ModelOptions />
          <PermissionModeToggle />
          {isStreaming ? (
            <Button
              size="icon"
              className="size-8 shrink-0 rounded-full"
              aria-label="Stop generation"
              onClick={() => useChatStore.getState().stopStreaming()}
            >
              <Square className="size-3.5" aria-hidden />
            </Button>
          ) : (
            <Button
              size="icon"
              className="size-8 shrink-0 rounded-full"
              aria-label="Send message"
              disabled={isSubmitting || (!draft.trim() && attachments.length === 0)}
              onClick={() => void handleSend()}
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-4" aria-hidden />
              )}
            </Button>
          )}
        </div>
      </div>
  );
}
