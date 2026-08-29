import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { toast } from "sonner";
import type {
  ConnectionStatus,
  ModelInfo,
  Provider,
  ProviderAccountInfo,
  ProviderApiMode,
} from "@/types/models";
import { DEFAULT_PROVIDERS, DEMO_PROVIDER_ID } from "@/lib/constants";
import {
  fetchProviderAccountInfo,
  fetchProviderModels,
  testProviderConnection,
} from "@/lib/api";
import { ipc, isTauri } from "@/lib/ipc";
import { persistence } from "@/lib/persistence";
import { generateId } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";

const PROVIDERS_KEY = "app:providers";
const API_KEY_PREFIX = "app:api-key:";

const LEGACY_KIMI_MODEL_IDS: Record<string, string> = {
  "kimi-k2-6": "kimi-k2.6",
  "kimi-k2-6-coding": "kimi-k2.7-code",
  "kimi-k2-5": "kimi-k2.5",
};

function migrateModel(providerId: string, model: ModelInfo): ModelInfo {
  if (providerId !== "kimi") return model;
  const id = LEGACY_KIMI_MODEL_IDS[model.id] ?? model.id;
  const names: Record<string, string> = {
    "kimi-k2.6": "Kimi K2.6",
    "kimi-k2.7-code": "Kimi K2.7 Code",
    "kimi-k2.5": "Kimi K2.5",
  };
  return { ...model, id, name: names[id] ?? model.name };
}

function migrateSelectionId(selectionId: string): string {
  const prefix = "kimi::";
  if (!selectionId.startsWith(prefix)) return selectionId;
  const id = selectionId.slice(prefix.length);
  return `${prefix}${LEGACY_KIMI_MODEL_IDS[id] ?? id}`;
}

