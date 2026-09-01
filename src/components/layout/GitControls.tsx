import { useCallback, useEffect, useState } from "react";
import {
  GitBranch,
  GitCommitHorizontal,
  LoaderCircle,
  PenLine,
  Plus,
  RefreshCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { generateCommitMessage } from "@/lib/api";
import { ipc, type GitStatus } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";

export function GitControls({ path }: { path?: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");

  const refresh = useCallback(async () => {
    if (!path) return;
    setBusy("refresh");
    try {
      setStatus(await ipc.gitStatus(path));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }, [path]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const perform = async (
    label: string,
    action: () => Promise<GitStatus>,
    success: string,
  ): Promise<boolean> => {
    setBusy(label);
    try {
      setStatus(await action());
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleGenerate = async () => {
    if (!path) return;
    const selected = useModelStore.getState().getSelectedModel();
    if (!selected) {
      toast.error("Connect an AI provider to generate commit messages.");
      return;
    }

    setBusy("generate");
    try {
      const diff = await ipc.gitDiff(path);
      const apiKey = await useModelStore.getState().getApiKey(selected.provider.id);
      const generated = await generateCommitMessage(
        diff,
        selected.provider,
        selected.model,
        apiKey,
        useSettingsStore.getState().settings.advanced.customHeaders,
      );
      if (!generated) throw new Error("The AI provider did not return a commit message.");
      setMessage(generated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const changeCount = status?.changes.length ?? 0;
  const hasStagedChanges = status?.changes.some(
    (line) => line[0] !== " " && line[0] !== "?",
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={!path}
          aria-label="Git status and actions"
          title={path ? "Git status" : "Attach a folder to use Git"}
          className="relative size-6 text-muted-foreground hover:text-foreground"
        >
          <GitBranch className="size-3.5" aria-hidden />
          {status?.repository && (
            <span
              className={cn(
                "absolute right-0.5 top-0.5 size-1.5 rounded-full ring-2 ring-card",
                changeCount > 0 ? "bg-amber-500" : "bg-emerald-500",
              )}
              aria-hidden
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-[340px] overflow-hidden rounded-lg p-0"
      >
        <div className="flex h-10 items-center justify-between border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <GitBranch className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{status?.repository ? status.branch : "Source control"}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void refresh()}
            disabled={busy !== null}
            aria-label="Refresh Git status"
            className="size-7"
          >
            <RefreshCcw className={cn("size-3.5", busy === "refresh" && "animate-spin")} aria-hidden />
          </Button>
        </div>

        {busy === "refresh" && !status ? (
          <div className="space-y-2 p-4" aria-label="Loading Git status">
            <div className="h-3 w-32 animate-pulse rounded-sm bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded-sm bg-muted" />
          </div>
        ) : status && !status.repository ? (
          <div className="p-4">
            <p className="text-sm font-medium">No Git repository</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Initialize this folder to start tracking its files.
            </p>
            <Button
              size="sm"
              className="mt-3 w-full"
              disabled={busy !== null || !path}
              onClick={() =>
                path && void perform("init", () => ipc.gitInit(path), "Git repository initialized.")
              }
            >
              {busy === "init" ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
              Initialize Git
            </Button>
          </div>
        ) : status?.repository ? (
          <div>
            <div className="border-b border-border px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Working tree</span>
                <span className="font-medium tabular-nums">
                  {changeCount === 0 ? "Clean" : `${changeCount} change${changeCount === 1 ? "" : "s"}`}
                </span>
              </div>
              {changeCount > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto font-mono text-[11px] leading-5 text-muted-foreground">
                  {status.changes.slice(0, 8).map((change) => (
                    <div key={change} className="truncate">{change}</div>
                  ))}
                  {changeCount > 8 && <div>+ {changeCount - 8} more</div>}
                </div>
              )}
            </div>

            <div className="space-y-3 p-3">
              <div>
                <label htmlFor="git-commit-message" className="text-xs font-medium">
                  Commit message
                </label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="git-commit-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe the change"
                    maxLength={200}
                    className="h-8 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleGenerate()}
                    disabled={busy !== null || changeCount === 0}
                    aria-label="Generate commit message with AI"
                  >
                    {busy === "generate" ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <PenLine className="size-3.5" aria-hidden />}
                    Generate
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Generate sends a bounded diff to your selected AI provider.
                </p>
              </div>

              {!status.remoteUrl ? (
                <div>
                  <label htmlFor="git-remote-url" className="text-xs font-medium">
                    Origin remote
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      id="git-remote-url"
                      value={remoteUrl}
                      onChange={(event) => setRemoteUrl(event.target.value)}
                      placeholder="https://github.com/user/repo.git"
                      className="h-8 text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null || !remoteUrl.trim() || !path}
                      onClick={() =>
                        path && void perform(
                          "remote",
                          () => ipc.gitSetRemote(path, remoteUrl.trim()),
                          "Origin remote saved.",
                        )
                      }
                    >
                      Set
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="truncate text-[11px] text-muted-foreground" title={status.remoteUrl}>
                  origin: {status.remoteUrl}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border bg-muted/20 p-3">
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null || changeCount === 0 || !path}
                onClick={() =>
                  path && void perform("stage", () => ipc.gitStageAll(path), "All changes staged.")
                }
              >
                <Plus className="size-3.5" aria-hidden />
                Stage all
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null || !hasStagedChanges || !message.trim() || !path}
                onClick={() => {
                  if (!path) return;
                  void perform(
                    "commit",
                    () => ipc.gitCommit(path, message.trim()),
                    "Changes committed.",
                  ).then((committed) => {
                    if (committed) setMessage("");
                  });
                }}
              >
                <GitCommitHorizontal className="size-3.5" aria-hidden />
                Commit
              </Button>
              <Button
                size="sm"
                disabled={busy !== null || !status.remoteUrl || !path}
                onClick={() =>
                  path && void perform("push", () => ipc.gitPush(path), "Changes pushed.")
                }
              >
                <Upload className="size-3.5" aria-hidden />
                Push
              </Button>
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
