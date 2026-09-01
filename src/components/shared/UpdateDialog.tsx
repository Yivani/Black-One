import { Download, ExternalLink, Info } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/hooks/useTranslation";
import { APP_NAME } from "@/lib/constants";
import { isTauri } from "@/lib/ipc";
import { formatBytes } from "@/lib/updateCore";
import { useUpdateStore } from "@/stores/updateStore";

export async function openExternal(url: string): Promise<void> {
  if (isTauri) {
    try {
      await openUrl(url);
      return;
    } catch {
      toast.error("Failed to open the link.");
      return;
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** "31 August 2026", in the user's own locale. */
function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * What's new, and where to get it.
 *
 * Deliberately not an installer: the download opens in the browser and the
 * user runs it themselves. Black One's builds carry no updater signature, so
 * an in-app install would fail at the last step — and a button that fails
 * every time is worse than no button.
 */
export function UpdateDialog() {
  const { t, locale } = useTranslation();
  const open = useUpdateStore((s) => s.dialogOpen);
  const closeDialog = useUpdateStore((s) => s.closeDialog);
  const version = useUpdateStore((s) => s.latestVersion);
  const releaseName = useUpdateStore((s) => s.releaseName);
  const notes = useUpdateStore((s) => s.notes);
  const publishedAt = useUpdateStore((s) => s.publishedAt);
  const pageUrl = useUpdateStore((s) => s.pageUrl);
  const installer = useUpdateStore((s) => s.installer);

  const published = formatDate(publishedAt, locale);
  // A title that just repeats the version adds nothing above the heading.
  const subtitle =
    releaseName && releaseName.replace(/^v/i, "") !== version ? releaseName : "";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t("update.title", { app: APP_NAME, version: version ?? "" })}
          </DialogTitle>
          <DialogDescription>
            {subtitle || t("update.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {published && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{published}</Badge>
          </div>
        )}

        <ScrollArea className="max-h-[46vh] rounded-lg border border-border bg-muted/20 p-3">
          {notes ? (
            <MarkdownRenderer content={notes} className="space-y-2 text-sm" />
          ) : (
            <p className="text-sm text-muted-foreground">{t("update.noNotes")}</p>
          )}
        </ScrollArea>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("update.manualNote")}
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => void openExternal(pageUrl)}>
            <ExternalLink className="mr-1.5 size-3.5" aria-hidden />
            {t("update.viewOnGithub")}
          </Button>
          {installer ? (
            <Button
              onClick={() => {
                void openExternal(installer.url);
                closeDialog();
              }}
            >
              <Download className="mr-1.5 size-3.5" aria-hidden />
              {t("update.download", { size: formatBytes(installer.size) })}
            </Button>
          ) : (
            <Button
              onClick={() => {
                void openExternal(pageUrl);
                closeDialog();
              }}
            >
              <Download className="mr-1.5 size-3.5" aria-hidden />
              {t("update.openReleases")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
