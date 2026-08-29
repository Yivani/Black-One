import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { KeyboardShortcut } from "@/components/shared/KeyboardShortcut";
import { bindingFromEvent } from "@/hooks/useKeyboardShortcut";
import { useSettings } from "@/hooks/useSettings";
import { SHORTCUT_DEFINITIONS } from "@/lib/constants";

export function ShortcutSettings() {
  const { settings, setShortcut, resetShortcuts } = useSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const stopEditing = () => {
    setEditingId(null);
    setConflict(null);
  };

  const handleCaptureKey = (actionId: string) => (event: KeyboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      stopEditing();
      return;
    }
    const binding = bindingFromEvent(event.nativeEvent);
    if (!binding) return;
    const conflicting = SHORTCUT_DEFINITIONS.find(
      (def) => def.id !== actionId && settings.shortcuts[def.id] === binding,
    );
    if (conflicting) {
      setConflict(conflicting.label);
      return;
    }
    setShortcut(actionId, binding);
    stopEditing();
  };

  return (
    <div className="space-y-6">
      <section className="space-y-1" aria-label="Keyboard shortcuts">
        {SHORTCUT_DEFINITIONS.map((def) => {
          if (editingId === def.id) {
            return (
              <div
                key={def.id}
                tabIndex={0}
                autoFocus
                onKeyDown={handleCaptureKey(def.id)}
                onBlur={stopEditing}
                className="flex items-center justify-between gap-4 rounded-md border border-primary px-3 py-2 outline-none"
              >
                <span className="text-sm">{def.label}</span>
                {conflict ? (
                  <span className="text-xs text-destructive">Conflicts with {conflict}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Press new shortcut…</span>
                )}
              </div>
            );
          }
          return (
            <div
              key={def.id}
              className="flex items-center justify-between gap-4 rounded-md px-3 py-2 transition-standard hover:bg-accent/50"
            >
              <span className="text-sm">{def.label}</span>
              <div className="flex items-center gap-2">
                <KeyboardShortcut binding={settings.shortcuts[def.id] ?? def.defaultBinding} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConflict(null);
                    setEditingId(def.id);
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          );
        })}
      </section>
      <Separator />
      <div className="flex justify-end">
        <Button variant="outline" onClick={resetShortcuts}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
