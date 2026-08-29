import {
  Box,
  LayoutGrid,
  Maximize,
  Moon,
  PanelLeft,
  PanelRight,
  Plus,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { KeyboardShortcut } from "@/components/shared/KeyboardShortcut";
import { toggleDarkMode } from "@/hooks/useTheme";
import { useModelStore } from "@/stores/modelStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
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
  const providers = useModelStore((s) => s.providers);
  const selectModel = useModelStore((s) => s.selectModel);
  const shortcuts = useSettingsStore((s) => s.settings.shortcuts);

  const close = () => setOpen(false);

  const models = providers
    .filter((provider) => provider.isEnabled)
    .flatMap((provider) =>
      provider.models.map((model) => ({ model, providerName: provider.name })),
    );

  const actions: PaletteAction[] = [
    {
      id: "new-chat",
      label: "New chat",
      icon: Plus,
      shortcut: shortcuts["new-chat"],
      run: () => {
        useSessionStore
          .getState()
          .createSession()
          .catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : String(error)),
          );
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
          <CommandInput placeholder="Search models and actions…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Models">
              {models.map(({ model, providerName }) => (
                <CommandItem
                  key={model.id}
                  value={`${model.name} ${providerName}`}
                  onSelect={() => {
                    selectModel(model.id);
                    close();
                  }}
                >
                  <Box className="size-4 text-muted-foreground" aria-hidden />
                  <span>{model.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{providerName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              {actions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={action.label}
                  onSelect={() => {
                    action.run();
                    close();
                  }}
                >
                  <action.icon className="size-4 text-muted-foreground" aria-hidden />
                  <span>{action.label}</span>
                  {action.shortcut && (
                    <KeyboardShortcut binding={action.shortcut} className="ml-auto" />
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
