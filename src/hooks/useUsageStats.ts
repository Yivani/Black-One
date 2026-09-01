import { useCallback, useEffect, useMemo, useState } from "react";
import { persistence } from "@/lib/persistence";
import { dailyActivity, type DailyBucket } from "@/lib/usageCore";
import { estimateMessageCost, formatContextWindow, formatCurrency } from "@/lib/utils";
import { useModelStore } from "@/stores/modelStore";
import type { Message } from "@/types/chat";
import type { ModelInfo, Provider } from "@/types/models";

export type UsageModeFilter = "all" | "chat" | "code" | "agent";

export interface ModelUsage {
  modelId: string;
  modelName: string;
  providerName: string;
  providerId: string;
  currency: string;
  messageCount: number;
  tokens: number;
  estimatedCost: number;
}

export interface UsageStats {
  sessions: number;
  messages: number;
  tokens: number;
  estimatedCost: number;
  byModel: ModelUsage[];
  /** Message volume for the last week, oldest day first. */
  daily: DailyBucket[];
}

function modelKey(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

export function useUsageStats(filter: UsageModeFilter) {
  const providers = useModelStore((s) => s.providers);
  const allModels = useMemo(() => providers.flatMap((p) => p.models), [providers]);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tick, setTick] = useState(0);

  const providerLookup = useMemo(() => {
    const map = new Map<string, Provider>();
    for (const provider of providers) {
      map.set(provider.id, provider);
    }
    return map;
  }, [providers]);

  const modelLookup = useMemo(() => {
    const map = new Map<string, ModelInfo>();
    for (const model of allModels) {
      map.set(modelKey(model.providerId, model.id), model);
    }
    return map;
  }, [allModels]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const sessions = await persistence.listSessions(true);
      const loadedMessages: Message[] = [];
      await Promise.all(
        sessions.map(async (session) => {
          const sessionMessages = await persistence.listMessages(session.id);
          loadedMessages.push(...sessionMessages);
        }),
      );
      setMessages(loadedMessages);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const stats = useMemo((): UsageStats => {
    const filtered =
      filter === "all"
        ? messages
        : messages.filter((m) => m.mode === filter || (!m.mode && filter === "chat"));

    const assistantMessages = filtered.filter(
      (m) => m.role === "assistant" && typeof m.tokensUsed === "number" && m.tokensUsed > 0,
    );

    const byModelMap = new Map<string, ModelUsage>();
    let totalCost = 0;

    for (const message of assistantMessages) {
      const providerId = message.providerId ?? "unknown";
      const modelId = message.modelId ?? "unknown";
      const key = modelKey(providerId, modelId);
      const model = modelLookup.get(key);
      const tokens = message.tokensUsed ?? 0;
      const cost =
        message.cost ?? estimateMessageCost(model?.pricing, tokens) ?? 0;
      const currency = model?.pricing?.currency ?? "USD";

      const existing = byModelMap.get(key);
      if (existing) {
        existing.messageCount += 1;
        existing.tokens += tokens;
        existing.estimatedCost += cost;
      } else {
        byModelMap.set(key, {
          modelId,
          modelName: model?.name ?? modelId,
          providerName: providerLookup.get(providerId)?.name ?? providerId,
          providerId,
          currency,
          messageCount: 1,
          tokens,
          estimatedCost: cost,
        });
      }
      totalCost += cost;
    }

    const byModel = Array.from(byModelMap.values()).sort(
      (a, b) => b.tokens - a.tokens,
    );

    const filteredSessionIds = new Set(filtered.map((m) => m.sessionId));

    return {
      sessions: filteredSessionIds.size,
      messages: filtered.length,
      tokens: assistantMessages.reduce((sum, m) => sum + (m.tokensUsed ?? 0), 0),
      estimatedCost: totalCost,
      byModel,
      daily: dailyActivity(filtered, 7),
    };
  }, [messages, filter, modelLookup, providerLookup]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { stats, isLoading, refresh };
}
