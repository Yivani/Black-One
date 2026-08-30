import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpdateStore } from "@/stores/updateStore";

interface UpdateButtonProps {
  collapsed?: boolean;
}

export function UpdateButton({ collapsed }: UpdateButtonProps) {
  const hasUpdate = useUpdateStore((s) => s.hasUpdate);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const commitSha = useUpdateStore((s) => s.commitSha);

  if (!hasUpdate || !latestVersion) return null;

  const label = commitSha
    ? `Update Black One v${latestVersion} (${commitSha})`
    : `Update Black One v${latestVersion}`;

  const handleClick = () => {
    window.open(
      "https://github.com/Yivani/Black-One/releases/latest",
      "_blank",
      "noopener,noreferrer",
    );
  };

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
