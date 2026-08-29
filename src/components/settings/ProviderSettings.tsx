import { useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { testProviderConnection } from "@/lib/api";
import { isTauri } from "@/lib/ipc";
import { formatContextWindow } from "@/lib/utils";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Provider, ProviderApiMode } from "@/types/models";

const PROVIDER_SETUP: Record<
  string,
  { url: string; label: string; description: string }
> = {
  openai: {
    url: "https://platform.openai.com/api-keys",
    label: "Open OpenAI keys",
    description:
      "Create a Platform API key. ChatGPT subscriptions do not include API access.",
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
    description:
      "Sign in to OpenCode Zen, add billing if required, and copy an API key.",
  },
  kimi: {
    url: "https://platform.kimi.ai/console/api-keys",
    label: "Open Kimi Platform keys",
    description:
      "Use a pay-as-you-go Kimi Platform key. Kimi Code membership keys do not work here.",
  },
  "kimi-code": {
    url: "https://www.kimi.com/code/console",
    label: "Open Kimi Code Console",
    description:
      "Use a Kimi Code Console key tied to an active Kimi membership. Platform keys do not work here.",
  },
};

function openExternal(url: string): void {
  if (isTauri) {
    void import("@tauri-apps/plugin-opener").then((module) =>
      module.openUrl(url),
    );
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function slugifyProviderId(name: string, existingIds: Set<string>): string {
  let base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  if (!base) base = "endpoint";
  let candidate = base;
  let suffix = 1;
  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

const CONTEXT_OPTIONS: Array<{ label: string; value?: number }> = [
  { label: "Auto" },
  { label: "4k", value: 4_096 },
  { label: "8k", value: 8_192 },
  { label: "16k", value: 16_384 },
  { label: "32k", value: 32_768 },
  { label: "64k", value: 65_536 },
  { label: "128k", value: 131_072 },
  { label: "256k", value: 262_144 },
  { label: "512k", value: 524_288 },
  { label: "1M", value: 1_048_576 },
];

function ProviderCard({
  provider,
  onRemove,
}: {
  provider: Provider;
  onRemove?: () => void;
}) {
  const updateProvider = useModelStore((s) => s.updateProvider);
  const setApiKey = useModelStore((s) => s.setApiKey);
  const deleteApiKey = useModelStore((s) => s.deleteApiKey);
  const testConnection = useModelStore((s) => s.testConnection);
  const refreshModels = useModelStore((s) => s.refreshModels);
  const refreshAccountInfo = useModelStore((s) => s.refreshAccountInfo);
  const status = useModelStore((s) => s.connectionStatus[provider.id]);
  const connectionError = useModelStore((s) => s.connectionErrors[provider.id]);
  const accountInfo = useModelStore((s) => s.accountInfo[provider.id]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [plan, setPlan] = useState(provider.plan ?? "default");
  const [forceManualPlan, setForceManualPlan] = useState(false);
  const [open, setOpen] = useState(provider.isEnabled && !provider.hasApiKey);
  const [defaultModelId, setDefaultModelId] = useState(
    provider.defaultModelId ?? "",
  );
  const [discoverModels, setDiscoverModels] = useState(
    provider.discoverModels ?? true,
  );
  const [contextWindow, setContextWindow] = useState<number | undefined>(
    provider.contextWindow,
  );
  const setup = PROVIDER_SETUP[provider.id];
  const isCustom = provider.type === "custom";

  const toggleEnabled = async (isEnabled: boolean) => {
    try {
      await updateProvider({ ...provider, isEnabled });
    } catch {
      toast.error(`Failed to update ${provider.name}.`);
    }
  };

  const commitBaseUrl = async () => {
    const next = baseUrl.trim();
    if (next === provider.baseUrl) return;
    try {
      await updateProvider({ ...provider, baseUrl: next });
    } catch {
      toast.error(`Failed to update ${provider.name}.`);
    }
  };

  const commitPlan = async (next: string) => {
    if (next === provider.plan) return;
    setPlan(next);
    try {
      await updateProvider({ ...provider, plan: next });
    } catch {
      toast.error(`Failed to update ${provider.name} plan.`);
    }
  };

  const commitDefaultModelId = async (next: string) => {
    const trimmed = next.trim();
    if (trimmed === (provider.defaultModelId ?? "")) return;
    try {
      await updateProvider({
        ...provider,
        defaultModelId: trimmed || undefined,
      });
    } catch {
      toast.error(`Failed to update ${provider.name} default model.`);
    }
  };

  const commitDiscoverModels = async (next: boolean) => {
    if (next === (provider.discoverModels ?? true)) return;
    setDiscoverModels(next);
    try {
      await updateProvider({ ...provider, discoverModels: next });
    } catch {
      toast.error(`Failed to update ${provider.name} discovery setting.`);
    }
  };

  const commitContextWindow = async (next: number | undefined) => {
    if (next === provider.contextWindow) return;
    setContextWindow(next);
    try {
      await updateProvider({ ...provider, contextWindow: next });
    } catch {
      toast.error(`Failed to update ${provider.name} context window.`);
    }
  };

  const saveKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) return;
    try {
      const nextBaseUrl = baseUrl.trim();
      if (nextBaseUrl && nextBaseUrl !== provider.baseUrl) {
        await updateProvider({ ...provider, baseUrl: nextBaseUrl });
      }
      await setApiKey(provider.id, key);
      setApiKeyInput("");
      const ok = await testConnection(provider.id);
      if (ok) {
        await refreshModels();
        toast.success(
          provider.id === "opencode"
            ? `${provider.name} API key saved; model catalog is reachable.`
            : `${provider.name} API key saved and connected.`,
        );
      } else {
        setOpen(true);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to save the ${provider.name} API key.`,
      );
    }
  };

  const removeKey = async () => {
    try {
      await deleteApiKey(provider.id);
    } catch {
      toast.error(`Failed to delete the ${provider.name} API key.`);
    }
  };

  const runTest = async () => {
    try {
      await testConnection(provider.id);
    } catch {
      toast.error(`Connection test failed for ${provider.name}.`);
    }
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-border bg-card/40 transition-colors data-[state=open]:bg-card"
    >
      <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
          <span className="truncate font-medium">{provider.name}</span>
          {isCustom && provider.defaultModelId && (
            <Badge
              variant="outline"
              className="hidden text-[10px] text-muted-foreground sm:inline-flex"
            >
              {provider.defaultModelId}
            </Badge>
          )}
          {provider.hasApiKey ? (
            <Badge
              variant="secondary"
              className="hidden text-[10px] sm:inline-flex"
            >
              Configured
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="hidden text-[10px] text-muted-foreground sm:inline-flex"
            >
              Needs key
            </Badge>
          )}
          {status === "ok" && (
            <span
              className="size-1.5 rounded-full bg-emerald-500"
              aria-label="Connected"
            />
          )}
          {status === "error" && (
            <span
              className="size-1.5 rounded-full bg-destructive"
              aria-label="Connection failed"
            />
          )}
        </button>
        <div className="flex items-center gap-2">
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${provider.name}`}
              onClick={onRemove}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          )}
          <Switch
            checked={provider.isEnabled}
            onCheckedChange={(isEnabled) => void toggleEnabled(isEnabled)}
            aria-label={`Enable ${provider.name}`}
          />
        </div>
      </div>
      <CollapsibleContent>
        <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
          {setup && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                {setup.description}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => openExternal(setup.url)}
              >
                {setup.label}
                <ExternalLink className="size-3.5" aria-hidden />
              </Button>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`base-url-${provider.id}`}>Base URL</Label>
            <Input
              id={`base-url-${provider.id}`}
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              onBlur={() => void commitBaseUrl()}
              placeholder="https://host/v1"
              autoComplete="off"
            />
          </div>
          {isCustom && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label htmlFor={`provider-id-${provider.id}`}>Provider ID</Label>
                <Input
                  id={`provider-id-${provider.id}`}
                  value={provider.id}
                  disabled
                  aria-readonly
                  className="font-mono text-muted-foreground"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`default-model-${provider.id}`}>
                    Default model
                  </Label>
                  <Input
                    id={`default-model-${provider.id}`}
                    value={defaultModelId}
                    onChange={(event) => setDefaultModelId(event.target.value)}
                    onBlur={() => void commitDefaultModelId(defaultModelId)}
                    placeholder="model-id"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`context-window-${provider.id}`}>Context</Label>
                  <Select
                    value={
                      contextWindow === undefined ? "auto" : String(contextWindow)
                    }
                    onValueChange={(value) =>
                      void commitContextWindow(
                        value === "auto" ? undefined : Number(value),
                      )
                    }
                  >
                    <SelectTrigger id={`context-window-${provider.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTEXT_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.label}
                          value={
                            option.value === undefined
                              ? "auto"
                              : String(option.value)
                          }
                        >
                          {option.value === undefined
                            ? option.label
                            : `${option.label} (${formatContextWindow(option.value)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label
                  htmlFor={`discover-models-${provider.id}`}
                  className="cursor-pointer"
                >
                  Discover models
                </Label>
                <Switch
                  id={`discover-models-${provider.id}`}
                  checked={discoverModels}
                  onCheckedChange={(checked) =>
                    void commitDiscoverModels(checked)
                  }
                  aria-label={`Discover models for ${provider.name}`}
                />
              </div>
            </div>
          )}
          {provider.plans && provider.plans.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={`plan-${provider.id}`}>Plan</Label>
                {provider.id === "kimi" && forceManualPlan && (
                  <button
                    type="button"
                    onClick={() => setForceManualPlan(false)}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Auto-detect
                  </button>
                )}
              </div>
              {provider.id === "kimi" && !forceManualPlan ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" id={`plan-${provider.id}`}>
                    {provider.plan ?? "Auto-detected"}
                  </Badge>
                  {accountInfo?.balance !== undefined &&
                    accountInfo.currency && (
                      <span className="text-xs text-muted-foreground">
                        · {accountInfo.balance.toFixed(2)}{" "}
                        {accountInfo.currency}
                      </span>
                    )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Refresh account info"
                    className="size-7"
                    disabled={!provider.hasApiKey}
                    onClick={() => void refreshAccountInfo(provider.id)}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                  </Button>
                  {!provider.hasApiKey && (
                    <span className="text-xs text-muted-foreground">
                      Save a key to detect plan
                    </span>
                  )}
                  {provider.hasApiKey && (
                    <button
                      type="button"
                      onClick={() => setForceManualPlan(true)}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Edit
                    </button>
                  )}
                </div>
              ) : (
                <Select
                  value={plan}
                  onValueChange={(value) => void commitPlan(value)}
                >
                  <SelectTrigger id={`plan-${provider.id}`} className="w-full">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {provider.plans.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={`api-key-${provider.id}`}>API key</Label>
              {provider.id === "kimi" && (
                <span className="text-xs text-muted-foreground">
                  Moonshot Open Platform key
                </span>
              )}
              {provider.id === "kimi-code" && (
                <span className="text-xs text-muted-foreground">
                  Kimi Code console key
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                id={`api-key-${provider.id}`}
                type="password"
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder={
                  provider.hasApiKey ? "Key stored — enter to replace" : "sk-…"
                }
                autoComplete="off"
              />
              <Button
                onClick={() => void saveKey()}
                disabled={!apiKeyInput.trim()}
              >
                Save
              </Button>
              {provider.hasApiKey && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${provider.name} API key`}
                  onClick={() => void removeKey()}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runTest()}
                disabled={status === "testing"}
              >
                {status === "testing" && (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                )}
                Test connection
              </Button>
              {status === "ok" && (
                <Badge variant="secondary">
                  {provider.id === "opencode"
                    ? "Catalog reachable"
                    : "Connected"}
                </Badge>
              )}
              {status === "error" && (
                <Badge variant="destructive">Failed</Badge>
              )}
            </div>
            {status === "error" && connectionError && (
              <p className="max-w-2xl text-xs leading-relaxed text-destructive">
                {connectionError}
              </p>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ProviderSettings() {
  const providers = useModelStore((s) => s.providers);
  const addCustomProvider = useModelStore((s) => s.addCustomProvider);
  const removeProvider = useModelStore((s) => s.removeProvider);
  const refreshModels = useModelStore((s) => s.refreshModels);
  const setApiKey = useModelStore((s) => s.setApiKey);
  const selectModel = useModelStore((s) => s.selectModel);
  const updateSection = useSettingsStore((s) => s.updateSection);

  const [newName, setNewName] = useState("");
  const [newProviderId, setNewProviderId] = useState("");
  const [newProviderIdTouched, setNewProviderIdTouched] = useState(false);
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newDefaultModel, setNewDefaultModel] = useState("");
  const [newContextWindow, setNewContextWindow] = useState<number | undefined>(
    undefined,
  );
  const [newApiKey, setNewApiKey] = useState("");
  const [newApiMode, setNewApiMode] =
    useState<ProviderApiMode>("chat-completions");
  const [useForNewChats, setUseForNewChats] = useState(false);
  const [discoverModels, setDiscoverModels] = useState(true);
  const [isTesting, setIsTesting] = useState(false);

  const apiProviders = providers.filter(
    (p) => p.type !== "demo" && p.type !== "custom",
  );
  const customProviders = providers.filter((p) => p.type === "custom");
  const existingIds = new Set(providers.map((p) => p.id));

  const handleNameChange = (value: string) => {
    setNewName(value);
    if (!newProviderIdTouched) {
      setNewProviderId(slugifyProviderId(value, existingIds));
    }
  };

  const validateForm = (): boolean => {
    const name = newName.trim();
    const id = newProviderId.trim().toLowerCase();
    const baseUrl = newBaseUrl.trim();

    if (!name) {
      toast.error("Enter an endpoint name.");
      return false;
    }
    if (!id) {
      toast.error("Enter a provider ID.");
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      toast.error(
        "Provider ID can only contain lowercase letters, numbers, and hyphens.",
      );
      return false;
    }
    if (existingIds.has(id)) {
      toast.error(`Provider ID "${id}" already exists.`);
      return false;
    }
    if (!baseUrl) {
      toast.error("Enter an endpoint URL.");
      return false;
    }
    try {
      new URL(baseUrl);
    } catch {
      toast.error(
        "Enter a valid endpoint URL, including http:// or https://.",
      );
      return false;
    }
    if (!discoverModels && !newDefaultModel.trim()) {
      toast.error("Enter a default model, or enable Discover models.");
      return false;
    }
    return true;
  };

  const buildDraftProvider = (): Provider => ({
    id: newProviderId.trim().toLowerCase(),
    name: newName.trim(),
    type: "custom",
    baseUrl: newBaseUrl.trim().replace(/\/$/, ""),
    apiMode: newApiMode,
    isEnabled: true,
    hasApiKey: false,
    models: [],
    defaultModelId: newDefaultModel.trim() || undefined,
    discoverModels,
    contextWindow: newContextWindow,
  });

  const resetForm = () => {
    setNewName("");
    setNewProviderId("");
    setNewProviderIdTouched(false);
    setNewBaseUrl("");
    setNewDefaultModel("");
    setNewContextWindow(undefined);
    setNewApiKey("");
    setNewApiMode("chat-completions");
    setUseForNewChats(false);
    setDiscoverModels(true);
  };

  const addEndpoint = async () => {
    if (!validateForm()) return;
    setIsTesting(true);
    try {
      const provider = await addCustomProvider(buildDraftProvider());
      const apiKey = newApiKey.trim() || null;
      if (apiKey) {
        await setApiKey(provider.id, apiKey);
      }
      await refreshModels();
      if (useForNewChats && provider.defaultModelId) {
        const selectionId = `${provider.id}::${provider.defaultModelId}`;
        selectModel(selectionId);
        updateSection("model", { defaultModelId: selectionId });
      }
      toast.success(`${provider.name} endpoint saved.`);
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to add the custom endpoint.",
      );
    } finally {
      setIsTesting(false);
    }
  };

  const testEndpoint = async () => {
    if (!validateForm()) return;
    setIsTesting(true);
    try {
      const provider = buildDraftProvider();
      const result = await testProviderConnection(
        provider,
        newApiKey.trim() || null,
      );
      if (result.ok) {
        toast.success(`${provider.name} connection succeeded.`);
      } else {
        toast.error(result.error ?? "Connection test failed.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Connection test failed.",
      );
    } finally {
      setIsTesting(false);
    }
  };

  const removeEndpoint = async (provider: Provider) => {
    try {
      await removeProvider(provider.id);
    } catch {
      toast.error(`Failed to remove ${provider.name}.`);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionHeading>API Keys</SectionHeading>
        {apiProviders.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </section>
      <Separator />
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <SectionHeading>Custom Endpoints</SectionHeading>
          <Badge variant="secondary" className="text-[10px]">
            {customProviders.length}
          </Badge>
        </div>
        {customProviders.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-border bg-card/40 p-6 text-center">
            <p className="text-sm font-medium">No custom endpoints</p>
            <p className="text-xs text-muted-foreground">
              Add an OpenAI-compatible endpoint below.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {customProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onRemove={() => void removeEndpoint(provider)}
              />
            ))}
          </div>
        )}
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <span className="text-lg leading-none">+</span>
            Add Endpoint
          </h4>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="endpoint-name">Name</Label>
              <Input
                id="endpoint-name"
                value={newName}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Axet Proxy"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endpoint-provider-id">Provider ID</Label>
              <Input
                id="endpoint-provider-id"
                value={newProviderId}
                onChange={(event) => {
                  setNewProviderId(event.target.value);
                  setNewProviderIdTouched(true);
                }}
                placeholder="axet-proxy"
                autoComplete="off"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endpoint-url">Endpoint URL</Label>
              <Input
                id="endpoint-url"
                value={newBaseUrl}
                onChange={(event) => setNewBaseUrl(event.target.value)}
                placeholder="http://127.0.0.1:8081/v1"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="endpoint-default-model">Default Model</Label>
                <Input
                  id="endpoint-default-model"
                  value={newDefaultModel}
                  onChange={(event) => setNewDefaultModel(event.target.value)}
                  placeholder="gpt-5.4"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endpoint-api-mode">API Mode</Label>
                <Select
                  value={newApiMode}
                  onValueChange={(value) =>
                    setNewApiMode(value as ProviderApiMode)
                  }
                >
                  <SelectTrigger id="endpoint-api-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chat-completions">
                      Chat Completions
                    </SelectItem>
                    <SelectItem value="responses">Responses API</SelectItem>
                    <SelectItem value="anthropic-messages">
                      Anthropic Messages
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endpoint-context">Context</Label>
                <Select
                  value={
                    newContextWindow === undefined
                      ? "auto"
                      : String(newContextWindow)
                  }
                  onValueChange={(value) =>
                    setNewContextWindow(
                      value === "auto" ? undefined : Number(value),
                    )
                  }
                >
                  <SelectTrigger id="endpoint-context">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTEXT_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.label}
                        value={
                          option.value === undefined
                            ? "auto"
                            : String(option.value)
                        }
                      >
                        {option.value === undefined
                          ? option.label
                          : `${option.label} (${formatContextWindow(option.value)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endpoint-api-key">API Key</Label>
              <Input
                id="endpoint-api-key"
                type="password"
                value={newApiKey}
                onChange={(event) => setNewApiKey(event.target.value)}
                placeholder="Optional"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="endpoint-use-for-new-chats"
                  checked={useForNewChats}
                  onCheckedChange={setUseForNewChats}
                  aria-label="Use for new chats"
                />
                <Label
                  htmlFor="endpoint-use-for-new-chats"
                  className="cursor-pointer"
                >
                  Use for new chats
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="endpoint-discover-models"
                  checked={discoverModels}
                  onCheckedChange={setDiscoverModels}
                  aria-label="Discover models"
                />
                <Label
                  htmlFor="endpoint-discover-models"
                  className="cursor-pointer"
                >
                  Discover models
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void testEndpoint()}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Zap className="size-3.5" aria-hidden />
                )}
                Test
              </Button>
              <Button
                size="sm"
                onClick={() => void addEndpoint()}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-3.5" aria-hidden />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
