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

const DEMO_RESPONSES: Array<{ match: RegExp; body: string }> = [
  {
    match: /\b(hello|hi|hey|greetings|howdy|good (morning|afternoon|evening))\b/i,
    body: `Hey there! Welcome to Black One.

I'm the built-in offline demo model, so I'm running entirely on your machine — no API key, no network call, full privacy.

You can chat with me to test the interface, queue messages, try attachments, or switch views. When you're ready for real AI responses, connect a provider in **Settings → Providers**.

What would you like to explore?`,
  },
  {
    match: /\b(help|what can you do|commands|how do you work|what are you|who are you)\b/i,
    body: `Here's what you can do in Black One:

**Ask**
- Send messages with text, images, files, or URLs
- Edit past messages and branch conversations
- Queue multiple messages while another streams

**Views**
- **Ask** — explanations, analysis, planning, and writing
- **Code** — hands-on coding beside the integrated terminal
- **Agent** — autonomous tasks that inspect, act, and verify

**Settings**
- **Providers** — add OpenAI, Anthropic, or custom endpoints
- **Appearance** — themes, accent color, font size
- **Memory** — long-term facts across chats
- **Advanced** — custom headers, raw responses, developer mode

Try asking me something technical, creative, or ask for a comparison. I'm a demo, but I'll respond with a realistic template.

> Connect a real provider to unlock actual reasoning and up-to-date knowledge.`,
  },
  {
    match: /\b(black one|about this app|who made you|what is black one|features|what can black one do|what does black one do|where do I find|how do I use)\b/i,
    body: `Black One is a local-first desktop AI chat client for Windows, macOS, and Linux.

**What it can do**
- Multi-provider streamed chat: OpenAI, Anthropic, OpenRouter, xAI, OpenCode, Kimi, Kimi Code, and local OpenAI-compatible endpoints
- Chat sessions with folders, archive, pinning, branching, editing, and regeneration
- Message queue for sending multiple prompts while another streams
- Attachments: files, folders, images, clipboard images, and URLs
- Native multi-terminal (PTY) in Code view with multiple tabs
- Long-term memory with categories and a built-in memory viewer
- Custom system prompts, personalities, and timezone awareness
- Full-app themes, accent colors, font sizes, and sidebar layout presets
- Custom provider headers, raw response viewing, and model discovery
- Haptic feedback, notification sounds, Do Not Disturb, and tray integration
- Quick Chat popup for fast queries from anywhere
- Git controls in the right panel when a folder attachment is a repo

**Views**
- **Ask** — read-only questions, explanations, and planning
- **Code** — technical workspace with the integrated terminal
- **Agent** — task-focused workers for building, investigation, and automation

**Where to find things**
- Settings: **Cmd/Ctrl + ,** or the gear icon in the title bar
- Providers & API keys: **Settings → Providers**
- Model picker: composer dropdown or **Cmd/Ctrl + K**
- Memory viewer: **Settings → Memory & History**
- Themes, accent color, and font size: **Settings → Appearance**
- Sidebar position and layout presets: **Settings → Appearance** or the layout grid icon
- Terminal: switch to **Code** view or press **Cmd/Ctrl + Shift + T**
- Right panel (Sources, Files, Preview, Agent): click the right-sidebar icon or press **Cmd/Ctrl + Shift + B**
- Shortcuts: **Settings → Shortcuts**
- Tray menu: right-click the Black One icon in the system tray
- Data folder: **Settings → Advanced → Open data folder**
- Check for updates: **Settings → About**

**Privacy**
- Desktop data is stored in SQLite with WAL mode
- API keys are stored in the OS keyring
- Browser preview uses IndexedDB
- This demo model runs offline with no API key

Ask me about providers, shortcuts, memory, terminal, attachments, views, themes, or any setting.`,
  },
  {
    match: /\b(settings|where (do|can) I find|how (do|can) I (change|configure|set)|preferences|configuration)\b/i,
    body: `Settings are organized into sections. Open them with **Cmd/Ctrl + ,** or the gear icon.

- **Providers** — add API keys, toggle providers, set default models, test connections, configure custom endpoints
- **Models** — temperature, max tokens, top-p, default model, visible models
- **Appearance** — light/dark/system, font size, sidebar position, accent color, theme preset
- **Chat** — system prompt, personality, timezone, image attachment mode, reasoning blocks, timestamps
- **Memory & History** — context window, long-term memory, auto-extract, memory categories, memory viewer
- **Safety** — content filter, attachment scanning, rejection style
- **Notifications** — desktop notifications, sounds, Do Not Disturb schedule
- **Tools** — tool permissions and configured tools
- **Haptics** — click, finish, and error sounds
- **Archive** — automatic archive after inactivity
- **Advanced** — developer mode, raw responses, custom headers, log level, tray behavior
- **Shortcuts** — keyboard bindings
- **About** — app info`,
  },
  {
    match: /\b(providers?|models?|api key|openai|anthropic|claude|gpt|kimi|grok|openrouter|local model|ollama|endpoint)\b/i,
    body: `Black One supports several provider types out of the box:

- **Black One (demo)** — offline, no API key, runs locally (that's me)
- **OpenAI** — Responses API with GPT-5.6 Sol/Terra/Luna and Codex
- **Anthropic** — Messages API with Claude Sonnet 5, Opus 5, Haiku 4.5
- **OpenRouter** — routes to many models including GPT, Claude, Grok
- **xAI** — Grok 4.6
- **OpenCode Zen** — GPT-5.6 Sol/Terra, Kimi K3, Big Pickle
- **Kimi (Moonshot)** — Kimi K3, K2.6, K2.7 Code
- **Kimi Code** — coding-focused Kimi models
- **Local** — any OpenAI-compatible local server, e.g., Ollama at http://localhost:11434/v1
- **Custom endpoints** — add your own OpenAI-compatible provider

Add or enable providers in **Settings → Providers**. You can also set a default model per provider and test the connection.`,
  },
  {
    match: /\b(shortcuts?|keyboard|hotkey|keybinding|cmd\+|ctrl\+|mod\+|escape|press)\b/i,
    body: `Keyboard shortcuts in Black One:

| Action | Binding |
| --- | --- |
| New chat | Mod+N |
| New chat in window | Mod+Shift+N |
| Attach file | Mod+O |
| Attach folder | Mod+Shift+O |
| Toggle sidebar | Mod+B |
| Toggle right sidebar | Mod+Shift+B |
| Open settings | Mod+, |
| Command palette / model search | Mod+K |
| Copy last response | Mod+Shift+C |
| Focus composer | Mod+/ |
| Edit last message | Mod+Up |
| Stop generation / close modal | Escape |
| Previous chat | Mod+Shift+[ |
| Next chat | Mod+Shift+] |
| Toggle dark mode | Mod+Shift+D |
| Zen mode (hide sidebar) | Mod+Alt+H |
| New terminal | Mod+Shift+T |

"Mod" is Ctrl on Windows/Linux and Cmd on macOS.

Change bindings in **Settings → Shortcuts**.`,
  },
  {
    match: /\b(memory|memories|remember|context window|long.term|extract|forget)\b/i,
    body: `Black One has two kinds of memory:

**Context window**
- The most recent N messages are sent with each request
- Configurable in **Settings → Memory & History** (default 50)

**Long-term memory**
- Enabled by default; stores facts across chats
- Auto-extracts memories after each assistant response
- Categories: personal, work, hobbies, projects, preferences, writing style, goals, relationships, other
- Pruned automatically when the bank reaches the size limit
- View, copy, or delete memories from the **Memory viewer** in **Settings → Memory & History**

Memory is saved locally with everything else.`,
  },
  {
    match: /\b(terminal|shell|pty|bash|zsh|powershell|command line|console)\b/i,
    body: `Black One includes a native multi-terminal in the **Code** view.

**What it can do**
- Create multiple terminal tabs
- PTY-backed shells with resize, input, and streaming output
- xterm.js rendering with screen-reader mode
- Open a new terminal with **Mod+Shift+T**

The terminal uses portable-pty on the Rust side and communicates over Tauri's IPC. It's real — not a mock — so you can run your normal shell commands.

Switch to **Code** view from the top navigation to use it.`,
  },
  {
    match: /\b(attachments?|attach|upload|image|file|folder|url|clipboard|paste)\b/i,
    body: `Black One supports several attachment types:

- **Files** — text files, code, documents
- **Folders** — attach an entire directory
- **Images** — from file picker or clipboard paste
- **URLs** — fetch a page and include its content

Image attachments have three modes in **Settings → Chat**:
- **Auto** — include image content when the model supports vision
- **Text-only** — send extracted text/description instead
- **Disabled** — ignore image content

Attachments are shown in the composer and saved with the message. The max preview size is configurable.`,
  },
  {
    match: /\b(views?|mode|chat view|code view|agent view|switch view)\b/i,
    body: `Black One has three top-level modes:

**Ask**
- Read-only questions, analysis, planning, and writing
- Can inspect attached files for evidence without changing them

**Code**
- Pair-programming workspace with the native terminal
- Inspects, edits, and validates attached projects

**Agent**
- Owns a requested outcome from inspection through verification
- Builder, Investigator, and Automation task presets

Switch views from the top navigation or the sidebar.`,
  },
  {
    match: /\b(code|function|component|typescript|rust|bug|error|fix|implement|refactor|debug)\b/i,
    body: `Here is a focused breakdown.

## Approach

Isolate the logic behind a small, testable unit, then wire it into the surrounding flow.

\`\`\`ts
interface RetryOptions {
  attempts: number;
  delayMs: number;
}

export async function withRetry<T>(
  task: () => Promise<T>,
  { attempts, delayMs }: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * (attempt + 1)),
      );
    }
  }
  throw lastError;
}
\`\`\`

Key points:

- **Back-off is linear** here; switch to exponential if the downstream is rate-limited.
- **Errors are rethrown** after the final attempt so callers keep full context.
- The helper is generic, so it composes with any async task.

| Concern | Handling |
| ------- | -------- |
| Retries | Bounded by \`attempts\` |
| Delay | \`delayMs * attempt\` |
| Failure | Last error propagates |

If you share the surrounding call site, I can adapt this to fit it exactly.`,
  },
  {
    match: /\b(compare|vs\b|versus|difference|better|pros? and cons?|trade[- ]offs?)\b/i,
    body: `Here is the honest comparison.

## Trade-offs

| Dimension | Option A | Option B |
| --------- | -------- | -------- |
| Complexity | Low upfront | Higher upfront |
| Scaling | Manual | Automatic |
| Lock-in | None | Moderate |

1. **Start with the simpler option** until the constraint it solves actually appears.
2. **Measure before migrating** — intuition about bottlenecks is usually wrong.
3. Revisit the decision when load or team size doubles.

The short version: pick the boring technology for anything that is not your core differentiator, and spend the complexity budget where it earns its keep.`,
  },
  {
    match: /\b(explain|how (does|do|can|should)|what is|why is|what are|meaning of)\b/i,
    body: `Here is a clear explanation.

## In one sentence

This concept is a pattern for organizing work so that each part has a single responsibility and a clear boundary.

## Breaking it down

1. **Inputs** — what information enters the system.
2. **Process** — the transformation or decision that happens inside.
3. **Outputs** — the result and where it goes next.

## Why it matters

- Easier to reason about in isolation.
- Easier to test, debug, and extend.
- Reduces the chance that a change in one place breaks another.

## Common gotcha

People often split too early. Start with a single unit, then extract boundaries once the pain is real and the shape is clear.

Want me to apply this to a specific example?`,
  },
  {
    match: /\b(story|poem|write|creative|imagine|fiction|dialogue)\b/i,
    body: `Here is a short piece for you.

---

The old terminal hummed in the corner of the room, its green cursor blinking like a heartbeat that had outlived its owner. Mara sat cross-legged on the floor, fingers hovering over keys she wasn't sure she should press.

"Just one command," she whispered.

The screen flickered. Lines of text scrolled faster than she could read, then stopped. A single prompt waited:

\`> What will you build?\`

Mara smiled and began to type.

---

That's a demo response, of course. With a real model connected, I can tailor tone, length, genre, and characters to whatever you need.`,
  },
  {
    match: /\b(summarize|summary|tl;dr|tldr|recap|main points?)\b/i,
    body: `## Summary

1. **The big idea** — a concise statement of the main point.
2. **Key supporting points** — the evidence or reasoning that matters most.
3. **Implications** — what this means in practice.
4. **Next step** — one concrete action to take away.

---

**TL;DR:** Focus on the core insight, strip the rest, and leave the reader with one thing to do.

This is a template from the offline demo. With a live provider, I would summarize the actual conversation or document you provide.`,
  },
  {
    match: /\b(should I|recommend|advice|opinion|what do you think|best way to|tips?)\b/i,
    body: `Here is my take.

## Recommendation

Start with the smallest version that validates your assumption. Complexity is easy to add later; wrong assumptions are expensive to unwind.

## Practical steps

1. **Define the goal** in one sentence.
2. **List constraints** — time, budget, skills, existing stack.
3. **Pick the option with the fewest unknowns** for the first iteration.
4. **Set a review point** before adding anything optional.

## What I'd watch out for

- Over-engineering the first version.
- Ignoring maintenance cost.
- Choosing novelty over fit.

A real model would weigh your specific context here. Connect a provider in **Settings → Providers** when you want that.`,
  },
  {
    match: /\b(thanks|thank you|appreciate|cheers)\b/i,
    body: `You're welcome! Happy to help, even in demo mode.

If you want real AI responses — with reasoning, coding help, summaries, and more — just connect a provider in **Settings → Providers**. Until then, feel free to keep testing the app.`,
  },
  {
    match: /\b(bye|goodbye|see you|later|exit|quit)\b/i,
    body: `Goodbye! Your sessions and messages are saved locally, so they'll be here when you come back.

If you switch to a real provider later, those same chats will work with live responses too.`,
  },
  {
    match: /\b(joke|funny|humor|laugh|pun)\b/i,
    body: `Why did the developer go broke?

Because they used up all their cache.

---

I know, I know — the demo model's humor budget is limited. A real AI might land the punchline better.`,
  },
];

