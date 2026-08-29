import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";
import type {
  ChatPersonality,
  CodeTheme,
  ImageAttachmentMode,
  SendShortcut,
} from "@/types/settings";

interface SwitchRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SwitchRow({ id, label, description, checked, onCheckedChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

const SEND_OPTIONS: Array<{ id: SendShortcut; label: string }> = [
  { id: "enter", label: "Enter" },
  { id: "mod+enter", label: "Ctrl/Cmd + Enter" },
];

const PERSONALITY_OPTIONS: Array<{ id: ChatPersonality; label: string }> = [
  { id: "none", label: "None" },
  { id: "helpful", label: "Helpful" },
  { id: "concise", label: "Concise" },
  { id: "technical", label: "Technical" },
  { id: "creative", label: "Creative" },
  { id: "teacher", label: "Teacher" },
  { id: "kawaii", label: "Kawaii" },
  { id: "catgirl", label: "Catgirl" },
  { id: "pirate", label: "Pirate" },
  { id: "shakespeare", label: "Shakespeare" },
];

const IMAGE_ATTACHMENT_OPTIONS: Array<{ id: ImageAttachmentMode; label: string }> =
  [
    { id: "auto", label: "Auto" },
    { id: "text-only", label: "Text-only" },
    { id: "disabled", label: "Disabled" },
  ];

const TIMEZONE_OPTIONS = [
  "",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function formatTimezone(value: string): string {
  if (!value) return "System timezone";
  return value.replace(/_/g, " ");
}

export function ChatSettings() {
  const { settings, updateSection } = useSettings();

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SwitchRow
          id="auto-save"
          label="Auto-save"
          description="Save chats automatically as you go."
          checked={settings.chat.autoSave}
          onCheckedChange={(autoSave) => updateSection("chat", { autoSave })}
        />
        <SwitchRow
          id="show-timestamps"
          label="Show timestamps"
          description="Display the time next to each message."
          checked={settings.chat.showTimestamps}
          onCheckedChange={(showTimestamps) => updateSection("chat", { showTimestamps })}
        />
      </section>
      <Separator />
      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">Send messages with</p>
          <div
            role="radiogroup"
            aria-label="Send messages with"
            className="inline-flex rounded-md border border-border p-0.5"
          >
            {SEND_OPTIONS.map((option) => {
              const selected = settings.chat.sendWith === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => updateSection("chat", { sendWith: option.id })}
                  className={cn(
                    "rounded-sm px-3 py-1 text-xs transition-standard",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="code-theme">Code theme</Label>
          <Select
            value={settings.chat.codeTheme}
            onValueChange={(value) =>
              updateSection("chat", { codeTheme: value as CodeTheme })
            }
          >
            <SelectTrigger id="code-theme" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>
      <Separator />
      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="personality">Personality</Label>
          <Select
            value={settings.chat.personality}
            onValueChange={(value) =>
              updateSection("chat", { personality: value as ChatPersonality })
            }
          >
            <SelectTrigger id="personality" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERSONALITY_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Appended to the system prompt to shape the assistant's tone.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            value={settings.chat.timezone}
            onValueChange={(value) => updateSection("chat", { timezone: value })}
          >
            <SelectTrigger id="timezone" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((option) => (
                <SelectItem key={option || "system"} value={option}>
                  {formatTimezone(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Shared with the model so time-aware answers match your locale.
          </p>
        </div>
      </section>
      <Separator />
      <section className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="max-preview-size">Max preview / image load size</Label>
              <p className="text-xs text-muted-foreground">
                How big a local file the app loads for previews and image
                attachments, in MB. 256 MB cap.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="max-preview-size"
                type="number"
                min={1}
                max={256}
                value={settings.chat.maxPreviewSizeMb}
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  if (Number.isFinite(value)) {
                    updateSection("chat", {
                      maxPreviewSizeMb: Math.min(256, Math.max(1, value)),
                    });
                  }
                }}
                className="w-20 text-right"
              />
              <span className="text-sm text-muted-foreground">MB</span>
            </div>
          </div>
        </div>
        <SwitchRow
          id="show-reasoning-blocks"
          label="Reasoning Blocks"
          description="Show reasoning sections when the backend provides them."
          checked={settings.chat.showReasoningBlocks}
          onCheckedChange={(showReasoningBlocks) =>
            updateSection("chat", { showReasoningBlocks })
          }
        />
        <div className="space-y-2">
          <Label htmlFor="image-attachments">Image Attachments</Label>
          <Select
            value={settings.chat.imageAttachmentMode}
            onValueChange={(value) =>
              updateSection("chat", {
                imageAttachmentMode: value as ImageAttachmentMode,
              })
            }
          >
            <SelectTrigger id="image-attachments" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_ATTACHMENT_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Controls how image attachments are sent to the model. Text-only
            skips image data and uses any available description.
          </p>
        </div>
      </section>
      <Separator />
      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="default-system-prompt">Default system prompt</Label>
          <Textarea
            id="default-system-prompt"
            rows={4}
            value={settings.chat.defaultSystemPrompt}
            onChange={(event) =>
              updateSection("chat", { defaultSystemPrompt: event.target.value })
            }
            placeholder="You are a helpful assistant…"
          />
          <p className="text-xs text-muted-foreground">
            Applied to every new chat unless overridden.
          </p>
        </div>
      </section>
    </div>
  );
}
