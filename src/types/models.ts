export type ModelCapability = "vision" | "tools" | "reasoning" | "streaming" | "audio";

export type ProviderType = "openai" | "anthropic" | "local" | "custom";

export type ProviderApiMode = "chat-completions" | "responses" | "anthropic-messages";

export interface ModelPricing {
  /** Cost per 1 million input tokens in the stated currency. */
  inputPrice: number;
  /** Cost per 1 million output tokens in the stated currency. */
  outputPrice: number;
  /** ISO 4217 currency code, e.g. "USD" or "CNY". */
  currency: string;
}

export interface ModelInfo {
  id: string;
  /** UI/storage identity; provider-qualified because gateways can expose the same model ID. */
  selectionId?: string;
  name: string;
  providerId: string;
  contextWindow: number;
  capabilities: ModelCapability[];
  description?: string;
  /** Overrides the provider transport for gateways that expose mixed API families. */
  apiMode?: ProviderApiMode;
  /** Optional pricing estimate used for cost calculations. */
  pricing?: ModelPricing;
  /** Optional supported reasoning-effort levels. Defaults to low/medium/high. */
  effortLevels?: string[];
}

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  isEnabled: boolean;
  /** The key itself never reaches the frontend; only its presence is known. */
  hasApiKey: boolean;
  models: ModelInfo[];
  /** API protocol used by this provider unless a model overrides it. */
  apiMode?: ProviderApiMode;
  /** Optional billing/usage plan (e.g. Moonshot tier). */
  plan?: string;
  /** Available plan options for this provider. */
  plans?: string[];
  /** Default model used when model discovery is off or returns no matches. */
  defaultModelId?: string;
  /** Whether to fetch the model list from the endpoint. Defaults to true. */
  discoverModels?: boolean;
  /** Fixed context window for this provider's default model. Undefined means auto. */
  contextWindow?: number;
}

export type ConnectionStatus = "idle" | "testing" | "ok" | "error";

export interface ProviderAccountInfo {
  /** Detected billing/membership plan or tier, if the provider exposes it. */
  plan?: string;
  /** Current account balance (when available). */
  balance?: number;
  /** Balance currency, e.g. "USD" or "CNY". */
  currency?: string;
}
