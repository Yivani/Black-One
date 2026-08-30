import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { toast } from "sonner";
import type { Attachment, Message, QueuedMessage } from "@/types/chat";
import {
  DEMO_PROVIDER_ID,
  MAX_QUEUE_SIZE,
  STREAM_FLUSH_INTERVAL_MS,
} from "@/lib/constants";
import { persistence } from "@/lib/persistence";
import { generateSessionTitle, streamChatCompletion, type OutgoingMessage } from "@/lib/api";
import {
  deriveSessionTitle,
  estimateMessageCost,
  estimateTokens,
  generateId,
} from "@/lib/utils";
import { playErrorSound } from "@/hooks/useHaptics";
import { extractAndStoreMemory, renderMemoryPrompt } from "@/lib/memory";
import {
  buildModeSystemPrompt,
  isIncompleteAgentResponse,
} from "@/lib/modePrompt";
import { reportAppError } from "@/lib/errors";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useModelStore } from "@/stores/modelStore";
import { useUiStore } from "@/stores/uiStore";
import { useToolRuntimeStore } from "@/stores/toolRuntimeStore";
import { ipc, isTauri } from "@/lib/ipc";
import {
  buildToolSystemPrompt,
  executeTool,
  extractAttachedFolders,
  parseToolCalls,
  parseToolResults,
  serializeToolResult,
  shouldAutoApprove,
  stripToolCalls,
  type ToolCall,
  type ToolContext,
} from "@/lib/tools";

let activeAbort: AbortController | null = null;
const AGENT_EXECUTION_NUDGE =
  "<agent_execution_required>The previous response only described future work or contained reasoning without performing it. Do not repeat the plan. Use the first required workspace tool now. If tools are unavailable, state the exact blocker.</agent_execution_required>";

/** Cached cwd so we don't call the backend on every turn. */
let cachedCwd: string | null = null;

async function getDefaultWorkspace(): Promise<string | null> {
  if (!isTauri) return null;
  if (cachedCwd) return cachedCwd;
  try {
    cachedCwd = await ipc.getCwd();
    return cachedCwd;
  } catch {
    return null;
  }
}

function getModelForSession(modelId?: string) {
  const modelStore = useModelStore.getState();
  if (modelId) {
    for (const provider of modelStore.providers) {
      const model = provider.models.find(
        (candidate) =>
          candidate.selectionId === modelId || candidate.id === modelId,
      );
      if (model) return { provider, model };
    }
  }
  return modelStore.getSelectedModel();
}

async function resolveAttachedFolders(
  sessionId: string,
  attachments: Attachment[] = [],
  allowDefaultWorkspace = false,
): Promise<string[]> {
  const explicit = extractAttachedFolders(attachments).concat(
    collectAttachedFolderPaths(sessionId),
  );
  if (explicit.length > 0) return explicit;
  if (!allowDefaultWorkspace) return [];
  const cwd = await getDefaultWorkspace();
  return cwd ? [cwd] : [];
}
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let memoryExtractionQueue = Promise.resolve();

const PERSONALITY_INSTRUCTIONS: Record<string, string> = {
  helpful:
    "You are warm, patient, and eager to help. Explain things clearly and offer practical next steps.",
  concise:
    "Keep answers short and direct. Avoid unnecessary explanation unless the user asks for it.",
  technical:
    "Use precise technical language. Favor accurate details, edge cases, and implementation concerns over vague summaries.",
  creative:
    "Be imaginative and exploratory. Offer unexpected angles, vivid examples, and brainstorming where appropriate.",
  teacher:
    "Explain concepts step by step. Use analogies, check understanding, and encourage the user to reason along.",
  kawaii:
    "Be cheerful, gentle, and a little playful. Use cute, friendly language and emojis sparingly.",
  catgirl:
    "Speak like an enthusiastic catgirl. Use 'nya' and '~' occasionally, keep it light, and stay helpful.",
  pirate:
    "Speak like a pirate. Use nautical slang and a swashbuckling tone, but stay accurate and helpful.",
  shakespeare:
    "Speak in the style of Shakespeare: dramatic, eloquent, and in Early Modern English when it feels natural.",
};

