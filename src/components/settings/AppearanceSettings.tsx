import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, Monitor, Moon, Palette, PanelLeft, PanelRight, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSettings } from "@/hooks/useSettings";
import { useTranslation } from "@/hooks/useTranslation";
import { useResolvedDark } from "@/hooks/useTheme";
import { ACCENT_COLORS } from "@/lib/constants";
import { THEME_PRESETS, type ThemePreset } from "@/lib/themes";
import { cn, hexToHsl } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";
import type { TranslationKey } from "@/locales";
import type { FontSize, SidebarPosition, ThemeMode } from "@/types/settings";

/**
 * Themes shown before the list has to be asked for.
 *
 * Twenty-one swatch cards is a wall; six is a choice. The rest are one click
 * away, and the page the user is already on is never cut off — see below.
 */
const THEMES_PER_PAGE = 6;

const THEME_OPTIONS: Array<{ id: ThemeMode; labelKey: TranslationKey; icon: LucideIcon }> = [
  { id: "light", labelKey: "appearance.themeLight", icon: Sun },
  { id: "dark", labelKey: "appearance.themeDark", icon: Moon },
  { id: "system", labelKey: "appearance.themeSystem", icon: Monitor },
];

const FONT_SIZE_OPTIONS: Array<{ id: FontSize; labelKey: TranslationKey; glyphClass: string }> = [
  { id: "small", labelKey: "appearance.fontSmall", glyphClass: "text-xs" },
  { id: "medium", labelKey: "appearance.fontMedium", glyphClass: "text-sm" },
  { id: "large", labelKey: "appearance.fontLarge", glyphClass: "text-base" },
];

const SIDEBAR_OPTIONS: Array<{ id: SidebarPosition; labelKey: TranslationKey; icon: LucideIcon }> = [
  { id: "left", labelKey: "appearance.left", icon: PanelLeft },
  { id: "right", labelKey: "appearance.right", icon: PanelRight },
];

const PANEL_OPTIONS: Array<{ id: SidebarPosition; labelKey: TranslationKey; icon: LucideIcon }> = [
  { id: "left", labelKey: "appearance.left", icon: PanelLeft },
  { id: "right", labelKey: "appearance.right", icon: PanelRight },
];

