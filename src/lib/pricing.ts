export interface ModelPricing {
  /** Cost per 1 million tokens, in USD. */
  pricePerMillion: number;
  /** Human-readable pricing note (e.g. "approximate", "output-only estimate"). */
  note?: string;
}

/** Approximate per-million-token prices in USD. Used to surface spend estimates in the Activity page.
 *  These are best-effort defaults; real invoices from providers are the source of truth. */
const PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "openai::gpt-5.6-sol": { pricePerMillion: 18 },
  "openai::gpt-5.6-terra": { pricePerMillion: 12 },
  "openai::gpt-5.6-luna": { pricePerMillion: 6 },
  "openai::gpt-5.3-codex": { pricePerMillion: 8 },

  // Anthropic
  "anthropic::claude-opus-5": { pricePerMillion: 22 },
  "anthropic::claude-sonnet-5": { pricePerMillion: 9 },
  "anthropic::claude-haiku-4-5": { pricePerMillion: 2.5 },

  // xAI
  "xai::grok-4.6": { pricePerMillion: 8 },

  // OpenRouter (rough averages; actual cost is provider-routed)
  "openrouter::openrouter/auto": { pricePerMillion: 8, note: "routed average" },
  "openrouter::openai/gpt-5.6-sol": { pricePerMillion: 18 },
  "openrouter::anthropic/claude-sonnet-5": { pricePerMillion: 9 },
  "openrouter::x-ai/grok-4.6": { pricePerMillion: 8 },

  // OpenCode Zen
  "opencode::gpt-5.6-sol": { pricePerMillion: 18 },
  "opencode::gpt-5.6-terra": { pricePerMillion: 12 },
  "opencode::kimi-k3": { pricePerMillion: 4 },
  "opencode::big-pickle": { pricePerMillion: 3 },

  // Moonshot Kimi
  "kimi::kimi-k3": { pricePerMillion: 4 },
  "kimi::kimi-k2.6": { pricePerMillion: 2 },
  "kimi::kimi-k2.7-code": { pricePerMillion: 2.5 },
  "kimi::kimi-k2.7-code-highspeed": { pricePerMillion: 3 },
  "kimi::kimi-k2.5": { pricePerMillion: 1.5 },

  // Kimi Code
  "kimi-code::k3": { pricePerMillion: 4 },
  "kimi-code::k3-256k": { pricePerMillion: 4 },
  "kimi-code::kimi-for-coding": { pricePerMillion: 2.5 },
  "kimi-code::kimi-for-coding-highspeed": { pricePerMillion: 3 },
};

function pricingKey(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

export function getModelPricing(
  providerId: string | undefined,
  modelId: string | undefined,
): ModelPricing | null {
  if (!providerId || !modelId) return null;
  return PRICING[pricingKey(providerId, modelId)] ?? null;
}

export function estimateCostUsd(
  tokens: number,
  providerId: string | undefined,
  modelId: string | undefined,
): number | null {
  const pricing = getModelPricing(providerId, modelId);
  if (!pricing) return null;
  return (tokens * pricing.pricePerMillion) / 1_000_000;
}

export function formatCurrency(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `<$0.01`;
  return `$${value.toFixed(2)}`;
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return String(tokens);
}
