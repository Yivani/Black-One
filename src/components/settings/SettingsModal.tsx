import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from "react";
import {
  Archive,
  Brain,
  Cpu,
  Hammer,
  Info,
  Keyboard,
  KeyRound,
  MessageSquare,
  Palette,
  ShieldCheck,
  Vibrate,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";
import type { SettingsCategory } from "@/stores/uiStore";

interface CategoryMeta {
  id: SettingsCategory;
  label: string;
  icon: LucideIcon;
  description: string;
  group: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "Theme, typography, and accent color.",
    group: "General",
  },
  {
    id: "haptics",
    label: "Haptics",
    icon: Vibrate,
    description: "Click, finish, and error sounds with volume.",
    group: "General",
  },
  {
    id: "shortcuts",
    label: "Keyboard Shortcuts",
    icon: Keyboard,
    description: "Customize keyboard shortcuts.",
    group: "General",
  },
  {
    id: "model",
    label: "Model",
    icon: Cpu,
    description: "Choose the default model and tune generation.",
    group: "AI & Models",
  },
  {
    id: "providers",
    label: "Providers",
    icon: KeyRound,
    description: "API keys, endpoints, and connections.",
    group: "AI & Models",
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    description: "Composer, timestamps, and message behavior.",
    group: "Conversation",
  },
  {
    id: "memory",
    label: "Memory & Context",
    icon: Brain,
    description: "Context window and long-term memory.",
    group: "Conversation",
  },
  {
    id: "safety",
    label: "Safety",
    icon: ShieldCheck,
    description: "Content filtering and attachment scanning.",
    group: "Conversation",
  },
  {
    id: "tools",
    label: "Tools & Keys",
    icon: Hammer,
    description: "Tool execution permissions and configuration.",
    group: "Conversation",
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: Wrench,
    description: "Developer tools and request customization.",
    group: "System",
  },
  {
    id: "archive",
    label: "Archived Chats",
    icon: Archive,
    description: "Auto-archiving and archived chats.",
    group: "System",
  },
  {
    id: "about",
    label: "About",
    icon: Info,
    description: "Version, updates, and danger zone.",
    group: "System",
  },
];

type SettingsPage = LazyExoticComponent<ComponentType>;

const PAGES: Record<SettingsCategory, SettingsPage> = {
  model: lazy(() =>
    import("@/components/settings/ModelSettings").then((m) => ({
      default: m.ModelSettings,
    })),
  ),
  chat: lazy(() =>
    import("@/components/settings/ChatSettings").then((m) => ({
      default: m.ChatSettings,
    })),
  ),
  appearance: lazy(() =>
    import("@/components/settings/AppearanceSettings").then((m) => ({
      default: m.AppearanceSettings,
    })),
  ),
  safety: lazy(() =>
    import("@/components/settings/SafetySettings").then((m) => ({
      default: m.SafetySettings,
    })),
  ),
  memory: lazy(() =>
    import("@/components/settings/MemorySettings").then((m) => ({
      default: m.MemorySettings,
    })),
  ),
  advanced: lazy(() =>
    import("@/components/settings/AdvancedSettings").then((m) => ({
      default: m.AdvancedSettings,
    })),
  ),
  haptics: lazy(() =>
    import("@/components/settings/HapticSettings").then((m) => ({
      default: m.HapticSettings,
    })),
  ),
  providers: lazy(() =>
    import("@/components/settings/ProviderSettings").then((m) => ({
      default: m.ProviderSettings,
    })),
  ),
  shortcuts: lazy(() =>
    import("@/components/settings/ShortcutSettings").then((m) => ({
      default: m.ShortcutSettings,
    })),
  ),
  tools: lazy(() =>
    import("@/components/settings/ToolSettings").then((m) => ({
      default: m.ToolSettings,
    })),
  ),
  archive: lazy(() =>
    import("@/components/settings/ArchiveSettings").then((m) => ({
      default: m.ArchiveSettings,
    })),
  ),
  about: lazy(() =>
    import("@/components/settings/AboutPage").then((m) => ({
      default: m.AboutPage,
    })),
  ),
};

function PageFallback() {
  return (
    <div className="space-y-3" aria-label="Loading settings">
      <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
      <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
    </div>
  );
}

export function SettingsModal() {
  const open = useUiStore((s) => s.settingsOpen);
  const category = useUiStore((s) => s.settingsCategory);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const setSettingsCategory = useUiStore((s) => s.setSettingsCategory);

  const active = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
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
              {CATEGORIES.reduce<React.ReactNode[]>((acc, { id, label, icon: Icon, group }, index) => {
                const isFirstInGroup = index === 0 || CATEGORIES[index - 1].group !== group;
                if (isFirstInGroup) {
                  acc.push(
                    <div
                      key={`group-${group}`}
                      className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-1"
                    >
                      {group}
                    </div>,
                  );
                }
                acc.push(
                  <Button
                    key={id}
                    variant="ghost"
                    onClick={() => setSettingsCategory(id)}
                    aria-current={id === active.id ? "page" : undefined}
                    className={cn(
                      "h-8 w-full justify-start gap-2.5 px-2.5 text-sm text-muted-foreground",
                      id === active.id && "bg-accent font-medium text-accent-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </Button>,
                );
                return acc;
              }, [])}
            </div>
          </nav>
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-5xl p-6 sm:p-7">
                <header className="mb-6 border-b border-border pb-5 pr-10">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {active.label}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {active.description}
                  </p>
                </header>
                <Suspense fallback={<PageFallback />}>
                  <Page />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
