import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Globe,
  Loader2,
  Moon,
  Monitor,
  Palette,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/useSettings";
import { useResolvedDark } from "@/hooks/useTheme";
import { ACCENT_COLORS, APP_NAME, APP_TAGLINE, FONT_SIZE_SCALE } from "@/lib/constants";
import { isTauri } from "@/lib/ipc";
import { THEME_PRESETS, type ThemePreset } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { AccentColorId, FontSize, ThemeMode, ThemePresetId } from "@/types/settings";
import type { Provider } from "@/types/models";

const LANGUAGE_OPTIONS: Array<{ id: string; label: string; flag: string; ready: boolean }> = [
  { id: "en", label: "English", flag: "🇺🇸", ready: true },
  { id: "de", label: "German", flag: "🇩🇪", ready: false },
  { id: "es", label: "Spanish", flag: "🇪🇸", ready: false },
];

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; icon: LucideIcon }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

const FONT_SIZE_OPTIONS: Array<{ id: FontSize; label: string; glyphClass: string }> = [
  { id: "small", label: "Small", glyphClass: "text-xs" },
  { id: "medium", label: "Medium", glyphClass: "text-sm" },
  { id: "large", label: "Large", glyphClass: "text-base" },
];

const PROVIDER_SETUP: Record<
  string,
  { url: string; label: string; description: string }
> = {
  openai: {
    url: "https://platform.openai.com/api-keys",
    label: "Open OpenAI keys",
    description: "Create a Platform API key. ChatGPT subscriptions do not include API access.",
  },
  anthropic: {
    url: "https://console.anthropic.com/settings/keys",
    label: "Open Anthropic keys",
    description: "Create a Claude API key in the Anthropic Console.",
  },
  openrouter: {
    url: "https://openrouter.ai/settings/keys",
    label: "Open OpenRouter keys",
    description: "Sign in to OpenRouter and create an API key.",
  },
  xai: {
    url: "https://console.x.ai/",
    label: "Open xAI Console",
    description: "Create an xAI API key for Grok models.",
  },
  opencode: {
    url: "https://opencode.ai/auth",
    label: "Open OpenCode",
    description: "Sign in to OpenCode Zen, add billing if required, and copy an API key.",
  },
  kimi: {
    url: "https://platform.kimi.ai/console/api-keys",
    label: "Open Kimi Platform keys",
    description: "Use a pay-as-you-go Kimi Platform key. Kimi Code membership keys do not work here.",
  },
  "kimi-code": {
    url: "https://www.kimi.com/code/console",
    label: "Open Kimi Code Console",
    description: "Use a Kimi Code Console key tied to an active Kimi membership. Platform keys do not work here.",
  },
};

