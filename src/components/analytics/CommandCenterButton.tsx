import { useState } from "react";
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

interface CommandCenterButtonProps {
  collapsed?: boolean;
}

export function CommandCenterButton({ collapsed }: CommandCenterButtonProps) {
  const [open, setOpen] = useState(false);

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
