import { useMemo } from "react";
import type { ModelInfo, Provider } from "@/types/models";
import { useModelStore } from "@/stores/modelStore";

export interface UseModelsResult {
  providers: Provider[];
  models: ModelInfo[];
  selectedModelId: string;
  selected: { provider: Provider; model: ModelInfo } | null;
  isRefreshing: boolean;
  selectModel: (modelId: string) => void;
  refreshModels: () => Promise<void>;
}

export function useModels(): UseModelsResult {
  const providers = useModelStore((s) => s.providers);
  const selectedModelId = useModelStore((s) => s.selectedModelId);
  const isRefreshing = useModelStore((s) => s.isRefreshing);
  const selectModel = useModelStore((s) => s.selectModel);
  const refreshModels = useModelStore((s) => s.refreshModels);

  const models = useMemo(() => providers.flatMap((p) => p.models), [providers]);
  const selected = useMemo(() => {
    for (const provider of providers) {
      const model = provider.models.find(
        (m) => m.selectionId === selectedModelId || m.id === selectedModelId,
      );
      if (model) return { provider, model };
    }
    return null;
  }, [providers, selectedModelId]);

  return {
    providers,
    models,
    selectedModelId,
    selected,
    isRefreshing,
    selectModel,
    refreshModels,
  };
}