function openExternal(url: string): void {
  if (isTauri) {
    void import("@tauri-apps/plugin-opener").then((module) => module.openUrl(url));
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function ThemePreview({ preset, dark }: { preset: ThemePreset; dark: boolean }) {
  const colors = dark ? preset.dark : preset.light;
  const c = (key: keyof typeof colors) => `hsl(${colors[key]})`;
  return (
    <div
      className="h-16 w-full overflow-hidden rounded-md border"
      style={{ borderColor: c("--border"), backgroundColor: c("--background") }}
    >
      <div className="flex h-full">
        <div
          className="w-4 border-r"
          style={{ backgroundColor: c("--secondary"), borderColor: c("--border") }}
        />
        <div className="flex flex-1 flex-col gap-1 p-1" style={{ backgroundColor: c("--card") }}>
          <div className="flex items-center justify-between gap-1">
            <div className="h-1 w-8 rounded-sm" style={{ backgroundColor: c("--foreground") }} />
            <div className="h-1 w-3 rounded-sm" style={{ backgroundColor: c("--primary") }} />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-1">
            <div className="flex">
              <div className="h-4 w-12 rounded-md rounded-tl-none" style={{ backgroundColor: c("--muted") }} />
            </div>
            <div className="flex justify-end">
              <div className="h-4 w-10 rounded-md rounded-tr-none" style={{ backgroundColor: c("--primary") }} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 flex-1 rounded-sm" style={{ backgroundColor: c("--input") }} />
            <div className="h-2 w-4 rounded-sm" style={{ backgroundColor: c("--accent") }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OnboardingWizard() {
  const { settings, updateSection } = useSettings();
  const providers = useModelStore((s) => s.providers);
  const setApiKey = useModelStore((s) => s.setApiKey);
  const testConnection = useModelStore((s) => s.testConnection);
  const refreshModels = useModelStore((s) => s.refreshModels);
  const selectModel = useModelStore((s) => s.selectModel);
  const dark = useResolvedDark();

  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState("en");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectedProviderId, setConnectedProviderId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(settings.appearance.theme);
  const [themePreset, setThemePreset] = useState<ThemePresetId>(settings.appearance.themePreset);
  const [accentColor, setAccentColor] = useState<AccentColorId>(settings.appearance.accentColor);
  const [fontSize, setFontSize] = useState<FontSize>(settings.appearance.fontSize);

  const selectableProviders = useMemo(
    () => providers.filter((p) => p.id !== "demo"),
    [providers],
  );

  const selectedProvider = useMemo(
    () => selectableProviders.find((p) => p.id === selectedProviderId) ?? null,
    [selectableProviders, selectedProviderId],
  );

  const applyAppearance = () => {
    updateSection("appearance", {
      theme,
      themePreset,
      accentColor,
      fontSize,
    });
  };

  const handleConnect = async () => {
    if (!selectedProvider) return;
    const key = apiKeyInput.trim();
    if (!key) {
      toast.error("Please paste an API key.");
      return;
    }
    if (!isTauri) {
      toast.info("Provider connection is only available in the desktop build.");
      return;
    }
    setConnecting(true);
    try {
      await setApiKey(selectedProvider.id, key);
      const ok = await testConnection(selectedProvider.id);
      if (ok) {
        await refreshModels();
        setConnectedProviderId(selectedProvider.id);
        toast.success(`${selectedProvider.name} connected.`);
      } else {
        toast.error(`${selectedProvider.name} connection failed.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect provider.");
    } finally {
      setConnecting(false);
    }
  };

  const handleFinish = () => {
    applyAppearance();
    if (connectedProviderId) {
      const provider = providers.find((p) => p.id === connectedProviderId);
      const firstModel = provider?.models[0];
      if (firstModel?.selectionId) {
        selectModel(firstModel.selectionId);
      }
    }
    updateSection("onboardingCompleted", true);
  };

  const handleSkip = () => {
    applyAppearance();
    updateSection("onboardingCompleted", true);
  };

  const steps = [
    { label: "Language" },
    { label: "Provider" },
    { label: "Appearance" },
    { label: "Finish" },
  ];

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-sm font-semibold">{APP_NAME}</h1>
              <p className="text-xs text-muted-foreground">{APP_TAGLINE}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {steps.map((s, index) => (
              <div key={s.label} className="flex items-center">
                <div
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[10px] font-medium transition-colors",
                    index === step
                      ? "bg-primary text-primary-foreground"
                      : index < step
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {index < step ? <Check className="size-3" /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="size-3 text-muted-foreground" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold tracking-tight">Welcome to {APP_NAME}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Let&apos;s set up a few things before you start.
                </p>
              </div>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" aria-hidden />
                  <Label className="text-sm font-medium">Language</Label>
                </div>
                <div role="radiogroup" aria-label="Language" className="grid grid-cols-3 gap-3">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={language === option.id}
                      disabled={!option.ready}
                      onClick={() => option.ready && setLanguage(option.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-left transition-colors",
                        language === option.id
                          ? "border-primary ring-1 ring-primary"
                          : "hover:bg-accent/50",
                        !option.ready && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="text-2xl" aria-hidden>
                        {option.flag}
                      </span>
                      <span className="text-xs font-medium">{option.label}</span>
                      {!option.ready && (
                        <span className="text-[10px] text-muted-foreground">Coming soon</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Connect a provider</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose the AI provider you want to use. You can add more later in Settings.
                </p>
              </div>

              <div role="radiogroup" aria-label="AI provider" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selectableProviders.map((provider) => {
                  const selected = selectedProviderId === provider.id;
                  const connected = connectedProviderId === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setSelectedProviderId(provider.id);
                        setApiKeyInput("");
                      }}
                      className={cn(
                        "relative rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent/30",
                        selected && "border-primary ring-1 ring-primary",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{provider.name}</span>
                        {connected && (
                          <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                            <Check className="size-3" />
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                        {provider.models[0]?.name ?? "Custom endpoint"}
                      </p>
                    </button>
                  );
                })}
              </div>

              {selectedProvider && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <Label htmlFor="provider-key" className="text-sm font-medium">
                      {selectedProvider.name} API key
                    </Label>
                    {PROVIDER_SETUP[selectedProvider.id] && (
                      <button
                        type="button"
                        onClick={() => openExternal(PROVIDER_SETUP[selectedProvider.id].url)}
                        className="text-xs text-primary hover:underline"
                      >
                        {PROVIDER_SETUP[selectedProvider.id].label}
                      </button>
                    )}
                  </div>
                  <Input
                    id="provider-key"
                    type="password"
                    placeholder={`Paste your ${selectedProvider.name} API key`}
                    value={apiKeyInput}
                    onChange={(event) => setApiKeyInput(event.target.value)}
                    autoComplete="off"
                  />
                  {PROVIDER_SETUP[selectedProvider.id] && (
                    <p className="text-xs text-muted-foreground">
                      {PROVIDER_SETUP[selectedProvider.id].description}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => void handleConnect()}
                      disabled={connecting || !apiKeyInput.trim()}
                    >
                      {connecting && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />}
                      Connect
                    </Button>
                    {connectedProviderId === selectedProvider.id && (
                      <span className="text-xs text-emerald-500">Connected</span>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                You can skip this step and use the offline demo provider, then connect a real provider later in
                Settings.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Make it yours</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a look and feel. You can change this anytime in Settings.
                </p>
              </div>

              <section className="space-y-3">
                <Label className="text-sm font-medium">Theme</Label>
                <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
                  {THEME_OPTIONS.map(({ id, label, icon: Icon }) => {
                    const selected = theme === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setTheme(id)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50",
                          selected && "border-primary ring-1 ring-primary",
                        )}
                      >
                        <Icon className="size-5 text-muted-foreground" aria-hidden />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <Label className="text-sm font-medium">Color theme</Label>
                <div role="radiogroup" aria-label="Color theme" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {THEME_PRESETS.map((preset) => {
                    const selected = themePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${preset.label} color theme`}
                        onClick={() => setThemePreset(preset.id)}
                        className={cn(
                          "flex flex-col gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:bg-accent/50",
                          selected && "border-primary ring-1 ring-primary",
                        )}
                      >
                        <ThemePreview preset={preset} dark={dark} />
                        <span className="text-xs font-medium">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="grid gap-6 sm:grid-cols-2">
                <section className="space-y-3">
                  <Label className="text-sm font-medium">Accent color</Label>
                  <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-2">
                    {ACCENT_COLORS.map((preset) => {
                      const selected = accentColor === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={preset.label}
                          onClick={() => setAccentColor(preset.id)}
                          style={{ backgroundColor: `hsl(${preset.light})` }}
                          className={cn(
                            "size-8 rounded-md border border-border transition-standard",
                            selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                          )}
                        />
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3">
                  <Label className="text-sm font-medium">Font size</Label>
                  <div role="radiogroup" aria-label="Font size" className="inline-flex rounded-md border border-border p-0.5">
                    {FONT_SIZE_OPTIONS.map((option) => {
                      const selected = fontSize === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setFontSize(option.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-sm px-3 py-1.5 transition-colors",
                            selected
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <span className={cn("font-semibold leading-none", option.glyphClass)} aria-hidden>
                            aA
                          </span>
                          <span className="text-xs">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                <Check className="size-8" aria-hidden />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">You&apos;re all set</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {connectedProviderId
                    ? `${selectableProviders.find((p) => p.id === connectedProviderId)?.name ?? "Your provider"} is connected and your look is configured.`
                    : "You can start chatting with the demo provider and connect a real one later."}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-left text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Summary</p>
                <ul className="mt-2 space-y-1">
                  <li>Language: {LANGUAGE_OPTIONS.find((l) => l.id === language)?.label}</li>
                  <li>
                    Provider:{" "}
                    {connectedProviderId
                      ? selectableProviders.find((p) => p.id === connectedProviderId)?.name
                      : "Demo (offline)"}
                  </li>
                  <li>
                    Look: {THEME_OPTIONS.find((t) => t.id === theme)?.label} ·{" "}
                    {THEME_PRESETS.find((t) => t.id === themePreset)?.label} ·{" "}
                    {FONT_SIZE_OPTIONS.find((f) => f.id === fontSize)?.label}
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={handleSkip}>
            Skip setup
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button
                onClick={() => {
                  if (step === 2) applyAppearance();
                  setStep((s) => s + 1);
                }}
              >
                Next
                <ArrowRight className="ml-1.5 size-3.5" aria-hidden />
              </Button>
            ) : (
              <Button onClick={handleFinish}>
                Start using {APP_NAME}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
