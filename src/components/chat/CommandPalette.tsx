import {
  LayoutGrid,
  Maximize,
  Moon,
  PanelLeft,
  PanelRight,
  Settings,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react";
import { KeyboardShortcut } from "@/components/shared/KeyboardShortcut";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toggleDarkMode } from "@/hooks/useTheme";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useUiStore } from "@/stores/uiStore";

interface PaletteAction {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const shortcuts = useSettingsStore((s) => s.settings.shortcuts);

  const actions: PaletteAction[] = [
    {
      id: "new-terminal",
      label: "New terminal",
      icon: TerminalSquare,
      shortcut: shortcuts["new-terminal"],
      run: () => {
        useUiStore.getState().setViewMode("code");
        void useTerminalStore.getState().createTerminal();
      },
    },
    {
      id: "toggle-sidebar",
      label: "Toggle sidebar",
      icon: PanelLeft,
      shortcut: shortcuts["toggle-sidebar"],
      run: () => useUiStore.getState().toggleSidebar(),
    },
    {
      id: "toggle-right-sidebar",
      label: "Toggle right sidebar",
      icon: PanelRight,
      shortcut: shortcuts["toggle-right-sidebar"],
      run: () => useUiStore.getState().toggleRightPanel(),
    },
    {
      id: "toggle-dark-mode",
      label: "Toggle dark mode",
      icon: Moon,
      shortcut: shortcuts["toggle-dark-mode"],
      run: () => toggleDarkMode(),
    },
    {
      id: "zen-mode",
      label: "Zen mode",
      icon: Maximize,
      shortcut: shortcuts["zen-mode"],
      run: () => useUiStore.getState().toggleZenMode(),
    },
    {
      id: "edit-layout",
      label: "Edit layout",
      icon: LayoutGrid,
      run: () => useUiStore.getState().setLayoutEditing(true),
    },
    {
      id: "open-settings",
      label: "Open settings",
      icon: Settings,
      shortcut: shortcuts["open-settings"],
      run: () => useUiStore.getState().openSettings(),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg overflow-hidden rounded-xl p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command>
          <CommandInput placeholder="Search actions..." />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Actions">
              {actions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={action.label}
                  onSelect={() => {
                    action.run();
                    setOpen(false);
                  }}
                >
                  <action.icon
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  <span>{action.label}</span>
                  {action.shortcut && (
                    <KeyboardShortcut
                      binding={action.shortcut}
                      className="ml-auto"
                    />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