function isLightHex(hex: string): boolean {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return false;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function CustomAccentButton({
  selected,
  value,
  onChange,
}: {
  selected: boolean;
  value?: string;
  onChange: (hex: string) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(value ?? "#6366f1");
  const isValid = useMemo(() => hexToHsl(text) !== null, [text]);
  const displayColor = isValid ? text : "#6366f1";
  const iconLight = useMemo(() => isLightHex(displayColor), [displayColor]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={t("appearance.custom")}
          onClick={() => onChange(text)}
          style={{ backgroundColor: displayColor }}
          className={cn(
            "relative flex size-7 items-center justify-center overflow-hidden rounded-md border border-border transition-standard",
            selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
          )}
        >
          <Palette
            className={cn(
              "pointer-events-none relative z-10 size-4 drop-shadow-sm",
              iconLight ? "text-black/70" : "text-white/90",
            )}
            aria-hidden
          />
          <input
            type="color"
            value={displayColor}
            onChange={(event) => {
              setText(event.target.value);
              onChange(event.target.value);
            }}
            onClick={(event) => event.stopPropagation()}
            aria-label="Choose custom accent color"
            className="absolute -inset-2 z-20 size-[200%] cursor-pointer opacity-0"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>{t("appearance.custom")}</TooltipContent>
    </Tooltip>
  );
}

function ThemePreview({ preset, dark }: { preset: ThemePreset; dark: boolean }) {
  const colors = dark ? preset.dark : preset.light;
  const c = (key: keyof typeof colors) => `hsl(${colors[key]})`;

  return (
    <div
      className="h-20 w-full overflow-hidden rounded-md border"
      style={{ borderColor: c("--border"), backgroundColor: c("--background") }}
    >
      <div className="flex h-full">
        <div
          className="w-5 border-r"
          style={{ backgroundColor: c("--secondary"), borderColor: c("--border") }}
        />
        <div className="flex flex-1 flex-col gap-1.5 p-1.5" style={{ backgroundColor: c("--card") }}>
          <div className="flex items-center justify-between gap-1.5">
            <div
              className="h-1.5 w-10 rounded-sm"
              style={{ backgroundColor: c("--foreground") }}
            />
            <div
              className="h-1.5 w-4 rounded-sm"
              style={{ backgroundColor: c("--primary") }}
            />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-1">
            <div className="flex">
              <div
                className="h-5 w-16 rounded-md rounded-tl-none"
                style={{ backgroundColor: c("--muted") }}
              />
            </div>
            <div className="flex justify-end">
              <div
                className="h-5 w-14 rounded-md rounded-tr-none"
                style={{ backgroundColor: c("--primary") }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="h-2.5 flex-1 rounded-sm"
              style={{ backgroundColor: c("--input") }}
            />
            <div
              className="h-2.5 w-5 rounded-sm"
              style={{ backgroundColor: c("--accent") }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { t } = useTranslation();
  const { settings, updateSection } = useSettings();
  const dark = useResolvedDark();
  const setSidebarPosition = useUiStore((s) => s.setSidebarPosition);
  const setRightPanelPosition = useUiStore((s) => s.setRightPanelPosition);

  // Collapsed far enough to show the theme in use. Opening this panel and not
  // finding your own theme would read as it having been lost.
  const collapsedThemes = useMemo(() => {
    const selected = THEME_PRESETS.findIndex(
      (preset) => preset.id === settings.appearance.themePreset,
    );
    const pages = Math.ceil((Math.max(selected, 0) + 1) / THEMES_PER_PAGE);
    return Math.min(pages * THEMES_PER_PAGE, THEME_PRESETS.length);
  }, [settings.appearance.themePreset]);
  const [visibleThemes, setVisibleThemes] = useState(collapsedThemes);

  const shownThemes = THEME_PRESETS.slice(0, visibleThemes);
  const hiddenThemes = THEME_PRESETS.length - shownThemes.length;

  const handleSidebarPosition = (position: SidebarPosition) => {
    updateSection("appearance", { sidebarPosition: position });
    setSidebarPosition(position);
  };

  const handleRightPanelPosition = (position: SidebarPosition) => {
    updateSection("appearance", { rightPanelPosition: position });
    setRightPanelPosition(position);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium leading-none">{t("appearance.theme")}</p>
        <div role="radiogroup" aria-label={t("appearance.theme")} className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ id, labelKey, icon: Icon }) => {
            const selected = settings.appearance.theme === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => updateSection("appearance", { theme: id })}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-standard hover:bg-accent/50",
                  selected && "border-primary ring-1 ring-primary",
                )}
              >
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <span className="text-xs font-medium">{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </section>
      <Separator />
      <section className="space-y-2">
        <p className="text-sm font-medium leading-none">{t("appearance.colorTheme")}</p>
        <div
          role="radiogroup"
          aria-label={t("appearance.colorTheme")}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {shownThemes.map((preset) => {
            const selected = settings.appearance.themePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${preset.label} color theme`}
                onClick={() =>
                  updateSection("appearance", {
                    themePreset: preset.id,
                  })
                }
                className={cn(
                  "flex flex-col gap-2 rounded-lg border border-border p-3 text-left transition-standard hover:bg-accent/50",
                  selected && "border-primary ring-1 ring-primary",
                )}
              >
                <ThemePreview preset={preset} dark={dark} />
                <div className="space-y-0.5">
                  <span className="text-xs font-medium">{preset.label}</span>
                  {preset.description && (
                    <span className="block line-clamp-2 text-[10px] text-muted-foreground">
                      {preset.description}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {hiddenThemes > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() =>
              setVisibleThemes((count) => count + THEMES_PER_PAGE)
            }
          >
            <ChevronDown className="mr-1 size-3.5" aria-hidden />
            {t("appearance.showMoreThemes", {
              count: Math.min(hiddenThemes, THEMES_PER_PAGE),
            })}
          </Button>
        ) : (
          THEME_PRESETS.length > collapsedThemes && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs"
              onClick={() => setVisibleThemes(collapsedThemes)}
            >
              <ChevronDown className="mr-1 size-3.5 rotate-180" aria-hidden />
              {t("appearance.showLessThemes")}
            </Button>
          )
        )}
      </section>
      <Separator />
      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">{t("appearance.fontSize")}</p>
          <div
            role="radiogroup"
            aria-label={t("appearance.fontSize")}
            className="inline-flex rounded-md border border-border p-0.5"
          >
            {FONT_SIZE_OPTIONS.map((option) => {
              const selected = settings.appearance.fontSize === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => updateSection("appearance", { fontSize: option.id })}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-3 py-1 transition-standard",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn("font-semibold leading-none", option.glyphClass)} aria-hidden>
                    aA
                  </span>
                  <span className="text-xs">{t(option.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">{t("appearance.sidebarPosition")}</p>
          <div
            role="radiogroup"
            aria-label={t("appearance.sidebarPosition")}
            className="inline-flex rounded-md border border-border p-0.5"
          >
            {SIDEBAR_OPTIONS.map(({ id, labelKey, icon: Icon }) => {
              const selected = settings.appearance.sidebarPosition === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleSidebarPosition(id)}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-3 py-1 text-xs transition-standard",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">{t("appearance.rightPanelPosition")}</p>
          <div
            role="radiogroup"
            aria-label={t("appearance.rightPanelPosition")}
            className="inline-flex rounded-md border border-border p-0.5"
          >
            {PANEL_OPTIONS.map(({ id, labelKey, icon: Icon }) => {
              const selected = settings.appearance.rightPanelPosition === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleRightPanelPosition(id)}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-3 py-1 text-xs transition-standard",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <Separator />
      <section className="space-y-4">
        <div className="space-y-3">
          <p className="text-sm font-medium leading-none">{t("appearance.accentColor")}</p>
          <TooltipProvider>
            <div role="radiogroup" aria-label={t("appearance.accentColor")} className="flex flex-wrap gap-2">
              {ACCENT_COLORS.map((preset) => {
                const selected = settings.appearance.accentColor === preset.id;
                return (
                  <Tooltip key={preset.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={preset.label}
                        onClick={() => updateSection("appearance", { accentColor: preset.id })}
                        style={{ backgroundColor: `hsl(${preset.light})` }}
                        className={cn(
                          "size-7 rounded-md border border-border transition-standard",
                          selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{preset.label}</TooltipContent>
                  </Tooltip>
                );
              })}
              <CustomAccentButton
                selected={settings.appearance.accentColor === "custom"}
                value={settings.appearance.customAccent}
                onChange={(customAccent) =>
                  updateSection("appearance", { accentColor: "custom", customAccent })
                }
              />
            </div>
          </TooltipProvider>
        </div>
      </section>
    </div>
  );
}
