import { useId, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isTauri } from "@/lib/ipc";
import { persistence } from "@/lib/persistence";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";

const CONFIRM_WORD = "DELETE";

interface DangerActionProps {
  label: string;
  description: string;
  buttonLabel: string;
  warning: string;
  onConfirm: () => Promise<void>;
}

function DangerAction({ label, description, buttonLabel, warning, onConfirm }: DangerActionProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <div className="space-y-0.5 pt-0.5">
        <p className="text-sm">{label}</p>
        <p className="text-xs text-muted-foreground/80">{description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 border-destructive/40 text-destructive/90 hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmation("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{warning}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={inputId}>{`Type ${CONFIRM_WORD} to confirm`}</Label>
            <Input
              id={inputId}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmation !== CONFIRM_WORD || busy}
              onClick={() => void handleConfirm()}
            >
              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {buttonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DangerZone() {
  const loadAll = useSessionStore((s) => s.loadAll);
  const resetAll = useSettingsStore((s) => s.resetAll);

  const uninstall = async () => {
    if (!isTauri) {
      toast.info("Run the desktop build to uninstall.");
      return;
    }
    try {
      await persistence.clearAll();
      await getCurrentWindow().close();
    } catch {
      toast.error("Failed to uninstall.");
    }
  };

  const deleteAllData = async () => {
    try {
      await persistence.clearAll();
      await loadAll();
      toast.success("All data deleted");
      window.location.reload();
    } catch {
      toast.error("Failed to delete all data.");
    }
  };

  const factoryReset = async () => {
    try {
      await resetAll();
      await persistence.clearAll();
      window.location.reload();
    } catch {
      toast.error("Failed to reset to factory defaults.");
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-destructive/40 p-4 text-left">
      <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
      <div className="mt-2 space-y-1">
        <DangerAction
          label="Uninstall Black One"
          description="Remove the app and all of its data from this device."
          buttonLabel="Uninstall"
          warning="This clears every chat, setting, and stored credential, then closes Black One."
          onConfirm={uninstall}
        />
        <DangerAction
          label="Delete All Data"
          description="Erase every chat, message, folder, and setting."
          buttonLabel="Delete All Data"
          warning="This permanently deletes all local data. There is no undo."
          onConfirm={deleteAllData}
        />
        <DangerAction
          label="Reset to Factory Defaults"
          description="Restore the default settings and wipe all data."
          buttonLabel="Reset to Defaults"
          warning="This restores factory settings and permanently deletes all local data."
          onConfirm={factoryReset}
        />
      </div>
    </div>
  );
}
