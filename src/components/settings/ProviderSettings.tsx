import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Circle,
  Download,
  Loader2,
  RefreshCw,
  Square,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { CLI_TOOLS, type CliAction, type CliTool } from "@/lib/cliTools";
import {
  ipc,
  isTauri,
  type CliJob,
  type CliToolStatus,
} from "@/lib/ipc";

const ACTION_PROGRESS: Record<CliAction, string> = {
  install: "Installing",
  update: "Updating",
  uninstall: "Uninstalling",
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ToolState({
  status,
  job,
}: {
  status?: CliToolStatus;
  job?: CliJob;
}) {
  if (job?.status === "running" || job?.status === "cancelling") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-foreground" aria-live="polite">
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
        {job.status === "cancelling"
          ? "Cancelling..."
          : `${ACTION_PROGRESS[job.action]} in background...`}
      </span>
    );
  }
  if (job?.status === "error") {
    return (
      <span className="flex min-w-0 items-start gap-1.5 text-xs text-destructive" role="status">
        <X className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span className="line-clamp-2 break-words">{job.message}</span>
      </span>
    );
  }
  if (job?.status === "cancelled") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400" role="status">
        <Square className="size-3" aria-hidden />
        Cancelled
      </span>
    );
  }
  if (status?.installed) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400" role="status">
        <Check className="size-3" aria-hidden />
        Installed{status.version ? ` v${status.version}` : ""}
        {!status.managedByNpm ? " outside npm" : ""}
      </span>
    );
  }
  if (job?.status === "finished" && job.action === "uninstall") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400" role="status">
        <Check className="size-3" aria-hidden />
        Uninstalled
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Circle className="size-3" aria-hidden />
      Not installed
    </span>
  );
}

export function ProviderSettings() {
  const [statuses, setStatuses] = useState<CliToolStatus[]>([]);
  const [jobs, setJobs] = useState<CliJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pendingUninstall, setPendingUninstall] = useState<CliTool | null>(null);

  const refreshStatuses = useCallback(async () => {
    if (!isTauri) return;
    try {
      setStatuses(await ipc.listCliToolStatuses());
      setPageError(null);
    } catch (error) {
      setPageError(errorText(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    if (!isTauri) return;
    try {
      const nextJobs = await ipc.listCliJobs();
      setJobs(nextJobs);
      if (!nextJobs.some((job) => job.status === "running" || job.status === "cancelling")) {
        await refreshStatuses();
      }
    } catch (error) {
      setPageError(errorText(error));
    }
  }, [refreshStatuses]);

  useEffect(() => {
    void Promise.all([refreshStatuses(), refreshJobs()]);
  }, [refreshJobs, refreshStatuses]);

  const hasActiveJob = jobs.some(
    (job) => job.status === "running" || job.status === "cancelling",
  );
  useEffect(() => {
    if (!hasActiveJob) return;
    const timer = window.setInterval(() => void refreshJobs(), 600);
    return () => window.clearInterval(timer);
  }, [hasActiveJob, refreshJobs]);

  const statusByTool = useMemo(
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses],
  );
  const jobByTool = useMemo(
    () => new Map(jobs.map((job) => [job.toolId, job])),
    [jobs],
  );

  const runAction = async (tool: CliTool, action: CliAction) => {
    try {
      const job = await ipc.runCliOperation(tool.id, action);
      setJobs((current) => [...current.filter((item) => item.toolId !== tool.id), job]);
      toast.success(`${ACTION_PROGRESS[action]} ${tool.name} in the background.`);
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const cancelJob = async (job: CliJob) => {
    try {
      await ipc.cancelCliOperation(job.id);
      await refreshJobs();
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        Black One runs npm in the background without opening a shell window.
        Status and errors remain here if you close and reopen Settings.
      </p>

      {pageError && (
        <div className="border-y border-destructive/40 py-3 text-sm text-destructive" role="alert">
          Could not inspect CLI tools: {pageError}
        </div>
      )}

      <div className="divide-y divide-border border-y border-border">
        {CLI_TOOLS.map((tool) => {
          const status = statusByTool.get(tool.id);
          const job = jobByTool.get(tool.id);
          const active = job?.status === "running" || job?.status === "cancelling";
          const npmManaged = status?.managedByNpm ?? false;
          return (
            <section
              key={tool.id}
              className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <TerminalSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <h3 className="text-sm font-semibold">{tool.name}</h3>
                  <code className="truncate text-[11px] text-muted-foreground">{tool.binary}</code>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.description}</p>
                <div className="mt-1.5 min-h-4">
                  <ToolState status={status} job={job} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                {active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={job.status === "cancelling"}
                    onClick={() => void cancelJob(job)}
                  >
                    <Square className="size-3.5" aria-hidden />
                    Cancel
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading || status?.installed}
                      onClick={() => void runAction(tool, "install")}
                    >
                      <Download className="size-3.5" aria-hidden />
                      Install
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loading || !npmManaged}
                      onClick={() => void runAction(tool, "update")}
                    >
                      <RefreshCw className="size-3.5" aria-hidden />
                      Update
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loading || !npmManaged}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingUninstall(tool)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Uninstall
                    </Button>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Install and Update use each package's latest npm release. Tools found outside npm are shown,
        but Black One will not overwrite or remove those installations.
      </p>

      <ConfirmDialog
        open={pendingUninstall !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUninstall(null);
        }}
        title={pendingUninstall ? `Uninstall ${pendingUninstall.name}?` : "Uninstall CLI?"}
        description="The npm package will be removed globally. The CLI's local configuration and authentication remain."
        confirmLabel="Uninstall"
        danger
        onConfirm={() => {
          const tool = pendingUninstall;
          setPendingUninstall(null);
          if (tool) void runAction(tool, "uninstall");
        }}
      />
    </div>
  );
}
