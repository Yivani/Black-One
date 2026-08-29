import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DangerZone } from "@/components/settings/DangerZone";
import { Logo } from "@/components/shared/Logo";
import { APP_NAME, APP_TAGLINE, GITHUB_REPO_URL } from "@/lib/constants";
import { ipc, isTauri } from "@/lib/ipc";
import type { AppInfo, UpdateCheckResult } from "@/lib/ipc";

async function openExternal(url: string): Promise<void> {
  if (isTauri) {
    try {
      await openUrl(url);
    } catch {
      toast.error("Failed to open the link.");
    }
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "installing" | "installed" | "error";

export function AboutPage() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [progress, setProgress] = useState(0);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    ipc
      .getAppInfo()
      .then((info) => {
        if (!cancelled) setAppInfo(info);
      })
      .catch(() => {
        // Version display is cosmetic; ignore lookup failures.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const checkForUpdates = async () => {
    if (!isTauri) {
      toast.info("Update checks run in the desktop build.");
      return;
    }
    setPhase("checking");
    setProgress(0);
    setPendingUpdate(null);
    try {
      // Prefer the native updater plugin; fall back to the manual GitHub release check.
      const update = await check();
      if (update) {
        setPendingUpdate(update);
        setUpdateResult({
          status: "available",
          latest: `v${update.version}`,
          notes: update.body ?? null,
        });
        setPhase("available");
        return;
      }

      const result = await ipc.checkForUpdates();
      setUpdateResult(result);
      if (result.status === "error") {
        setPhase("error");
        toast.error("Update check failed.");
      } else if (result.status === "available") {
        setPhase("available");
      } else {
        setPhase("idle");
      }
    } catch {
      setPhase("error");
      setUpdateResult({ status: "error", latest: null, notes: null });
      toast.error("Update check failed.");
    }
  };

  const installUpdate = async () => {
    if (!isTauri) return;

    if (pendingUpdate) {
      setPhase("downloading");
      try {
        await pendingUpdate.downloadAndInstall((event) => {
          switch (event.event) {
            case "Started":
              setPhase("downloading");
              setProgress(0);
              break;
            case "Progress":
              setProgress((prev) => prev + event.data.chunkLength);
              break;
            case "Finished":
              setPhase("installed");
              break;
          }
        });
        setPhase("installed");
        toast.success("Update installed. Restart Black One to finish.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setPhase("error");
        setUpdateResult((prev) => ({
          ...prev,
          status: "error",
          notes: message,
        }));
        toast.error(`Update failed: ${message}`);
      }
      return;
    }

    // Fallback when only the manual check returned a newer tag.
    toast.info("Please download the latest installer from GitHub Releases.");
    void openExternal(`${GITHUB_REPO_URL}/releases`);
  };

  const versionLabel = isTauri ? (appInfo ? appInfo.version : "…") : "1.0.0 (web)";
  const commitUrl = appInfo?.commitSha
    ? `${GITHUB_REPO_URL}/commit/${appInfo.commitSha}`
    : null;
  const notes = updateResult?.notes?.trim() ?? "";

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="grid size-32 place-items-center rounded-xl bg-[#1E1E28] text-white">
        <Logo size={80} className="text-white" />
      </div>
      <p className="text-lg font-semibold">{APP_NAME}</p>
      <p className="text-xs text-muted-foreground">{APP_TAGLINE}</p>
      <p className="font-mono text-xs text-muted-foreground">{versionLabel}</p>
      <div className="max-w-sm rounded-lg border border-border bg-muted/40 p-3 text-left">
        <p className="text-xs font-medium">Local & private</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Chats, settings, and memories are stored locally on this device.
          {isTauri && " API keys are kept in the operating-system keychain."}
        </p>
      </div>
      {appInfo?.commitSha && commitUrl && (
        <p className="text-xs text-muted-foreground">
          GitHub Commit{" "}
          <a
            href={commitUrl}
            onClick={(event) => {
              event.preventDefault();
              void openExternal(commitUrl);
            }}
            className="font-mono text-primary hover:underline"
          >
            {appInfo.commitSha.slice(0, 7)}
          </a>
        </p>
      )}
      <div className="flex items-center gap-2 pt-2">
        <Button
          onClick={() => void checkForUpdates()}
          disabled={phase === "checking" || phase === "downloading" || phase === "installing"}
        >
          {phase === "checking" && (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
          )}
          {phase === "checking" ? "Checking…" : "Check for Updates"}
        </Button>
        <Button
          variant="outline"
          onClick={() => void openExternal(`${GITHUB_REPO_URL}/releases`)}
        >
          Release Notes
        </Button>
      </div>

      {phase === "available" && updateResult?.status === "available" && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge>Update available: {updateResult.latest}</Badge>
          <Button size="sm" onClick={() => void installUpdate()}>
            <Download className="mr-1.5 size-3.5" aria-hidden />
            Download & Install
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNotesOpen(true)}>
            See What's New
          </Button>
        </div>
      )}

      {(phase === "downloading" || phase === "installing") && (
        <div className="flex flex-col items-center gap-1.5">
          <Badge variant="secondary">
            {phase === "downloading" ? "Downloading update…" : "Installing update…"}
          </Badge>
          {progress > 0 && (
            <p className="text-xs text-muted-foreground">
              {Math.round(progress / 1024 / 1024)} MB received
            </p>
          )}
        </div>
      )}

      {phase === "installed" && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant="outline" className="text-green-600">
            Update installed
          </Badge>
          <Button
            size="sm"
            onClick={() => {
              if (isTauri) {
                void ipc.relaunchApp();
              } else {
                window.location.reload();
              }
            }}
          >
            <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
            Restart Now
          </Button>
        </div>
      )}

      {phase === "error" && (
        <Badge variant="destructive">Update check failed</Badge>
      )}

      {phase === "idle" && updateResult?.status === "up-to-date" && (
        <Badge variant="secondary">You're up to date</Badge>
      )}

      <div className="mt-2 max-h-48 w-full overflow-auto whitespace-pre-wrap rounded-lg border border-border p-4 text-left font-mono text-xs text-muted-foreground">
        {notes || "No release notes loaded. Check for updates to fetch the latest notes."}
      </div>
      <div className="w-full">
        <DangerZone />
      </div>
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>What's New</DialogTitle>
          </DialogHeader>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
            {notes || "No release notes."}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