function buildPersonalityInstruction(personality: string): string | undefined {
  if (personality === "none" || !personality) return undefined;
  return PERSONALITY_INSTRUCTIONS[personality];
}

function buildTimezoneInstruction(timezone: string): string | undefined {
  if (!timezone) return undefined;
  const now = new Date().toLocaleString("en-US", { timeZone: timezone });
  return `The current local date and time for the user is ${now} in timezone ${timezone}.`;
}

function collectAttachedFolderPaths(sessionId: string): string[] {
  const messages = useChatStore.getState().messagesBySession[sessionId] ?? [];
  const seen = new Set<string>();
  const folders: string[] = [];
  for (const message of messages) {
    const attachments = message.attachments ?? [];
    for (const attachment of attachments) {
      if (attachment.kind === "folder" && attachment.path && !seen.has(attachment.path)) {
        seen.add(attachment.path);
        folders.push(attachment.path);
      }
    }
  }
  return folders;
}

export interface ChatState {
  messagesBySession: Record<string, Message[]>;
  streamingSessionId: string | null;
  isThinking: boolean;
  queue: QueuedMessage[];
  /** sessionId -> number of messages actually sent as context (set when truncated). */
  contextNotice: Record<string, number>;
  /** sessionId -> current tool-loop iteration to prevent runaway agents. */
  toolLoopDepth: Record<string, number>;

