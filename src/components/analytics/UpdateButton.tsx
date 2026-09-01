import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/useTranslation";
import { APP_NAME } from "@/lib/constants";
import { useUpdateStore } from "@/stores/updateStore";

interface UpdateButtonProps {
  collapsed?: boolean;
}

export function UpdateButton({ collapsed }: UpdateButtonProps) {
  const { t } = useTranslation();
  const hasUpdate = useUpdateStore((s) => s.hasUpdate);
  const latestVersion = useUpdateStore((s) => s.latestVersion);

  if (!hasUpdate || !latestVersion) return null;

  const label = t("update.button", { app: APP_NAME, version: latestVersion });

  // Opens "what's new" rather than the browser: the notes are the reason to
  // update, and the installer link lives one button further in.
  const handleClick = () => useUpdateStore.getState().openDialog();

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="icon"
            aria-label={label}
            className="size-8"
            onClick={handleClick}
          >
            <Download className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="default"
      className="w-full justify-start gap-2"
      onClick={handleClick}
    >
      <Download className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