function modelSelectionId(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

interface ModelState {
  providers: Provider[];
  selectedModelId: string;
  isRefreshing: boolean;
  connectionStatus: Record<string, ConnectionStatus>;
  connectionErrors: Record<string, string | null>;
  accountInfo: Record<string, ProviderAccountInfo | null>;

  loadProviders: () => Promise<void>;
  selectModel: (modelId: string) => void;
  refreshModels: () => Promise<void>;
  setApiKey: (providerId: string, key: string) => Promise<void>;
  getApiKey: (providerId: string) => Promise<string | null>;
  deleteApiKey: (providerId: string) => Promise<void>;
  addCustomProvider: (input: {
    id: string;
    name: string;
    baseUrl: string;
    apiMode?: ProviderApiMode;
    defaultModelId?: string;
    discoverModels?: boolean;
    contextWindow?: number;
  }) => Promise<Provider>;
  updateProvider: (provider: Provider) => Promise<void>;
  removeProvider: (providerId: string) => Promise<void>;
  testConnection: (providerId: string) => Promise<boolean>;
  refreshAccountInfo: (
    providerId: string,
  ) => Promise<ProviderAccountInfo | null>;
  getSelectedModel: () => { provider: Provider; model: ModelInfo } | null;
  allModels: () => ModelInfo[];
}

async function persistProviders(providers: Provider[]): Promise<void> {
  await persistence.setSetting(PROVIDERS_KEY, JSON.stringify(providers));
}

async function readApiKey(providerId: string): Promise<string | null> {
  if (isTauri) {
    try {
      const key = await ipc.getApiKey(providerId);
      if (key?.trim()) return key.trim();
    } catch {
      // Fall through to the compatibility copy below.
    }
  }
  const key = await persistence.getSetting(`${API_KEY_PREFIX}${providerId}`);
  return key?.trim() || null;
}

export const useModelStore = create<ModelState>()(
  immer((set, get) => ({
    providers: DEFAULT_PROVIDERS,
    selectedModelId: useSettingsStore.getState().settings.model.defaultModelId,
    isRefreshing: false,
    connectionStatus: {},
    connectionErrors: {},
    accountInfo: {},

    loadProviders: async () => {
      let providers = DEFAULT_PROVIDERS;
      try {
        const raw = await persistence.getSetting(PROVIDERS_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as Provider[];
          const storedMap = new Map(stored.map((p) => [p.id, p]));
          const defaultIds = new Set(DEFAULT_PROVIDERS.map((p) => p.id));
          const mergedDefaults = DEFAULT_PROVIDERS.map((def) => {
            const saved = storedMap.get(def.id);
            if (!saved) return def;
            return {
              ...def,
              baseUrl: saved.baseUrl || def.baseUrl,
              apiMode: saved.apiMode ?? def.apiMode,
              isEnabled: saved.isEnabled,
              hasApiKey: saved.hasApiKey,
              plan: saved.plan ?? def.plan,
              models: (saved.models?.length ? saved.models : def.models).map(
                (model) => {
                  const defaultModel = def.models.find((m) => m.id === model.id);
                  const merged = defaultModel
                    ? {
                        ...defaultModel,
                        ...model,
                        pricing:
                          model.pricing ?? defaultModel.pricing,
                      }
                    : model;
                  return migrateModel(def.id, merged);
                },
              ),
            };
          });
          const custom = stored.filter((p) => !defaultIds.has(p.id));
          providers = [...mergedDefaults, ...custom];
        }
      } catch {
        providers = DEFAULT_PROVIDERS;
      }
      const withKeyFlags = await Promise.all(
        providers.map(async (p) => ({
          ...p,
          hasApiKey:
            p.type === "demo" ? false : (await readApiKey(p.id)) !== null,
          models: p.models.map((model) => ({
            ...model,
            selectionId: modelSelectionId(p.id, model.id),
          })),
        })),
      );
      set((state) => {
        state.providers = withKeyFlags;
        const selected = migrateSelectionId(state.selectedModelId);
        const exact = withKeyFlags
          .flatMap((provider) => provider.models)
          .find((model) => model.selectionId === selected);
        const legacy = withKeyFlags
          .flatMap((provider) => provider.models)
          .find((model) => model.id === selected);
        const fallback = withKeyFlags.find(
          (provider) => provider.id === DEMO_PROVIDER_ID,
        )?.models[0];
        const resolved = exact ?? legacy ?? fallback;
        if (resolved?.selectionId) state.selectedModelId = resolved.selectionId;
      });
      const resolvedSelection = get().selectedModelId;
      useSettingsStore
        .getState()
        .updateSection("model", { defaultModelId: resolvedSelection });
    },

    selectModel: (modelId) => {
      set((state) => {
        state.selectedModelId = modelId;
      });
      useSettingsStore
        .getState()
        .updateSection("model", { defaultModelId: modelId });
    },

    refreshModels: async () => {
      set((state) => {
        state.isRefreshing = true;
      });
      try {
        const providers = get().providers;
        const refreshed: Provider[] = [];
        for (const provider of providers) {
          if (!provider.isEnabled || provider.type === "demo") {
            refreshed.push(provider);
            continue;
          }
          const apiKey = await readApiKey(provider.id);
          try {
            const models = await fetchProviderModels(provider, apiKey);
            refreshed.push({
              ...provider,
              models: models.length > 0 ? models : provider.models,
            });
          } catch {
            refreshed.push(provider);
          }
        }
        set((state) => {
          state.providers = refreshed;
        });
        await persistProviders(refreshed);
      } finally {
        set((state) => {
          state.isRefreshing = false;
        });
      }
    },

    setApiKey: async (providerId, key) => {
      if (isTauri) {
        try {
          await ipc.storeApiKey(providerId, key);
          const storedKey = await ipc.getApiKey(providerId);
          if (storedKey !== key) {
            throw new Error(
              "The operating-system credential store did not retain the API key.",
            );
          }
          await persistence.setSetting(`${API_KEY_PREFIX}${providerId}`, "");
        } catch {
          await persistence.setSetting(`${API_KEY_PREFIX}${providerId}`, key);
        }
      } else {
        await persistence.setSetting(`${API_KEY_PREFIX}${providerId}`, key);
      }
      set((state) => {
        const provider = state.providers.find((p) => p.id === providerId);
        if (provider) {
          provider.hasApiKey = true;
          provider.isEnabled = true;
        }
      });
      await persistProviders(get().providers);
      await get().refreshAccountInfo(providerId);
    },

    getApiKey: (providerId) => readApiKey(providerId),

    deleteApiKey: async (providerId) => {
      if (isTauri) {
        try {
          await ipc.deleteApiKey(providerId);
        } catch {
          // Keychain miss is non-fatal; clear the fallback copy too.
        }
      }
      await persistence.setSetting(`${API_KEY_PREFIX}${providerId}`, "");
      set((state) => {
        const provider = state.providers.find((p) => p.id === providerId);
        if (provider) provider.hasApiKey = false;
      });
      await persistProviders(get().providers);
    },

    addCustomProvider: async (input) => {
      const existingIds = new Set(get().providers.map((p) => p.id));
      const id = input.id.trim().toLowerCase();
      if (!id) throw new Error("Provider ID is required.");
      if (existingIds.has(id)) throw new Error(`Provider ID "${id}" already exists.`);

      const defaultModelId = input.defaultModelId?.trim();
      const discoverModels = input.discoverModels ?? true;

      const provider: Provider = {
        id,
        name: input.name.trim(),
        type: "custom",
        baseUrl: input.baseUrl.replace(/\/$/, ""),
        apiMode: input.apiMode,
        isEnabled: true,
        hasApiKey: false,
        models: [],
        defaultModelId: defaultModelId || undefined,
        discoverModels,
        contextWindow: input.contextWindow,
      };
      set((state) => {
        state.providers.push(provider);
      });
      await persistProviders(get().providers);
      return provider;
    },

    updateProvider: async (provider) => {
      set((state) => {
        const idx = state.providers.findIndex((p) => p.id === provider.id);
        if (idx >= 0) state.providers[idx] = provider;
      });
      await persistProviders(get().providers);
    },

    removeProvider: async (providerId) => {
      if (providerId === DEMO_PROVIDER_ID) return;
      set((state) => {
        state.providers = state.providers.filter((p) => p.id !== providerId);
      });
      await persistProviders(get().providers);
    },

    testConnection: async (providerId) => {
      const provider = get().providers.find((p) => p.id === providerId);
      if (!provider) return false;
      set((state) => {
        state.connectionStatus[providerId] = "testing";
        state.connectionErrors[providerId] = null;
      });
      const apiKey = await readApiKey(providerId);
      const result = await testProviderConnection(provider, apiKey);
      set((state) => {
        state.connectionStatus[providerId] = result.ok ? "ok" : "error";
        state.connectionErrors[providerId] = result.error ?? null;
      });
      if (!result.ok && result.error) {
        toast.error(`${provider.name}: ${result.error}`);
      }
      if (result.ok) {
        await get().refreshAccountInfo(providerId);
      }
      return result.ok;
    },

    refreshAccountInfo: async (providerId) => {
      const provider = get().providers.find((p) => p.id === providerId);
      if (!provider) return null;
      const apiKey = await readApiKey(providerId);
      const info = await fetchProviderAccountInfo(provider, apiKey);
      set((state) => {
        state.accountInfo[providerId] = info;
        if (info?.plan) {
          const target = state.providers.find((p) => p.id === providerId);
          if (target) target.plan = info.plan;
        }
      });
      if (info) await persistProviders(get().providers);
      return info;
    },

    getSelectedModel: () => {
      const { providers, selectedModelId } = get();
      for (const provider of providers) {
        const model = provider.models.find(
          (m) => m.selectionId === selectedModelId || m.id === selectedModelId,
        );
        if (model) return { provider, model };
      }
      const demo = providers.find((p) => p.id === DEMO_PROVIDER_ID);
      const demoModel = demo?.models[0];
      return demo && demoModel ? { provider: demo, model: demoModel } : null;
    },

    allModels: () => get().providers.flatMap((p) => p.models),
  })),
);
