import type { ChatCompletionParams, Citation, MessageRole } from "@/types/chat";
import type {
  ModelInfo,
  ModelPricing,
  Provider,
  ProviderAccountInfo,
  ProviderApiMode,
} from "@/types/models";
import { DEFAULT_PROVIDERS } from "@/lib/constants";
import { compactTitle, estimateTokens, generateId } from "@/lib/utils";
import { isTauri } from "@/lib/ipc";

export interface OutgoingMessage {
  role: MessageRole;
  content: string;
}

export interface StreamRequest {
  provider: Provider;
  apiKey?: string | null;
  model: ModelInfo;
  messages: OutgoingMessage[];
  systemPrompt?: string;
  conversationId?: string;
  params: ChatCompletionParams;
  customHeaders?: Record<string, string>;
  signal: AbortSignal;
  onToken: (token: string) => void;
}

export interface StreamResult {
  tokensUsed?: number;
  citations?: Citation[];
  reasoning?: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function modelSupportsThinking(model: ModelInfo): boolean {
  return model.capabilities.includes("reasoning");
}

async function getFetch(): Promise<FetchLike> {
  if (isTauri) {
    const mod = await import("@tauri-apps/plugin-http");
    return mod.fetch as unknown as FetchLike;
  }
  return (input, init) => window.fetch(input, init);
}

async function readSseStream(
  response: Response,
  onEvent: (data: string) => void,
  signal: AbortSignal,
): Promise<void> {
  if (!response.body) throw new Error("Response has no body to stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal.aborted) {
      await reader.cancel();
      break;
    }
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
    } else {
      buffer += decoder.decode(value, { stream: true });
    }
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        onEvent(trimmed.slice(5).trim());
      }
    }
    if (done) break;
  }
}

function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function anthropicApiUrl(baseUrl: string, resource: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  return apiUrl(
    normalized,
    normalized.endsWith("/v1") ? resource : `v1/${resource}`,
  );
}

function apiMode(req: StreamRequest): ProviderApiMode {
  return (
    req.model.apiMode ??
    req.provider.apiMode ??
    (req.provider.type === "anthropic"
      ? "anthropic-messages"
      : "chat-completions")
  );
}

async function providerError(response: Response): Promise<Error> {
  const raw = await response.text().catch(() => "");
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as {
      error?: string | { message?: string };
      message?: string;
    };
    detail =
      typeof parsed.error === "string"
        ? parsed.error
        : (parsed.error?.message ?? parsed.message ?? raw);
  } catch {
    // Some compatible endpoints return plain-text errors.
  }
  const cleanedDetail = detail
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  const summary = (() => {
    switch (response.status) {
      case 400:
        return "The provider rejected the request. Check the selected model and endpoint settings.";
      case 401:
        return "Authentication failed. Check this provider's API key in Settings → Providers.";
      case 403:
        return "Access was denied. Check that your API key can use this model.";
      case 404:
        return "The model or API endpoint was not found. Refresh models and check the Base URL.";
      case 408:
        return "The provider timed out before it could respond.";
      case 429:
        return "The provider rate limit was reached. Wait a moment, then retry.";
      default:
        return response.status >= 500
          ? "The provider is temporarily unavailable. Try again shortly."
          : `The provider returned an unexpected error (${response.status}).`;
    }
  })();

  const repeatsSummary = cleanedDetail
    .toLowerCase()
    .includes(summary.toLowerCase().slice(0, 24));
  return new Error(
    cleanedDetail && !repeatsSummary ? `${summary} ${cleanedDetail}` : summary,
  );
}

