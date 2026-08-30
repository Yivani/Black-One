import { useState } from "react";
import { Hammer, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/shared/EmptyState";
import { useSettings } from "@/hooks/useSettings";
import { cn, generateId } from "@/lib/utils";
import type { ToolConfig, ToolPermission } from "@/types/settings";

const PERMISSION_OPTIONS: Array<{ id: ToolPermission; title: string; description: string }> = [
  { id: "ask", title: "Manual", description: "Every file/shell action needs approval." },
  { id: "allowlisted", title: "Auto", description: "Read-only inspection runs automatically; changes and commands still ask." },
  { id: "blocked", title: "Blocked", description: "Disable file and shell tools." },
];

export function ToolSettings() {
  const { settings, updateSection } = useSettings();
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const tools = settings.tools.tools;

  const setTools = (next: ToolConfig[]) => updateSection("tools", { tools: next });

  const toggleTool = (id: string, enabled: boolean) => {
    setTools(tools.map((tool) => (tool.id === id ? { ...tool, enabled } : tool)));
  };

  const addTool = () => {
    const name = newName.trim();
    if (!name) return;
    setTools([
      ...tools,
      { id: generateId(), name, description: newDescription.trim(), enabled: true },
    ]);
    setNewName("");
    setNewDescription("");
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium leading-none">Tool execution permission</p>
        <p className="text-xs text-muted-foreground">
          This controls when Black One asks before using workspace tools. The composer
          offers Manual, Auto, and a temporary YOLO mode.
        </p>
        <div
          role="radiogroup"
          aria-label="Tool execution permission"
          className="grid grid-cols-3 gap-2"
        >
          {PERMISSION_OPTIONS.map((option) => {
            const selected = settings.tools.permission === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => updateSection("tools", { permission: option.id })}
                className={cn(
                  "rounded-lg border border-border p-3 text-left transition-standard hover:bg-accent/50",
                  selected && "border-primary ring-1 ring-primary",
                )}
              >
                <p className="text-sm font-medium">{option.title}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </button>
            );
          })}
        </div>
      </section>
      <Separator />
      <section className="space-y-3">
        <p className="text-sm font-medium leading-none">Enabled tool groups</p>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium">File tools</p>
            <p className="text-xs text-muted-foreground">Read, write, create, delete, rename, and list files.</p>
          </div>
          <Switch
            checked={settings.tools.fileToolsEnabled}
            onCheckedChange={(enabled) => updateSection("tools", { fileToolsEnabled: enabled })}
            aria-label="Enable file tools"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Shell tools</p>
            <p className="text-xs text-muted-foreground">Run one-shot shell commands inside attached folders.</p>
          </div>
          <Switch
            checked={settings.tools.shellToolsEnabled}
            onCheckedChange={(enabled) => updateSection("tools", { shellToolsEnabled: enabled })}
            aria-label="Enable shell tools"
          />
        </div>
      </section>
      <Separator />
      <section className="space-y-3">
        <p className="text-sm font-medium leading-none">Tools</p>
        {tools.length === 0 ? (
          <EmptyState
            icon={Hammer}
            title="No tools configured"
            description="MCP and function tools you add will appear here."
          />
        ) : (
          <div className="space-y-2">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">{tool.name}</p>
                  {tool.description && (
                    <p className="truncate text-xs text-muted-foreground">{tool.description}</p>
                  )}
                </div>
                <Switch
                  checked={tool.enabled}
                  onCheckedChange={(enabled) => toggleTool(tool.id, enabled)}
                  aria-label={`Enable ${tool.name}`}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Tool name"
            aria-label="Tool name"
          />
          <Input
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="Description"
            aria-label="Tool description"
          />
          <Button onClick={addTool} disabled={!newName.trim()}>
            <Plus className="size-4" aria-hidden />
            Add
          </Button>
        </div>
      </section>
    </div>
  );
}
