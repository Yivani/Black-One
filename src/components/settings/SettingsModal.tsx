import { useMemo, useState, type ComponentType } from "react";
import {
  Bell,
  Bot,
  Brain,
  Cpu,
  Info,
  Keyboard,
  MessagesSquare,
  Palette,
  Search,
  SlidersHorizontal,
  Terminal,
  TerminalSquare,
  Vibrate,
  type LucideIcon,
} from "lucide-react";
import { AboutPage } from "@/components/settings/AboutPage";
import { AdvancedSettings } from "@/components/settings/AdvancedSettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { ChatSettings } from "@/components/settings/ChatSettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { HapticSettings } from "@/components/settings/HapticSettings";
import { MemorySettings } from "@/components/settings/MemorySettings";
import { ModelSettings } from "@/components/settings/ModelSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ProviderSettings } from "@/components/settings/ProviderSettings";
import { ShortcutSettings } from "@/components/settings/ShortcutSettings";
import { ToolSettings } from "@/components/settings/ToolSettings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useUiStore, type SettingsCategory } from "@/stores/uiStore";
import type { TranslationKey } from "@/locales";

/**
 * Settings are grouped by what the user is trying to change rather than by
 * which store holds the value: what the workspace looks and feels like, how the
 * agent thinks and what it may touch, and how the app sits on the machine.
 */
type GroupId = "workspace" | "intelligence" | "system";

interface CategoryMeta {
  id: SettingsCategory;
  group: GroupId;
  icon: LucideIcon;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  /** Extra English terms the search box should match, beyond the label. */
  keywords: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    id: "general",
    group: "workspace",
    icon: SlidersHorizontal,
    labelKey: "settings.general",
    descriptionKey: "settings.generalDesc",
    keywords: "language german spanish deutsch español timezone startup tray autostart windows launch login update",
  },
  {
    id: "appearance",
    group: "workspace",
    icon: Palette,
    labelKey: "settings.appearance",
    descriptionKey: "settings.appearanceDesc",
    keywords: "theme dark light font size accent color layout sidebar",
  },
  {
    id: "chat",
    group: "workspace",
    icon: MessagesSquare,
    labelKey: "settings.chat",
    descriptionKey: "settings.chatDesc",
    keywords: "send enter timestamps code theme personality system prompt images attachments",
  },
  {
    id: "models",
    group: "intelligence",
    icon: Cpu,
    labelKey: "settings.models",
    descriptionKey: "settings.modelsDesc",
    keywords: "temperature tokens top-p reasoning effort thinking picker visible",
  },
  {
    id: "tools",
    group: "intelligence",
    icon: Bot,
    labelKey: "settings.tools",
    descriptionKey: "settings.toolsDesc",
    keywords: "permission approve yolo manual shell file agent tools blocked",
  },
  {
    id: "memory",
    group: "intelligence",
    icon: Brain,
    labelKey: "settings.memory",
    descriptionKey: "settings.memoryDesc",
    keywords: "memory bank recall export context",
  },
  {
    id: "notifications",
    group: "system",
    icon: Bell,
    labelKey: "settings.notifications",
    descriptionKey: "settings.notificationsDesc",
    keywords: "desktop alerts sounds quiet hours do not disturb dnd approval",
  },
  {
    id: "haptics",
    group: "system",
    icon: Vibrate,
    labelKey: "settings.haptics",
    descriptionKey: "settings.hapticsDesc",
    keywords: "sound click finish error volume vibration",
  },
  {
    id: "shortcuts",
    group: "system",
    icon: Keyboard,
    labelKey: "settings.shortcuts",
    descriptionKey: "settings.shortcutsDesc",
    keywords: "keyboard shortcut binding hotkey quick chat terminal",
  },
  {
    id: "providers",
    group: "system",
    icon: TerminalSquare,
    labelKey: "settings.cliTools",
    descriptionKey: "settings.cliToolsDesc",
    keywords: "cli install update remove claude codex gemini agent binary",
  },
  {
    id: "advanced",
    group: "system",
    icon: Terminal,
    labelKey: "settings.advanced",
    descriptionKey: "settings.advancedDesc",
    keywords: "developer diagnostics raw responses log level custom headers",
  },
  {
    id: "about",
    group: "system",
    icon: Info,
    labelKey: "settings.about",
    descriptionKey: "settings.aboutDesc",
    keywords: "version update data folder reset factory license",
  },
];

const GROUP_LABELS: Record<GroupId, TranslationKey> = {
  workspace: "settings.groupWorkspace",
  intelligence: "settings.groupIntelligence",
  system: "settings.groupSystem",
};

const GROUP_ORDER: GroupId[] = ["workspace", "intelligence", "system"];

const PAGES: Record<SettingsCategory, ComponentType> = {
  general: GeneralSettings,
  appearance: AppearanceSettings,
  chat: ChatSettings,
  models: ModelSettings,
  tools: ToolSettings,
  memory: MemorySettings,
  notifications: NotificationSettings,
  haptics: HapticSettings,
  shortcuts: ShortcutSettings,
  providers: ProviderSettings,
  advanced: AdvancedSettings,
  about: AboutPage,
};

export function SettingsModal() {
  const open = useUiStore((s) => s.settingsOpen);
  const category = useUiStore((s) => s.settingsCategory);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const setSettingsCategory = useUiStore((s) => s.setSettingsCategory);
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  // Search matches the translated label and description plus a list of English
  // keywords, so "german" finds General even while the UI is in German.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return CATEGORIES;
    return CATEGORIES.filter((item) =>
      `${t(item.labelKey)} ${t(item.descriptionKey)} ${item.keywords}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query, t]);

  const active = CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0];
  const Page = PAGES[active.id];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          closeSettings();
        }
      }}
    >
      <DialogContent className="h-[min(820px,calc(100vh-48px))] w-[min(1120px,calc(100vw-48px))] max-w-none gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none">
        <DialogTitle className="sr-only">{t("settings.title")}</DialogTitle>
        <div className="flex h-full min-h-0">
          <nav
            aria-label={t("settings.title")}
            className="flex w-60 shrink-0 flex-col border-r border-border bg-muted/15"
          >
            <div className="px-3 pb-2 pt-4">
              <div className="px-1 pb-3 text-sm font-semibold tracking-tight">
                {APP_NAME}
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("settings.search")}
                  aria-label={t("settings.search")}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
              {matches.length === 0 && (
                <p className="px-1 pt-2 text-xs text-muted-foreground">
                  {t("settings.noMatches", { query: query.trim() })}
                </p>
              )}
              {GROUP_ORDER.map((group) => {
                const items = matches.filter((item) => item.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <h3 className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                      {t(GROUP_LABELS[group])}
                    </h3>
                    <div className="flex flex-col gap-0.5">
                      {items.map(({ id, labelKey, icon: Icon }) => (
                        <Button
                          key={id}
                          variant="ghost"
                          onClick={() => setSettingsCategory(id)}
                          aria-current={id === active.id ? "page" : undefined}
                          className={cn(
                            "h-8 w-full justify-start gap-2.5 px-2 text-sm font-normal text-muted-foreground",
                            id === active.id &&
                              "bg-accent font-medium text-accent-foreground",
                          )}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden />
                          <span className="truncate">{t(labelKey)}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-4xl p-6 sm:p-8">
              <header className="mb-7 border-b border-border pb-5 pr-10">
                <h2 className="text-xl font-semibold tracking-tight">
                  {t(active.labelKey)}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(active.descriptionKey)}
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