async function streamOpenAiCompatible(
  req: StreamRequest,
): Promise<StreamResult> {
  const fetchFn = await getFetch();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...req.customHeaders,
  };
  if (req.apiKey) headers.Authorization = `Bearer ${req.apiKey}`;

  const usesKimiSamplingDefaults = ["kimi", "kimi-code"].includes(
    req.provider.id,
  );
  const useThinking =
    modelSupportsThinking(req.model) && req.params.thinkingEnabled;
  const sendSampling = !usesKimiSamplingDefaults && !useThinking;
  const response = await fetchFn(
    apiUrl(req.provider.baseUrl, "chat/completions"),
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: req.model.id,
        stream: true,
        max_tokens: req.params.maxTokens,
        ...(sendSampling
          ? {
              temperature: req.params.temperature,
              top_p: req.params.topP,
            }
          : {}),
        ...(useThinking && req.provider.type === "openai"
          ? { reasoning_effort: req.params.effortLevel }
          : {}),
        ...(["kimi", "kimi-code"].includes(req.provider.id) &&
        req.conversationId
          ? { prompt_cache_key: req.conversationId }
          : {}),
        messages: [
          ...(req.systemPrompt
            ? [{ role: "system", content: req.systemPrompt }]
            : []),
          ...req.messages,
        ],
      }),
      signal: req.signal,
    },
  );

  if (!response.ok) {
    throw await providerError(response);
  }

  let tokensUsed: number | undefined;
  let reasoning = "";
  let streamError: string | undefined;
  await readSseStream(
    response,
    (data) => {
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: string | Array<{ text?: string }>;
              reasoning_content?: string;
            };
          }>;
          usage?: { total_tokens?: number };
          error?: { message?: string };
        };
        if (parsed.error?.message) streamError = parsed.error.message;
        const delta = parsed.choices?.[0]?.delta;
        const content = delta?.content;
        const token = Array.isArray(content)
          ? content.map((part) => part.text ?? "").join("")
          : content;
        if (token) req.onToken(token);
        if (delta?.reasoning_content) {
          reasoning += delta.reasoning_content;
        }
        if (parsed.usage?.total_tokens) tokensUsed = parsed.usage.total_tokens;
      } catch {
        // Partial JSON chunks are expected mid-stream; skip them.
      }
    },
    req.signal,
  );
  if (streamError) throw new Error(streamError);
  return { tokensUsed, reasoning: reasoning || undefined };
}

async function streamOpenAiResponses(
  req: StreamRequest,
): Promise<StreamResult> {
  const fetchFn = await getFetch();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...req.customHeaders,
  };
  if (req.apiKey) headers.Authorization = `Bearer ${req.apiKey}`;

  const useThinking =
    modelSupportsThinking(req.model) && req.params.thinkingEnabled;
  const response = await fetchFn(apiUrl(req.provider.baseUrl, "responses"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: req.model.id,
      stream: true,
      store: false,
      max_output_tokens: req.params.maxTokens,
      ...(useThinking
        ? { reasoning: { effort: req.params.effortLevel } }
        : {
            temperature: req.params.temperature,
            top_p: req.params.topP,
          }),
      ...(req.systemPrompt ? { instructions: req.systemPrompt } : {}),
      input: req.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
    signal: req.signal,
  });

  if (!response.ok) throw await providerError(response);

  let tokensUsed: number | undefined;
  let reasoning = "";
  let streamError: string | undefined;
  await readSseStream(
    response,
    (data) => {
      if (data === "[DONE]") return;
      try {
        const event = JSON.parse(data) as {
          type?: string;
          delta?: string;
          message?: string;
          error?: { message?: string };
          response?: { usage?: { total_tokens?: number }; output?: unknown[] };
          item?: { type?: string; content?: Array<{ type?: string; text?: string }> };
        };
        if (event.type === "response.output_text.delta" && event.delta) {
          req.onToken(event.delta);
        }
        if (event.type === "response.reasoning_text.delta" && event.delta) {
          reasoning += event.delta;
        }
        if (event.type === "response.completed") {
          tokensUsed = event.response?.usage?.total_tokens;
          const output = event.response?.output;
          if (Array.isArray(output)) {
            for (const item of output) {
              const reasoningItem = item as {
                type?: string;
                content?: Array<{ type?: string; text?: string }>;
              };
              if (reasoningItem.type === "reasoning" && reasoningItem.content) {
                for (const part of reasoningItem.content) {
                  if (part.type === "reasoning_text" && part.text) {
                    reasoning += part.text;
                  }
                }
              }
            }
          }
        }
        if (event.type === "error" || event.type === "response.failed") {
          streamError =
            event.error?.message ??
            event.message ??
            "The response stream failed.";
        }
      } catch {
        // Ignore keep-alives and non-JSON extension events.
      }
    },
    req.signal,
  );
  if (streamError) throw new Error(streamError);
  return { tokensUsed, reasoning: reasoning || undefined };
}

