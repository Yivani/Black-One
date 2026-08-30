import type { ComponentType } from "react";
import {
  Brain,
  Info,
  Keyboard,
  Palette,
  Settings2,
  TerminalSquare,
  Vibrate,
  type LucideIcon,
} from "lucide-react";
import { AboutPage } from "@/components/settings/AboutPage";
import { AdvancedSettings } from "@/components/settings/AdvancedSettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { HapticSettings } from "@/components/settings/HapticSettings";
import { MemorySettings } from "@/components/settings/MemorySettings";
import { ProviderSettings } from "@/components/settings/ProviderSettings";
import { ShortcutSettings } from "@/components/settings/ShortcutSettings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useUiStore,
  type SettingsCategory,
} from "@/stores/uiStore";

interface CategoryMeta {
  id: SettingsCategory;
  label: string;
  icon: LucideIcon;
  description: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "Theme, typography, layout, and accent color.",
  },
  {
    id: "haptics",
    label: "Haptics",
    icon: Vibrate,
    description: "Click, finish, and error feedback.",
  },
  {
    id: "shortcuts",
    label: "Keyboard Shortcuts",
    icon: Keyboard,
    description: "Customize terminal and workspace shortcuts.",
  },
  {
    id: "providers",
    label: "CLI Tools",
    icon: TerminalSquare,
    description: "Install, update, or remove terminal coding agents.",
  },
  {
    id: "memory",
    label: "Memory",
    icon: Brain,
    description: "Inspect and export local saved memory.",
  },
  {
    id: "advanced",
    label: "System",
    icon: Settings2,
    description: "Startup, tray, and diagnostic behavior.",
  },
  {
    id: "about",
    label: "About",
    icon: Info,
    description: "Version, updates, local data, and reset controls.",
  },
];

const PAGES: Record<SettingsCategory, ComponentType> = {
  appearance: AppearanceSettings,
  haptics: HapticSettings,
  shortcuts: ShortcutSettings,
  providers: ProviderSettings,
  memory: MemorySettings,
  advanced: AdvancedSettings,
  about: AboutPage,
};

export function SettingsModal() {
  const open = useUiStore((s) => s.settingsOpen);
  const category = useUiStore((s) => s.settingsCategory);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const setSettingsCategory = useUiStore((s) => s.setSettingsCategory);

  const active = CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0];
  const Page = PAGES[active.id];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeSettings();
      }}
    >
      <DialogContent className="h-[min(820px,calc(100vh-48px))] w-[min(1120px,calc(100vw-48px))] max-w-none gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex h-full min-h-0">
          <nav
            aria-label="Settings categories"
            className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/15 p-3"
          >
            <div className="px-3 pb-4 pt-3 text-sm font-semibold tracking-tight">
              Black One
            </div>
            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
              {CATEGORIES.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant="ghost"
                  onClick={() => setSettingsCategory(id)}
                  aria-current={id === active.id ? "page" : undefined}
                  className={cn(
                    "h-9 w-full justify-start gap-2.5 px-2.5 text-sm text-muted-foreground",
                    id === active.id &&
                      "bg-accent font-medium text-accent-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Button>
              ))}
            </div>
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-5xl p-6 sm:p-7">
              <header className="mb-6 border-b border-border pb-5 pr-10">
                <h2 className="text-xl font-semibold tracking-tight">
                  {active.label}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {active.description}
                </p>
              </header>
              <Page />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
