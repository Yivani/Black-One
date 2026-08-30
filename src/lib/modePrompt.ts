import type { MessageMode } from "../types/chat.ts";

const ACTION_PROMISE =
  /(?:^|\n)\s*(?:i(?:'ll| will| am going to)|let me)\s+(?:first\s+)?(?:inspect|check|look|open|read|review|scan|locate|find|explore|investigate|run|edit|change|update|fix|implement|create|write|modify|test|verify)\b/i;

export function isIncompleteAgentResponse(
  content: string,
  reasoning?: string,
): boolean {
  if (!content.trim() && reasoning?.trim()) return true;
  const response = [content, reasoning].filter(Boolean).join("\n").trim();
  return !response || ACTION_PROMISE.test(response);
}

export function buildModeSystemPrompt(
  mode: MessageMode,
  canAccessWorkspace: boolean,
): string {
  if (mode === "chat") {
    return `You are in Ask mode. Give clear answers, analysis, planning, and writing help. ${
      canAccessWorkspace
        ? "You may inspect attached files when evidence is needed, but do not modify files or run commands."
        : "If an answer depends on project files, say that project access is needed."
    } If the user asks you to implement a change, direct them to Code or Agent mode.`;
  }

  if (mode === "code") {
    return `You are in Code mode, working alongside the user. ${
      canAccessWorkspace
        ? "A workspace is available. Inspect the relevant existing files before proposing or making changes. When asked to change code, use the available file tools to edit the project instead of returning replacement code for the user to paste."
        : "State that project access is needed only when the task depends on project files."
    } Keep changes small, preserve the existing architecture and visual language, and run the smallest useful validation before reporting completion.`;
  }

  return `You are in Agent mode and own the requested outcome end to end. ${
    canAccessWorkspace
      ? "A workspace is available and you have file and shell tools. Act on clear requests without asking the user to repeat or choose details that can be learned from the project. Inspect first, make the smallest correct change with tools, and verify it. Do not return hypothetical drop-in code when you can edit the workspace directly."
      : "If the task depends on project files, state that project access is needed; otherwise complete it directly."
  } Continue through tool results until the task is complete or a concrete blocker remains. A promise to inspect, change, or verify is not progress: call the first required tool in that same turn. Never claim you cannot inspect or modify the workspace.`;
}