async function streamAnthropic(req: StreamRequest): Promise<StreamResult> {
  const fetchFn = await getFetch();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    ...req.customHeaders,
  };
  if (req.apiKey) {
    if (req.provider.id === "opencode")
      headers.Authorization = `Bearer ${req.apiKey}`;
    else headers["x-api-key"] = req.apiKey;
  }

  const useThinking =
    modelSupportsThinking(req.model) && req.params.thinkingEnabled;
  const thinkingBudget = useThinking
    ? Math.max(1024, Math.min(Math.floor(req.params.maxTokens * 0.8), 32000))
    : 0;
  const response = await fetchFn(
    anthropicApiUrl(req.provider.baseUrl, "messages"),
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: req.model.id,
        stream: true,
        max_tokens: req.params.maxTokens,
        ...(useThinking
          ? {
              thinking: {
                type: "enabled",
                budget_tokens: thinkingBudget,
              },
            }
          : {
              temperature: req.params.temperature,
              top_p: req.params.topP,
            }),
        ...(req.systemPrompt ? { system: req.systemPrompt } : {}),
        messages: req.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: req.signal,
    },
  );

  if (!response.ok) {
    throw await providerError(response);
  }

  let reasoning = "";
  await readSseStream(
    response,
    (data) => {
      try {
        const parsed = JSON.parse(data) as {
          type?: string;
          delta?: { type?: string; text?: string; thinking?: string };
        };
        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          req.onToken(parsed.delta.text);
        }
        if (
          parsed.type === "content_block_delta" &&
          parsed.delta?.thinking
        ) {
          reasoning += parsed.delta.thinking;
        }
      } catch {
        // Ignore non-JSON keep-alive lines.
      }
    },
    req.signal,
  );
  return { reasoning: reasoning || undefined };
}

export async function streamChatCompletion(
  req: StreamRequest,
): Promise<StreamResult> {
  switch (apiMode(req)) {
    case "responses":
      return streamOpenAiResponses(req);
    case "anthropic-messages":
      return streamAnthropic(req);
    case "chat-completions":
      return streamOpenAiCompatible(req);
  }
}

const TITLE_GENERATION_SYSTEM_PROMPT =
  "You are a helpful assistant that names chats. Given a conversation, produce a very short, useful title (3–5 words, maximum 30 characters). Reply with only the title. No quotes, no markdown, no explanation.";

export async function generateSessionTitle(
  messages: OutgoingMessage[],
  provider: Provider,
  model: ModelInfo,
  apiKey: string | null,
  customHeaders?: Record<string, string>,
): Promise<string | null> {
  const abort = new AbortController();
  let title = "";
  try {
    await streamChatCompletion({
      provider,
      apiKey,
      model,
      messages: [
        {
          role: "user",
          content: `${TITLE_GENERATION_SYSTEM_PROMPT}\n\nConversation:\n${messages
            .map((m) => `${m.role}: ${m.content.slice(0, 400)}`)
            .join("\n\n")}`,
        },
      ],
      systemPrompt: TITLE_GENERATION_SYSTEM_PROMPT,
      params: { temperature: 0.4, maxTokens: 20, topP: 1, effortLevel: "medium", thinkingEnabled: false },
      customHeaders,
      signal: abort.signal,
      onToken: (token) => {
        title += token;
      },
    });
  } catch {
    return null;
  }

  const cleaned = title
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ");
  return cleaned ? compactTitle(cleaned, 30) : null;
}

const COMMIT_MESSAGE_SYSTEM_PROMPT =
  "Write one clear Git commit subject in imperative mood. Describe the meaningful change, not the filenames. Maximum 72 characters. Reply with only the subject: no quotes, markdown, prefix, or explanation.";

export async function generateCommitMessage(
  diff: string,
  provider: Provider,
  model: ModelInfo,
  apiKey: string | null,
  customHeaders?: Record<string, string>,
): Promise<string | null> {
  let message = "";
  try {
    await streamChatCompletion({
      provider,
      apiKey,
      model,
      messages: [{ role: "user", content: `Git changes:\n${diff}` }],
      systemPrompt: COMMIT_MESSAGE_SYSTEM_PROMPT,
      params: { temperature: 0.2, maxTokens: 32, topP: 1, effortLevel: "medium", thinkingEnabled: false },
      customHeaders,
      signal: new AbortController().signal,
      onToken: (token) => {
        message += token;
      },
    });
  } catch {
    return null;
  }

  const cleaned = message
    .trim()
    .split("\n", 1)[0]
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/\s+/g, " ");
  return cleaned ? compactTitle(cleaned, 72) : null;
}

