import { useMemo, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Bug, CheckCircle2, Copy, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GITHUB_REPO_URL } from "@/lib/constants";
import {
  ERROR_CATEGORIES,
  clearErrors,
  createGitHubIssueUrl,
  dismissError,
  errorReportText,
  getErrors,
  subscribeErrors,
  type AppError,
  type ErrorCategory,
} from "@/lib/errors";
import { isTauri } from "@/lib/ipc";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

type Filter = "all" | ErrorCategory;

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  startup: "Startup",
  render: "Interface",
  provider: "Provider",
  network: "Network",
  storage: "Storage",
  system: "System",
};

async function copyError(error: AppError): Promise<void> {
  if (await copyText(errorReportText(error))) toast.success("Diagnostics copied.");
  else toast.error("Could not reach the clipboard.");
}

async function reportIssue(error: AppError): Promise<void> {
  const url = createGitHubIssueUrl(GITHUB_REPO_URL, error);
  if (isTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function ErrorRow({ error }: { error: AppError }) {
  return (
    <article className="border-b border-border/60 py-4 last:border-b-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-5 rounded-sm px-1.5 text-[10px] font-medium">
              {CATEGORY_LABELS[error.category]}
            </Badge>
            <span className="truncate font-mono text-[10px] text-muted-foreground">{error.source}</span>
            {error.occurrences > 1 && <span className="font-mono text-[10px] text-muted-foreground">×{error.occurrences}</span>}
          </div>
          <h4 className="mt-2 break-words text-sm font-medium leading-5 text-foreground">{error.message}</h4>
          <time className="mt-1 block font-mono text-[10px] tabular-nums text-muted-foreground">
            {new Date(error.occurredAt).toLocaleString()}
          </time>
        </div>
        <div className="flex items-start gap-1">
          <Button variant="ghost" size="icon" className="size-8" aria-label="Copy diagnostics" onClick={() => void copyError(error).catch(() => toast.error("Copy failed."))}>
            <Copy className="size-3.5" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Create GitHub issue" onClick={() => void reportIssue(error).catch(() => toast.error("Could not open GitHub."))}>
            <Bug className="size-3.5" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Dismiss error" onClick={() => dismissError(error.id)}>
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
      {(error.stack || error.details) && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">Technical details</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all border-l-2 border-border pl-3 font-mono text-[10px] leading-4 text-muted-foreground">
            {error.details}{error.details && error.stack ? "\n\n" : ""}{error.stack}
          </pre>
        </details>
      )}
    </article>
  );
}

export function ErrorLog() {
  const errors = useSyncExternalStore(subscribeErrors, getErrors, getErrors);
  const [filter, setFilter] = useState<Filter>("all");
  const filtered = useMemo(
    () => filter === "all" ? errors : errors.filter((error) => error.category === filter),
    [errors, filter],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3 sm:px-6">
        <div className="flex flex-wrap gap-1" aria-label="Filter errors by category">
          {(["all", ...ERROR_CATEGORIES] as Filter[]).map((category) => {
            const count = category === "all" ? errors.length : errors.filter((error) => error.category === category).length;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setFilter(category)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-medium transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  filter === category ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {category === "all" ? "All" : CATEGORY_LABELS[category]} <span className="font-mono text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <Button variant="ghost" size="sm" disabled={errors.length === 0} onClick={clearErrors} className="text-muted-foreground">
          <Trash2 className="mr-1.5 size-3.5" aria-hidden />
          Clear all
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5 sm:p-6">
          {filtered.length === 0 ? (
            <div className="grid min-h-80 place-items-center text-center">
              <div>
                <CheckCircle2 className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold text-foreground">{errors.length === 0 ? "No errors recorded" : "No errors in this category"}</h3>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  {errors.length === 0 ? "Unexpected app, provider, network, storage, and system failures will appear here." : "Choose another category to inspect the remaining diagnostics."}
                </p>
              </div>
            </div>
          ) : (
            <section aria-label="Recorded errors">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="size-3.5" aria-hidden />
                <span>Review diagnostics before opening a public GitHub issue.</span>
              </div>
              <div>{filtered.map((error) => <ErrorRow key={error.id} error={error} />)}</div>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
