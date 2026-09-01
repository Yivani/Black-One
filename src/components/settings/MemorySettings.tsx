import { useMemo, useState } from "react";
import { Check, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SettingsNote } from "@/components/settings/SettingsPrimitives";
import { useSettings } from "@/hooks/useSettings";
import { useTranslation } from "@/hooks/useTranslation";
import { AGENT_CONTEXT_FILES } from "@/lib/agentContext";
import { isTauri } from "@/lib/ipc";
import { syncAgentContext } from "@/lib/memory";
import { cn } from "@/lib/utils";
import { agentContextFolder } from "@/stores/memoryStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { MemoryViewer } from "./MemoryViewer";

/**
 * Memory settings: the bank itself, plus the bridge to the terminal CLI agents.
 *
 * That bridge is the answer to "the CLIs don't remember anything" — they are
 * separate processes and cannot see Black One's prompt, but they all read a
 * Markdown context file from the project root.
 */
export function MemorySettings() {
  const { t } = useTranslation();
  const { settings, updateSection } = useSettings();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  // Subscribed so the resolved folder updates when a terminal opens or closes.
  const terminals = useTerminalStore((s) => s.terminals);
  const [syncing, setSyncing] = useState(false);

  const workspace = workspaces.find((item) => item.id === activeWorkspaceId);
  const selected = settings.memory.agentContextFiles ?? [];
  // Same answer the automatic sync uses: the workspace folder, or failing that
  // the directory the terminals are actually running in.
  const folder = useMemo(() => agentContextFolder(), [terminals, workspace]);

  const toggleFile = (file: string) => {
    updateSection("memory", {
      agentContextFiles: selected.includes(file)
        ? selected.filter((item) => item !== file)
        : [...selected, file],
    });
  };

  const handleSync = async () => {
    if (!folder) return;
    setSyncing(true);
    try {
      const written = await syncAgentContext(folder);
      toast.success(
        written.length
          ? t("memory.synced", { files: written.join(", ") })
          : t("memory.syncedNone"),
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3 border-b border-border pb-6">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            {t("memory.shareTitle")}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            {t("memory.shareDesc")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {AGENT_CONTEXT_FILES.map(({ file, tools }) => {
            const on = selected.includes(file);
            return (
              <button
                key={file}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggleFile(file)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "border-primary bg-accent/40 ring-1 ring-primary"
                    : "border-border hover:bg-accent/40",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                  aria-hidden
                >
                  {on && <Check className="size-3" />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-mono text-xs">
                    <FileText className="size-3 text-muted-foreground" aria-hidden />
                    {file}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {tools.join(", ")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!isTauri || !folder || selected.length === 0 || syncing}
            onClick={() => void handleSync()}
          >
            <RefreshCw
              className={cn("mr-1 size-3.5", syncing && "animate-spin")}
              aria-hidden
            />
            {t("memory.syncNow")}
          </Button>
          {folder && (
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {folder}
            </span>
          )}
        </div>

        {!folder && <SettingsNote>{t("memory.shareNote")}</SettingsNote>}
      </section>

      <div className="h-[min(520px,calc(100vh-360px))] min-h-72">
        <MemoryViewer />
      </div>
    </div>
  );
}
