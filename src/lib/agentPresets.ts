import { Code, Search, Terminal } from "lucide-react";
import type { AgentPreset } from "@/types/agent";
import { useModelStore } from "@/stores/modelStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useToolRuntimeStore } from "@/stores/toolRuntimeStore";
import { useUiStore } from "@/stores/uiStore";

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: "builder",
    name: "Builder",
    description: "Inspects, implements, and verifies a complete change.",
    icon: Code,
    systemPrompt:
      "Complete the requested change end to end. Read the relevant project files first, reuse existing patterns, make the smallest correct edit, and validate it before reporting completion.",
    permissionMode: "auto",
  },
  {
    id: "research",
    name: "Investigator",
    description: "Traces a problem through project evidence and reports the cause.",
    icon: Search,
    systemPrompt:
      "Investigate the requested problem from available project evidence. Read relevant files, trace the real flow, distinguish facts from inference, and report the root cause with concrete references.",
  },
  {
    id: "shell",
    name: "Automation",
    description: "Runs and verifies repeatable project commands.",
    icon: Terminal,
    systemPrompt:
      "Automate the requested project task with the fewest safe commands. Inspect before changing state, stop on destructive ambiguity, and verify the result.",
    permissionMode: "manual",
  },
];

export function findAgentPreset(id: string | null | undefined): AgentPreset | undefined {
  return AGENT_PRESETS.find((preset) => preset.id === id);
}

export async function createAgentSession(preset: AgentPreset): Promise<string> {
  const session = await useSessionStore.getState().createSession({
    title: preset.name,
    mode: "agent",
    systemPrompt: preset.systemPrompt,
    modelId: preset.modelId,
  });

  if (preset.modelId) {
    useModelStore.getState().selectModel(preset.modelId);
  }

  if (preset.permissionMode) {
    useToolRuntimeStore.getState().setPermissionMode(preset.permissionMode);
  }

  useUiStore.getState().setViewMode("agent");
  useUiStore.getState().setSelectedAgentPresetId(preset.id);

  return session.id;
}