function inferModelApiMode(
  provider: Provider,
  id: string,
): ProviderApiMode | undefined {
  if (provider.id === "opencode") {
    if (/^(claude-|qwen)/i.test(id)) return "anthropic-messages";
    if (/^(gpt-|o\d|codex|grok-|muse-)/i.test(id)) return "responses";
    return "chat-completions";
  }
  return provider.apiMode;
}

function displayModelName(id: string): string {
  return id
    .split("/")
    .at(-1)!
    .split("-")
    .map((part) =>
      /^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function defaultPricing(
  providerId: string,
  modelId: string,
): ModelPricing | undefined {
  const provider = DEFAULT_PROVIDERS.find((p) => p.id === providerId);
  return provider?.models.find((m) => m.id === modelId)?.pricing;
}

function enrichModelInfo(
  provider: Provider,
  id: string,
  name?: string,
  contextWindow?: number,
): ModelInfo {
  const resolvedContextWindow =
    contextWindow && contextWindow > 0
      ? contextWindow
      : (provider.contextWindow && provider.contextWindow > 0
          ? provider.contextWindow
          : 128_000);
  const common: ModelInfo = {
    id,
    selectionId: `${provider.id}::${id}`,
    name: name ?? displayModelName(id),
    providerId: provider.id,
    contextWindow: resolvedContextWindow,
    capabilities: ["streaming"],
    apiMode: inferModelApiMode(provider, id),
  };

  const info = ((): ModelInfo => {
    // OpenAI
    if (provider.id === "openai") {
      if (id.startsWith("gpt-5.6")) {
        return {
          ...common,
          contextWindow: contextWindow || 1_050_000,
          capabilities: ["vision", "tools", "reasoning", "streaming"],
        };
      }
      if (id.includes("codex") || /^o\d/.test(id)) {
        return {
          ...common,
          capabilities: ["vision", "tools", "reasoning", "streaming"],
        };
      }
      if (id.includes("gpt-4o") || id.includes("gpt-4.5")) {
        return {
          ...common,
          contextWindow: 128_000,
          capabilities: ["vision", "tools", "streaming"],
        };
      }
      if (id.startsWith("o1") || id.startsWith("o3")) {
        return {
          ...common,
          contextWindow: 200_000,
          capabilities: ["reasoning", "tools", "streaming"],
        };
      }
      if (id.includes("gpt-4")) {
        return {
          ...common,
          contextWindow: 128_000,
          capabilities: ["tools", "streaming"],
        };
      }
      return common;
    }

    // Anthropic
    if (provider.id === "anthropic") {
      const base: ModelInfo = {
        ...common,
        contextWindow: 200_000,
        capabilities: ["vision", "tools", "streaming"],
      };
      if (id.includes("opus") || id.includes("sonnet")) {
        return {
          ...base,
          capabilities: ["vision", "tools", "reasoning", "streaming"],
        };
      }
      return base;
    }

    if (provider.id === "openrouter") {
      return {
        ...common,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
      };
    }

    if (provider.id === "xai") {
      return {
        ...common,
        contextWindow: contextWindow || 500_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
      };
    }

    if (provider.id === "opencode") {
      return {
        ...common,
        contextWindow:
          contextWindow || (id.startsWith("gpt-5.6") ? 1_050_000 : 200_000),
        capabilities: ["tools", "reasoning", "streaming"],
      };
    }

    // Moonshot Open Platform
    if (provider.id === "kimi") {
      if (id.includes("k3")) {
        return {
          ...common,
          contextWindow: 1_048_576,
          capabilities: ["tools", "streaming"],
        };
      }
      if (id.includes("k2")) {
        return {
          ...common,
          contextWindow: 256_000,
          capabilities: ["tools", "streaming"],
        };
      }
      return common;
    }

    // Kimi Code
    if (provider.id === "kimi-code") {
      if (id === "k3") {
        return {
          ...common,
          contextWindow: 1_048_576,
          capabilities: ["tools", "streaming"],
        };
      }
      return {
        ...common,
        contextWindow: 256_000,
        capabilities: ["tools", "streaming"],
      };
    }

    return common;
  })();

  return { ...info, pricing: info.pricing ?? defaultPricing(provider.id, id) };
}

export async function fetchProviderModels(
  provider: Provider,
  apiKey?: string | null,
): Promise<ModelInfo[]> {
  if (provider.discoverModels === false) {
    const id = provider.defaultModelId?.trim();
    if (!id) return [];
    return [enrichModelInfo(provider, id, undefined, provider.contextWindow)];
  }
  const fetchFn = await getFetch();
  const headers: Record<string, string> = {};
  if (apiKey && provider.type === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const url =
    provider.type === "anthropic" || provider.apiMode === "anthropic-messages"
      ? anthropicApiUrl(provider.baseUrl, "models")
      : apiUrl(provider.baseUrl, "models");
  const response = await fetchFn(url, { method: "GET", headers });
  if (!response.ok) throw await providerError(response);
  const data = (await response.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      display_name?: string;
      context_length?: number;
      max_input_tokens?: number;
    }>;
    models?: Array<{
      id: string;
      name?: string;
      display_name?: string;
      context_length?: number;
      max_input_tokens?: number;
    }>;
  };
  const entries = data.data ?? data.models ?? [];
  const filtered = entries.filter((entry) => {
    if (provider.id === "opencode" && entry.id.startsWith("gemini-"))
      return false;
    if (provider.id !== "openai") return true;
    return !/(audio|realtime|transcrib|tts|image|embedding|moderation|whisper|sora|babbage|davinci)/i.test(
      entry.id,
    );
  });
  const discovered = filtered.map((entry) =>
    enrichModelInfo(
      provider,
      entry.id,
      entry.display_name ?? entry.name,
      entry.context_length ?? entry.max_input_tokens,
    ),
  );
  const defaultId = provider.defaultModelId?.trim();
  if (
    defaultId &&
    !discovered.some((model) => model.id === defaultId)
  ) {
    discovered.unshift(
      enrichModelInfo(provider, defaultId, undefined, provider.contextWindow),
    );
  }
  return discovered;
}

export async function testProviderConnection(
  provider: Provider,
  apiKey?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const keyRequired = !["local", "custom"].includes(provider.type);
  if (keyRequired && !apiKey) {
    return {
      ok: false,
      error: "Save an API key before testing this provider.",
    };
  }
  try {
    if (provider.id === "openrouter" && apiKey) {
      const fetchFn = await getFetch();
      const response = await fetchFn(apiUrl(provider.baseUrl, "key"), {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) throw await providerError(response);
    }
    const models = await fetchProviderModels(provider, apiKey);
    return models.length > 0
      ? { ok: true }
      : { ok: false, error: "Connected, but the provider returned no models." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchProviderAccountInfo(
  provider: Provider,
  apiKey?: string | null,
): Promise<ProviderAccountInfo | null> {
  if (!apiKey) return null;

  // Only Kimi / Moonshot exposes account/balance endpoints today.
  if (provider.id !== "kimi") return null;

  const fetchFn = await getFetch();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  const info: ProviderAccountInfo = {};
  const baseUrl = provider.baseUrl.replace(/\/$/, "");

  // The /users/me endpoint is undocumented but observed to exist.
  // We parse any plan/tier fields defensively and ignore failures.
  try {
    const response = await fetchFn(`${baseUrl}/users/me`, {
      method: "GET",
      headers,
    });
    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      const planValue =
        data["plan"] ?? data["tier"] ?? data["user_type"] ?? data["membership"];
      if (typeof planValue === "string" && planValue.trim()) {
        info.plan = planValue.trim();
      }
    }
  } catch {
    // Ignore — balance is enough to confirm the key works.
  }

  try {
    const response = await fetchFn(`${baseUrl}/users/me/balance`, {
      method: "GET",
      headers,
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        data?: {
          available_balance?: number;
          voucher_balance?: number;
          cash_balance?: number;
        };
      };
      const data = payload.data;
      if (data && typeof data.available_balance === "number") {
        info.balance = data.available_balance;
      }
      // The .ai endpoint returns USD, the .cn endpoint returns CNY.
      info.currency = baseUrl.includes("moonshot.cn") ? "CNY" : "USD";
    }
  } catch {
    // Ignore.
  }

  return info.plan !== undefined || info.balance !== undefined ? info : null;
}
