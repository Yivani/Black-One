import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CommandCenter } from "./CommandCenter";
import { useUiStore } from "@/stores/uiStore";

interface CommandCenterButtonProps {
  collapsed?: boolean;
}

export function CommandCenterButton({ collapsed }: CommandCenterButtonProps) {
  // Shared state so the tray menu and command palette can open this too.
  const open = useUiStore((s) => s.commandCenterOpen);
  const setOpen = useUiStore((s) => s.setCommandCenterOpen);

  const trigger = collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Command Center"
          className="size-8"
        >
          <BarChart3 className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">Command Center</TooltipContent>
    </Tooltip>
  ) : (
    <Button variant="ghost" className="w-full justify-start gap-2">
      <BarChart3 className="size-4" aria-hidden />
      Command Center
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="h-[min(760px,calc(100vh-2rem))] w-[min(1120px,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none">
        <DialogTitle className="sr-only">Command Center</DialogTitle>
        <CommandCenter />
      </DialogContent>
    </Dialog>
  );
}