  loadMessages: (sessionId: string) => Promise<void>;
  sendMessage: (
    content: string,
    attachments?: Attachment[],
    onPersisted?: (sessionId: string) => void,
    targetSessionId?: string,
  ) => Promise<void>;
  continueAssistantTurn: (sessionId: string) => Promise<void>;
  runToolLoop: (sessionId: string) => Promise<void>;
  submitToolResults: (
    sessionId: string,
    results: ToolCall[],
    shouldContinue?: boolean,
  ) => Promise<void>;
  stopStreaming: () => void;
  regenerateLast: () => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  branchFromMessage: (messageId: string) => Promise<void>;
  getLastResponse: () => string | null;
  getLastUserMessage: () => Message | null;
  enqueueMessage: (content: string, attachments?: Attachment[]) => void;
  removeQueued: (id: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  updateQueued: (id: string, content: string, attachments?: Attachment[]) => void;
  moveQueuedToTop: (id: string) => void;
  moveQueuedUp: (id: string) => void;
  clearQueue: () => void;
  processQueue: () => Promise<void>;
}

function buildContextMessages(
  sessionId: string,
  messages: Message[],
): OutgoingMessage[] {
  const { memory, chat } = useSettingsStore.getState().settings;
  const usable = messages.filter(
    (m) =>
      m.status !== "error" &&
      m.role !== "memory" &&
      m.content.trim().length > 0,
  );
  const limited =
    usable.length > memory.contextWindowLimit
      ? usable.slice(-memory.contextWindowLimit)
      : usable;
  useChatStore.setState((state) => {
    if (usable.length > memory.contextWindowLimit) {
      state.contextNotice[sessionId] = limited.length;
    } else {
      delete state.contextNotice[sessionId];
    }
  });
  return limited.map((m) => {
    const imageMode = chat.imageAttachmentMode;
    const attachmentText = (m.attachments ?? [])
      .filter((a) => {
        if (a.kind !== "image") return true;
        return imageMode !== "disabled";
      })
      .map((a) => {
        if (a.kind === "image" && imageMode === "auto") {
          return a.textContent ?? `[Image attached: ${a.name}]`;
        }
        return a.textContent;
      })
      .filter(Boolean)
      .join("\n\n");
    return {
      role: m.role === "system" ? "user" : m.role,
      content: attachmentText ? `${m.content}\n\n${attachmentText}` : m.content,
    };
  });
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    messagesBySession: {},
    streamingSessionId: null,
    isThinking: false,
    queue: [],
    contextNotice: {},
    toolLoopDepth: {},

    loadMessages: async (sessionId) => {
      const messages = await persistence.listMessages(sessionId);
      set((state) => {
        state.messagesBySession[sessionId] = messages;
      });
      const resolved = new Set(
        messages
          .flatMap((message) =>
            message.toolResults ??
            (message.role === "system" ? parseToolResults(message.content) : []),
          )
          .map((call) => call.id),
      );
      const pending = messages
        .flatMap((message) =>
          message.toolCalls ?? parseToolCalls(message.content, message.id),
        )
        .filter((call) => call.status === "pending" && !resolved.has(call.id));
      useToolRuntimeStore.getState().queuePending(pending);
    },

    sendMessage: async (
      content,
      attachments = [],
      onPersisted?: (sessionId: string) => void,
      targetSessionId?: string,
    ) => {
      const trimmed = content.trim();
      if (!trimmed && attachments.length === 0) return;

      if (get().streamingSessionId) {
        get().enqueueMessage(trimmed, attachments);
        return;
      }

      const sessionStore = useSessionStore.getState();
      const sessionId =
        targetSessionId ?? (await sessionStore.ensureActiveSession());
      const settings = useSettingsStore.getState().settings;
      const session = sessionStore.sessions.find((s) => s.id === sessionId);
      const selected = getModelForSession(session?.modelId);
      const mode = session?.mode ?? "agent";

      if (!selected) {
        toast.error(
          "No model selected. Open Settings → Providers to configure one.",
        );
        return;
      }

      const now = Date.now();
      const userMessage: Message = {
        id: generateId(),
        sessionId,
        role: "user",
        content: trimmed,
        createdAt: now,
        status: "complete",
        mode,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      const assistantMessage: Message = {
        id: generateId(),
        sessionId,
        role: "assistant",
        content: "",
        createdAt: now + 1,
        status: "streaming",
        modelId: selected.model.id,
        providerId: selected.provider.id,
        mode,
      };

      const existing = get().messagesBySession[sessionId] ?? [];
      const history = [...existing, userMessage];

      set((state) => {
        state.messagesBySession[sessionId] = [...history, assistantMessage];
        state.streamingSessionId = sessionId;
        state.isThinking = true;
      });

      await persistence.addMessage(userMessage);
      await persistence.addMessage(assistantMessage);
      onPersisted?.(sessionId);

      const isFirstExchange = session && session.messageCount === 0;
      if (isFirstExchange) {
        sessionStore.touchSession(sessionId, {
          messageCount: 2,
          modelId: selected.model.id,
          mode,
        });
      } else {
        sessionStore.touchSession(sessionId, {
          messageCount: (session?.messageCount ?? 0) + 2,
          mode,
        });
      }

      const abort = new AbortController();
      activeAbort = abort;

      const flushContent = () => {
        set((state) => {
          const list = state.messagesBySession[sessionId];
          const target = list?.find((m) => m.id === assistantMessage.id);
          if (target) target.content = pendingContent;
        });
      };

      let pendingContent = "";
      const scheduleFlush = () => {
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
          flushTimer = null;
          flushContent();
        }, STREAM_FLUSH_INTERVAL_MS);
      };

      try {
        const apiKey = await useModelStore
          .getState()
          .getApiKey(selected.provider.id);
        const contextMessages = buildContextMessages(sessionId, history);
        const attachedFolders = await resolveAttachedFolders(
          sessionId,
          attachments,
          mode !== "chat",
        );
        const basePrompt =
          session?.systemPrompt ?? settings.chat.defaultSystemPrompt ?? "";
        const memoryPrompt = settings.memory.memoryPersistence
          ? await renderMemoryPrompt(undefined, settings.memory.memoryCategories)
          : "";
        const personalityPrompt = buildPersonalityInstruction(
          settings.chat.personality,
        );
        const timezonePrompt = buildTimezoneInstruction(settings.chat.timezone);
        const toolSettings = useSettingsStore.getState().settings.tools;
        const toolPrompt = buildToolSystemPrompt(attachedFolders, {
          ...(mode === "chat"
            ? {
                allowedTools: toolSettings.fileToolsEnabled
                  ? (["read_file", "list_dir"] as const)
                  : [],
              }
            : {
                fileTools: toolSettings.fileToolsEnabled,
                shellTools: toolSettings.shellToolsEnabled,
              }),
        });
        const modePrompt = buildModeSystemPrompt(
          mode,
          attachedFolders.length > 0 && Boolean(toolPrompt),
        );
        const systemPrompt =
          [basePrompt, memoryPrompt, personalityPrompt, timezonePrompt, modePrompt, toolPrompt]
            .filter(Boolean)
            .join("\n\n") || undefined;

        const result = await streamChatCompletion({
          provider: selected.provider,
          apiKey,
          model: selected.model,
          messages: contextMessages,
          systemPrompt: systemPrompt || undefined,
          conversationId: sessionId,
          params: {
            temperature: settings.model.temperature,
            maxTokens: settings.model.maxTokens,
            topP: settings.model.topP,
            effortLevel: settings.model.effortLevel,
            thinkingEnabled: settings.model.thinkingEnabled,
          },
          customHeaders: settings.advanced.customHeaders,
          signal: abort.signal,
          onToken: (token) => {
            pendingContent += token;
            scheduleFlush();
          },
        });

        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        pendingContent = pendingContent || "";
        const tokensUsed = result.tokensUsed ?? estimateTokens(pendingContent);
        const finalMessage: Message = {
          ...assistantMessage,
          content: pendingContent,
          status: abort.signal.aborted ? "stopped" : "complete",
          tokensUsed,
          cost: estimateMessageCost(selected.model.pricing, tokensUsed),
          citations: result.citations,
          reasoning: result.reasoning,
        };
        set((state) => {
          const list = state.messagesBySession[sessionId];
          const idx =
            list?.findIndex((m) => m.id === assistantMessage.id) ?? -1;
          if (list && idx >= 0) list[idx] = finalMessage;
          state.streamingSessionId = null;
          state.isThinking = false;
        });
        await persistence.updateMessage(finalMessage);

        if (isFirstExchange) {
          const generateTitle = async () => {
            try {
              const current = sessionStore.sessions.find((s) => s.id === sessionId);
              if (current && current.title !== "New chat") return;

              const outgoing: OutgoingMessage[] = [
                { role: "user", content: trimmed },
                { role: "assistant", content: pendingContent },
              ];
              const title = await generateSessionTitle(
                outgoing,
                selected.provider,
                selected.model,
                apiKey,
                settings.advanced.customHeaders,
              );
              await sessionStore.renameSession(
                sessionId,
                title ?? deriveSessionTitle(trimmed),
              );
            } catch {
              const current = sessionStore.sessions.find((s) => s.id === sessionId);
              if (current && current.title === "New chat") {
                await sessionStore.renameSession(sessionId, deriveSessionTitle(trimmed));
              }
            }
          };
          void generateTitle();
        }

        if (
          settings.memory.autoExtractMemory &&
          selected.provider.id !== DEMO_PROVIDER_ID &&
          !abort.signal.aborted &&
          pendingContent.trim()
        ) {
          const extract = async () => {
            const memoryResult = await extractAndStoreMemory(
              sessionId,
              trimmed,
              pendingContent,
              selected.provider,
              selected.model,
              apiKey,
            );
            if (!memoryResult.savedCount) return;
            const memoryMessage: Message = {
              id: generateId(),
              sessionId,
              role: "memory",
              content: JSON.stringify({
                count: memoryResult.savedCount,
                durationMs: memoryResult.durationMs,
                entries: memoryResult.entries,
              }),
              createdAt: assistantMessage.createdAt + 1,
              status: "complete",
            };
            await persistence.addMessage(memoryMessage);
            set((state) => {
              const list = state.messagesBySession[sessionId];
              if (!list || list.some((message) => message.id === memoryMessage.id)) return;
              list.push(memoryMessage);
              list.sort((a, b) => a.createdAt - b.createdAt);
            });
          };
          memoryExtractionQueue = memoryExtractionQueue
            .then(extract, extract)
            .catch((error) => console.error("Memory extraction failed", error));
        }

        await get().runToolLoop(sessionId);
      } catch (error) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        const message =
          error instanceof Error && error.name === "AbortError"
            ? null
            : error instanceof Error
              ? error.message
              : String(error);
        const finalMessage: Message = {
          ...assistantMessage,
          content: pendingContent,
          status: abort.signal.aborted ? "stopped" : "error",
          errorMessage: message ?? undefined,
        };
        set((state) => {
          const list = state.messagesBySession[sessionId];
          const idx =
            list?.findIndex((m) => m.id === assistantMessage.id) ?? -1;
          if (list && idx >= 0) list[idx] = finalMessage;
          state.streamingSessionId = null;
          state.isThinking = false;
        });
        await persistence.updateMessage(finalMessage);
        if (isFirstExchange) {
          const current = sessionStore.sessions.find((s) => s.id === sessionId);
          if (current && current.title === "New chat") {
            await sessionStore.renameSession(sessionId, deriveSessionTitle(trimmed));
          }
        }
        if (message) {
          reportAppError(error, { category: "provider", source: "Chat generation" });
          toast.error("Generation failed", { description: message });
          playErrorSound();
        }
      } finally {
        activeAbort = null;
        void get().processQueue();
      }
    },

    continueAssistantTurn: async (sessionId) => {
      if (get().streamingSessionId) return;
      const sessionStore = useSessionStore.getState();
      const settings = useSettingsStore.getState().settings;
      const session = sessionStore.sessions.find((s) => s.id === sessionId);
      const selected = getModelForSession(session?.modelId);
      if (!selected) return;

      const messages = get().messagesBySession[sessionId] ?? [];
      const mode = session?.mode ?? "agent";
      const now = Date.now();
      const assistantMessage: Message = {
        id: generateId(),
        sessionId,
        role: "assistant",
        content: "",
        createdAt: now,
        status: "streaming",
        modelId: selected.model.id,
        providerId: selected.provider.id,
        mode,
      };

      set((state) => {
        const list = state.messagesBySession[sessionId] ?? [];
        list.push(assistantMessage);
        state.streamingSessionId = sessionId;
        state.isThinking = true;
      });
      await persistence.addMessage(assistantMessage);
      sessionStore.touchSession(sessionId, {
        messageCount: (session?.messageCount ?? 0) + 1,
        mode,
      });

      const abort = new AbortController();
      activeAbort = abort;
      let pendingContent = "";
      const flushContent = () => {
        set((state) => {
          const list = state.messagesBySession[sessionId];
          const target = list?.find((m) => m.id === assistantMessage.id);
          if (target) target.content = pendingContent;
        });
      };
      const scheduleFlush = () => {
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
          flushTimer = null;
          flushContent();
        }, STREAM_FLUSH_INTERVAL_MS);
      };

      try {
        const apiKey = await useModelStore
          .getState()
          .getApiKey(selected.provider.id);
        const contextMessages = buildContextMessages(sessionId, messages);
        const attachedFolders = await resolveAttachedFolders(
          sessionId,
          [],
          mode !== "chat",
        );
        const basePrompt =
          session?.systemPrompt ?? settings.chat.defaultSystemPrompt ?? "";
        const memoryPrompt = settings.memory.memoryPersistence
          ? await renderMemoryPrompt(undefined, settings.memory.memoryCategories)
          : "";
        const personalityPrompt = buildPersonalityInstruction(
          settings.chat.personality,
        );
        const timezonePrompt = buildTimezoneInstruction(settings.chat.timezone);
        const toolSettings = useSettingsStore.getState().settings.tools;
        const toolPrompt = buildToolSystemPrompt(attachedFolders, {
          ...(mode === "chat"
            ? {
                allowedTools: toolSettings.fileToolsEnabled
                  ? (["read_file", "list_dir"] as const)
                  : [],
              }
            : {
                fileTools: toolSettings.fileToolsEnabled,
                shellTools: toolSettings.shellToolsEnabled,
              }),
        });
        const modePrompt = buildModeSystemPrompt(
          mode,
          attachedFolders.length > 0 && Boolean(toolPrompt),
        );
        const systemPrompt =
          [basePrompt, memoryPrompt, personalityPrompt, timezonePrompt, modePrompt, toolPrompt]
            .filter(Boolean)
            .join("\n\n") || undefined;

        const result = await streamChatCompletion({
          provider: selected.provider,
          apiKey,
          model: selected.model,
          messages: contextMessages,
          systemPrompt: systemPrompt || undefined,
          conversationId: sessionId,
          params: {
            temperature: settings.model.temperature,
            maxTokens: settings.model.maxTokens,
            topP: settings.model.topP,
            effortLevel: settings.model.effortLevel,
            thinkingEnabled: settings.model.thinkingEnabled,
          },
          customHeaders: settings.advanced.customHeaders,
          signal: abort.signal,
          onToken: (token) => {
            pendingContent += token;
            scheduleFlush();
          },
        });

        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        pendingContent = pendingContent || "";
        const tokensUsed = result.tokensUsed ?? estimateTokens(pendingContent);
        const finalMessage: Message = {
          ...assistantMessage,
          content: pendingContent,
          status: abort.signal.aborted ? "stopped" : "complete",
          tokensUsed,
          cost: estimateMessageCost(selected.model.pricing, tokensUsed),
          citations: result.citations,
          reasoning: result.reasoning,
        };
        set((state) => {
          const list = state.messagesBySession[sessionId];
          const idx = list?.findIndex((m) => m.id === assistantMessage.id) ?? -1;
          if (list && idx >= 0) list[idx] = finalMessage;
          state.streamingSessionId = null;
          state.isThinking = false;
        });
        await persistence.updateMessage(finalMessage);
        await get().runToolLoop(sessionId);
      } catch (error) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        const message =
          error instanceof Error ? error.message : String(error);
        const finalMessage: Message = {
          ...assistantMessage,
          content: pendingContent,
          status: abort.signal.aborted ? "stopped" : "error",
          errorMessage: message,
        };
        set((state) => {
          const list = state.messagesBySession[sessionId];
          const idx = list?.findIndex((m) => m.id === assistantMessage.id) ?? -1;
          if (list && idx >= 0) list[idx] = finalMessage;
          state.streamingSessionId = null;
          state.isThinking = false;
        });
        await persistence.updateMessage(finalMessage);
        if (message && !abort.signal.aborted) {
          reportAppError(error, { category: "provider", source: "Tool continuation" });
          toast.error("Generation failed", { description: message });
          playErrorSound();
        }
      } finally {
        activeAbort = null;
      }
    },

    runToolLoop: async (sessionId) => {
      const MAX_TOOL_LOOPS = 10;
      const currentDepth = get().toolLoopDepth[sessionId] ?? 0;
      if (currentDepth >= MAX_TOOL_LOOPS) {
        toast.info("Tool loop limit reached. Continue the conversation to keep going.");
        return;
      }

      const messages = get().messagesBySession[sessionId] ?? [];
      const lastAssistant = [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "complete");
      if (!lastAssistant) return;

      const calls = parseToolCalls(lastAssistant.content, lastAssistant.id);
      if (calls.length === 0) {
        const lastUser = [...messages]
          .reverse()
          .find((message) => message.role === "user");
        const alreadyNudged = messages.some(
          (message) =>
            message.role === "system" &&
            message.content === AGENT_EXECUTION_NUDGE &&
            message.createdAt >= (lastUser?.createdAt ?? 0),
        );
        if (
          lastAssistant.mode !== "chat" &&
          !alreadyNudged &&
          isIncompleteAgentResponse(
            lastAssistant.content,
            lastAssistant.reasoning,
          )
        ) {
          const nudge: Message = {
            id: generateId(),
            sessionId,
            role: "system",
            content: AGENT_EXECUTION_NUDGE,
            createdAt: Date.now(),
            status: "complete",
            mode: lastAssistant.mode,
          };
          await persistence.addMessage(nudge);
          set((state) => {
            const list = state.messagesBySession[sessionId];
            if (list) list.push(nudge);
            state.toolLoopDepth[sessionId] = currentDepth + 1;
          });
          await get().continueAssistantTurn(sessionId);
          return;
        }
        set((state) => {
          delete state.toolLoopDepth[sessionId];
        });
        return;
      }

      const attachedFolders = await resolveAttachedFolders(
        sessionId,
        [],
        lastAssistant.mode !== "chat",
      );
      const permissionMode = useToolRuntimeStore.getState().permissionMode;
      const toAutoApprove: ToolCall[] = [];
      const pending: ToolCall[] = [];

      for (const call of calls) {
        if (shouldAutoApprove(call, permissionMode, attachedFolders)) {
          toAutoApprove.push({ ...call, status: "approved" });
        } else {
          pending.push(call);
        }
      }

      useToolRuntimeStore.getState().queuePending(pending);
      const visibleCalls = calls.map((call) =>
        toAutoApprove.some((approved) => approved.id === call.id)
          ? { ...call, status: "running" as const }
          : call,
      );
      const updatedAssistant = {
        ...lastAssistant,
        toolCalls: visibleCalls,
        toolWorkspace: attachedFolders,
      };
      set((state) => {
        const list = state.messagesBySession[sessionId];
        const index = list?.findIndex((message) => message.id === lastAssistant.id) ?? -1;
        if (list && index >= 0) list[index] = updatedAssistant;
      });
      await persistence.updateMessage(updatedAssistant);

      const context: ToolContext = { attachedFolders };
      const executed = await Promise.all(
        toAutoApprove.map((call) => executeTool(call, context)),
      );
      if (executed.length > 0) {
        await get().submitToolResults(sessionId, executed, pending.length === 0);
      }
    },

    submitToolResults: async (sessionId, results, shouldContinue = true) => {
      if (results.length === 0) return;
      const resultContent = results
        .map(serializeToolResult)
        .join("\n");

      const resultMessage: Message = {
        id: generateId(),
        sessionId,
        role: "system",
        content: resultContent,
        createdAt: Date.now(),
        status: "complete",
        toolResults: results,
      };
      await persistence.addMessage(resultMessage);
      set((state) => {
        const list = state.messagesBySession[sessionId];
        if (list) list.push(resultMessage);
        if (shouldContinue) {
          state.toolLoopDepth[sessionId] = (state.toolLoopDepth[sessionId] ?? 0) + 1;
        }
      });

      if (shouldContinue) await get().continueAssistantTurn(sessionId);
    },

    stopStreaming: () => {
      activeAbort?.abort();
    },

    regenerateLast: async () => {
      const sessionId = useSessionStore.getState().activeSessionId;
      if (!sessionId || get().streamingSessionId) return;
      const messages = get().messagesBySession[sessionId] ?? [];
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (!lastUser) return;
      await persistence.deleteMessagesFrom(sessionId, lastUser.id);
      await get().loadMessages(sessionId);
      const count = (get().messagesBySession[sessionId] ?? []).length;
      useSessionStore
        .getState()
        .touchSession(sessionId, { messageCount: count });
      await get().sendMessage(lastUser.content, lastUser.attachments ?? []);
    },

    editMessage: async (messageId, newContent) => {
      const sessionId = useSessionStore.getState().activeSessionId;
      if (!sessionId || get().streamingSessionId) return;
      const messages = get().messagesBySession[sessionId] ?? [];
      const target = messages.find((m) => m.id === messageId);
      if (!target || target.role !== "user") return;
      await persistence.deleteMessagesFrom(sessionId, messageId);
      await get().loadMessages(sessionId);
      const count = (get().messagesBySession[sessionId] ?? []).length;
      useSessionStore
        .getState()
        .touchSession(sessionId, { messageCount: count });
      await get().sendMessage(newContent, target.attachments ?? []);
    },

    branchFromMessage: async (messageId) => {
      const sessionId = useSessionStore.getState().activeSessionId;
      if (!sessionId) return;
      const messages = get().messagesBySession[sessionId] ?? [];
      const index = messages.findIndex((m) => m.id === messageId);
      if (index < 0) return;
      const source = useSessionStore
        .getState()
        .sessions.find((s) => s.id === sessionId);
      const branch = await useSessionStore.getState().createSession({
        title: `${source?.title ?? "Chat"} (branch)`,
      });
      const carried = messages.slice(0, index + 1);
      for (const message of carried) {
        await persistence.addMessage({
          ...message,
          id: generateId(),
          sessionId: branch.id,
          parentId: message.id,
          status: message.status === "streaming" ? "stopped" : message.status,
        });
      }
      useSessionStore
        .getState()
        .touchSession(branch.id, { messageCount: carried.length });
      await get().loadMessages(branch.id);
      toast.success("Branched into a new chat.");
    },

    getLastResponse: () => {
      const sessionId = useSessionStore.getState().activeSessionId;
      if (!sessionId) return null;
      const messages = get().messagesBySession[sessionId] ?? [];
      const last = [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.content);
      return last?.content ?? null;
    },

    getLastUserMessage: () => {
      const sessionId = useSessionStore.getState().activeSessionId;
      if (!sessionId) return null;
      const messages = get().messagesBySession[sessionId] ?? [];
      return [...messages].reverse().find((m) => m.role === "user") ?? null;
    },

    enqueueMessage: (content, attachments = []) => {
      if (get().queue.length >= MAX_QUEUE_SIZE) {
        toast.error(`Queue is full (${MAX_QUEUE_SIZE} messages).`);
        return;
      }
      const sessionId = useSessionStore.getState().activeSessionId;
      if (!sessionId) return;
      set((state) => {
        state.queue.push({
          id: generateId(),
          sessionId,
          content,
          attachments,
          createdAt: Date.now(),
        });
      });
    },

    removeQueued: (id) => {
      set((state) => {
        state.queue = state.queue.filter((q) => q.id !== id);
      });
    },

    reorderQueue: (fromIndex, toIndex) => {
      set((state) => {
        if (
          fromIndex < 0 ||
          fromIndex >= state.queue.length ||
          toIndex < 0 ||
          toIndex >= state.queue.length
        ) {
          return;
        }
        const [moved] = state.queue.splice(fromIndex, 1);
        state.queue.splice(toIndex, 0, moved);
      });
    },

    updateQueued: (id, content, attachments) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      set((state) => {
        const item = state.queue.find((q) => q.id === id);
        if (!item) return;
        item.content = trimmed;
        if (attachments) item.attachments = attachments;
      });
    },

    moveQueuedToTop: (id) => {
      set((state) => {
        const index = state.queue.findIndex((q) => q.id === id);
        if (index <= 0) return;
        const [moved] = state.queue.splice(index, 1);
        state.queue.unshift(moved);
      });
    },

    moveQueuedUp: (id) => {
      set((state) => {
        const index = state.queue.findIndex((q) => q.id === id);
        if (index <= 0) return;
        const [moved] = state.queue.splice(index, 1);
        state.queue.splice(index - 1, 0, moved);
      });
    },

    clearQueue: () => {
      set((state) => {
        state.queue = [];
      });
    },

    processQueue: async () => {
      if (get().streamingSessionId) return;
      const next = get().queue[0];
      if (!next) return;
      set((state) => {
        state.queue = state.queue.slice(1);
      });
      const active = useSessionStore.getState().activeSessionId;
      if (next.sessionId !== active) {
        useSessionStore.getState().selectSession(next.sessionId);
        await get().loadMessages(next.sessionId);
      }
      await get().sendMessage(next.content, next.attachments);
    },
  })),
);
