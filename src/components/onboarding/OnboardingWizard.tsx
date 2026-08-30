import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  Download,
  Globe,
  Loader2,
  Moon,
  Monitor,
  Palette,
  Sparkles,
  Square,
  Sun,
  TerminalSquare,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/useSettings";
import { useResolvedDark } from "@/hooks/useTheme";
import { ACCENT_COLORS, APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { CLI_TOOLS, type CliAction, type CliTool } from "@/lib/cliTools";
import { ipc, isTauri, type CliJob, type CliToolStatus } from "@/lib/ipc";
import { THEME_PRESETS, type ThemePreset } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import type { AccentColorId, FontSize, ThemeMode, ThemePresetId } from "@/types/settings";

const ACTION_PROGRESS: Record<CliAction, string> = {
  install: "Installing",
  update: "Updating",
  uninstall: "Uninstalling",
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

function ToolState({
  status,
  job,
}: {
  status?: CliToolStatus;
  job?: CliJob;
}) {
  if (job?.status === "running" || job?.status === "cancelling") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-foreground" aria-live="polite">
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
        {job.status === "cancelling" ? "Cancelling..." : `${ACTION_PROGRESS[job.action]}...`}
      </span>
    );
  }
  if (job?.status === "error") {
    return (
      <span className="flex min-w-0 items-start gap-1.5 text-xs text-destructive" role="status">
        <X className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span className="line-clamp-2 break-words">{job.message}</span>
      </span>
    );
  }
  if (job?.status === "cancelled") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400" role="status">
        <Square className="size-3" aria-hidden />
        Cancelled
      </span>
    );
  }
  if (status?.installed) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400" role="status">
        <Check className="size-3" aria-hidden />
        Installed{status.version ? ` v${status.version}` : ""}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Circle className="size-3" aria-hidden />
      Not installed
    </span>
  );
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
  const dark = useResolvedDark();

  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState<ThemeMode>(settings.appearance.theme);
  const [themePreset, setThemePreset] = useState<ThemePresetId>(settings.appearance.themePreset);
  const [accentColor, setAccentColor] = useState<AccentColorId>(settings.appearance.accentColor);
  const [fontSize, setFontSize] = useState<FontSize>(settings.appearance.fontSize);

  const [cliStatuses, setCliStatuses] = useState<CliToolStatus[]>([]);
  const [cliJobs, setCliJobs] = useState<CliJob[]>([]);
  const [cliLoading, setCliLoading] = useState(true);

  const refreshCliStatuses = useCallback(async () => {
    if (!isTauri) return;
    try {
      setCliStatuses(await ipc.listCliToolStatuses());
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setCliLoading(false);
    }
  }, []);

  const refreshCliJobs = useCallback(async () => {
    if (!isTauri) return;
    try {
      const nextJobs = await ipc.listCliJobs();
      setCliJobs(nextJobs);
      if (!nextJobs.some((job) => job.status === "running" || job.status === "cancelling")) {
        await refreshCliStatuses();
      }
    } catch (error) {
      toast.error(errorText(error));
    }
  }, [refreshCliStatuses]);

  useEffect(() => {
    if (step !== 1) return;
    void Promise.all([refreshCliStatuses(), refreshCliJobs()]);
  }, [step, refreshCliStatuses, refreshCliJobs]);

  const hasActiveCliJob = cliJobs.some(
    (job) => job.status === "running" || job.status === "cancelling",
  );
  useEffect(() => {
    if (!hasActiveCliJob) return;
    const timer = window.setInterval(() => void refreshCliJobs(), 600);
    return () => window.clearInterval(timer);
  }, [hasActiveCliJob, refreshCliJobs]);

  const statusByTool = useMemo(
    () => new Map(cliStatuses.map((status) => [status.id, status])),
    [cliStatuses],
  );
  const jobByTool = useMemo(
    () => new Map(cliJobs.map((job) => [job.toolId, job])),
    [cliJobs],
  );

  const installCliTool = async (tool: CliTool) => {
    if (!isTauri) {
      toast.info("CLI installation is only available in the desktop build.");
      return;
    }
    try {
      const job = await ipc.runCliOperation(tool.id, "install");
      setCliJobs((current) => [...current.filter((item) => item.toolId !== tool.id), job]);
      toast.success(`Installing ${tool.name} in the background.`);
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const applyAppearance = () => {
    updateSection("appearance", {
      theme,
      themePreset,
      accentColor,
      fontSize,
    });
  };

  const handleFinish = () => {
    applyAppearance();
    updateSection("onboardingCompleted", true);
  };

  const handleSkip = () => {
    applyAppearance();
    updateSection("onboardingCompleted", true);
  };

  const steps = [
    { label: "Language" },
    { label: "CLI Tools" },
    { label: "Appearance" },
    { label: "Finish" },
  ];

  return (
    <div className="flex min-h-screen w-screen items-start justify-center overflow-y-auto bg-background p-4 text-foreground sm:items-center">
      <div className="my-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
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
        <div className="max-h-[calc(100vh-180px)] overflow-y-auto px-6 py-8">
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
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Install CLI tools</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Black One uses terminal coding agents. Install the ones you want now, or add them later in Settings.
                </p>
              </div>

              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Installations run in the background without opening a shell window.
              </p>

              <div className="divide-y divide-border border-y border-border">
                {CLI_TOOLS.map((tool) => {
                  const status = statusByTool.get(tool.id);
                  const job = jobByTool.get(tool.id);
                  const active = job?.status === "running" || job?.status === "cancelling";
                  return (
                    <section
                      key={tool.id}
                      className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <TerminalSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <h3 className="text-sm font-semibold">{tool.name}</h3>
                          <code className="truncate text-[11px] text-muted-foreground">{tool.binary}</code>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.description}</p>
                        <div className="mt-1.5 min-h-4">
                          <ToolState status={status} job={job} />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:justify-end">
                        {active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={job.status === "cancelling"}
                            onClick={() => void ipc.cancelCliOperation(job.id).then(refreshCliJobs)}
                          >
                            <Square className="size-3.5" aria-hidden />
                            Cancel
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cliLoading || status?.installed}
                            onClick={() => void installCliTool(tool)}
                          >
                            <Download className="size-3.5" aria-hidden />
                            Install
                          </Button>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>

              <p className="text-xs leading-5 text-muted-foreground">
                You can skip this step and install CLI tools later from Settings → CLI Tools.
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
                  Your workspace is ready. Install CLI tools anytime from Settings → CLI Tools.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-left text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Summary</p>
                <ul className="mt-2 space-y-1">
                  <li>Language: {LANGUAGE_OPTIONS.find((l) => l.id === language)?.label}</li>
                  <li>
                    CLI tools:{" "}
                    {cliStatuses.filter((s) => s.installed).length > 0
                      ? `${cliStatuses.filter((s) => s.installed).length} installed`
                      : "None yet"}
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
