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
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";
import type { ContentFilterLevel, RejectionStyle } from "@/types/settings";

const FILTER_LEVELS: Array<{ id: ContentFilterLevel; title: string; description: string }> = [
  { id: "off", title: "Off", description: "No filtering — every response is shown as-is." },
  { id: "moderate", title: "Moderate", description: "Blocks clearly unsafe requests and responses." },
  { id: "strict", title: "Strict", description: "Blocks anything that might be sensitive or unsafe." },
];

export function SafetySettings() {
  const { settings, updateSection } = useSettings();

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium leading-none">Content filter level</p>
        <div role="radiogroup" aria-label="Content filter level" className="space-y-2">
          {FILTER_LEVELS.map((level) => {
            const selected = settings.safety.contentFilter === level.id;
            return (
              <button
                key={level.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => updateSection("safety", { contentFilter: level.id })}
                className={cn(
                  "w-full rounded-lg border border-border p-3 text-left transition-standard hover:bg-accent/50",
                  selected && "border-primary ring-1 ring-primary",
                )}
              >
                <p className="text-sm font-medium">{level.title}</p>
                <p className="text-xs text-muted-foreground">{level.description}</p>
              </button>
            );
          })}
        </div>
      </section>
      <Separator />
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="auto-scan-attachments">Auto-scan attachments</Label>
            <p className="text-xs text-muted-foreground">
              Scan files for unsafe content before attaching them.
            </p>
          </div>
          <Switch
            id="auto-scan-attachments"
            checked={settings.safety.autoScanAttachments}
            onCheckedChange={(autoScanAttachments) =>
              updateSection("safety", { autoScanAttachments })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rejection-style">Rejection message style</Label>
          <Select
            value={settings.safety.rejectionStyle}
            onValueChange={(value) =>
              updateSection("safety", { rejectionStyle: value as RejectionStyle })
            }
          >
            <SelectTrigger id="rejection-style" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="brief">Brief</SelectItem>
              <SelectItem value="explained">Explained with reason</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How much detail the model gives when it refuses a request.
          </p>
        </div>
      </section>
    </div>
  );
}