function buildDemoFallback(prompt: string): string {
  const snippet =
    prompt.length > 80 ? `${prompt.slice(0, 77).trim()}…` : prompt;
  return `You asked about: *"${snippet}"*

Since I'm the built-in offline demo model, I can't reason about that topic in real time. I can show you what a response would look like:

1. **Understand** the core question.
2. **Break it into sub-tasks**.
3. **Produce a structured answer** with examples where useful.

To get a real answer, connect a provider in **Settings → Providers**. OpenAI, Anthropic, and any OpenAI-compatible endpoint — including local servers like Ollama — are supported.

In the meantime, everything else in the app — sessions, folders, attachments, branching, and the queue — works exactly as it would with a live model.`;
}

function buildDemoResponse(prompt: string): string {
  const hit = DEMO_RESPONSES.find((entry) => entry.match.test(prompt));
  return hit ? hit.body : buildDemoFallback(prompt);
}

async function streamDemo(req: StreamRequest): Promise<StreamResult> {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const body = buildDemoResponse(lastUser?.content ?? "");
  const words = body.split(/(?<=\s)/);
  for (const word of words) {
    if (req.signal.aborted) break;
    req.onToken(word);
    await new Promise((resolve) =>
      setTimeout(resolve, 18 + Math.random() * 30),
    );
  }
  const citations: Citation[] | undefined = /http|source|cite/i.test(
    lastUser?.content ?? "",
  )
    ? [
        {
          id: generateId(),
          index: 1,
          title: "Black One documentation",
          url: "https://github.com/black-one/black-one",
          snippet: "Sessions, providers, and streaming architecture.",
        },
      ]
    : undefined;
  return { tokensUsed: estimateTokens(body), citations };
}

export async function streamChatCompletion(
  req: StreamRequest,
): Promise<StreamResult> {
  if (req.provider.type === "demo") return streamDemo(req);
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
  if (provider.type === "demo") return null;

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
  if (provider.type === "demo") return null;

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
  if (provider.type === "demo") return provider.models;
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
  if (provider.type === "demo") return { ok: true };
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
  if (provider.type === "demo" || !apiKey) return null;

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
