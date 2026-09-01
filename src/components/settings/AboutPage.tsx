import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DangerZone } from "@/components/settings/DangerZone";
import { Logo } from "@/components/shared/Logo";
import { openExternal } from "@/components/shared/UpdateDialog";
import { useTranslation } from "@/hooks/useTranslation";
import { APP_NAME, APP_TAGLINE, GITHUB_REPO_URL } from "@/lib/constants";
import { ipc, isTauri } from "@/lib/ipc";
import type { AppInfo } from "@/lib/ipc";
import { useUpdateStore } from "@/stores/updateStore";

/**
 * About, and the one place that checks for a new version.
 *
 * There is no in-app install. The published installers are not signed with an
 * updater key, so the plugin's download-and-install could never finish — it
 * used to be tried first here and failed every time. What the check does now
 * is read the release, and hand the user the notes and the installer link.
 */
export function AboutPage() {
  const { t } = useTranslation();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [checked, setChecked] = useState(false);

  const checking = useUpdateStore((s) => s.checking);
  const hasUpdate = useUpdateStore((s) => s.hasUpdate);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const error = useUpdateStore((s) => s.error);
  const openDialog = useUpdateStore((s) => s.openDialog);

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

  const runCheck = async () => {
    if (!isTauri) {
      toast.info(t("about.desktopOnly"));
      return;
    }
    const found = await useUpdateStore.getState().checkNow();
    setChecked(true);
    if (found) openDialog();
  };

  const versionLabel = isTauri ? (appInfo?.version ?? "…") : t("about.webVersion");
  const commitUrl = appInfo?.commitSha
    ? `${GITHUB_REPO_URL}/commit/${appInfo.commitSha}`
    : null;

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="grid size-32 place-items-center rounded-xl bg-[#1E1E28] text-white">
        <Logo size={80} className="text-white" />
      </div>
      <p className="text-lg font-semibold">{APP_NAME}</p>
      <p className="text-xs text-muted-foreground">{APP_TAGLINE}</p>
      <p className="font-mono text-xs text-muted-foreground">{versionLabel}</p>

      <div className="max-w-sm rounded-lg border border-border bg-muted/40 p-3 text-left">
        <p className="text-xs font-medium">{t("about.localTitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("about.localDesc")}</p>
      </div>

      {appInfo?.commitSha && commitUrl && (
        <p className="text-xs text-muted-foreground">
          {t("about.commit")}{" "}
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
        <Button onClick={() => void runCheck()} disabled={checking}>
          {checking && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />}
          {checking ? t("about.checking") : t("about.check")}
        </Button>
        <Button
          variant="outline"
          onClick={() => void openExternal(`${GITHUB_REPO_URL}/releases`)}
        >
          {t("about.releaseNotes")}
        </Button>
      </div>

      {hasUpdate && latestVersion && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge>{t("about.updateAvailable", { version: latestVersion })}</Badge>
          <Button size="sm" onClick={openDialog}>
            <Download className="mr-1.5 size-3.5" aria-hidden />
            {t("about.seeWhatsNew")}
          </Button>
        </div>
      )}

      {checked && !hasUpdate && !error && (
        <Badge variant="secondary">{t("about.upToDate")}</Badge>
      )}

      {error && <Badge variant="destructive">{t("about.checkFailed")}</Badge>}

      <div className="w-full pt-2">
        <DangerZone />
      </div>
    </div>
  );
}
