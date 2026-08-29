import type { LucideIcon } from "lucide-react";
import type { ToolPermissionMode } from "@/lib/tools";

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** System prompt override for this agent. */
  systemPrompt?: string;
  /** Optional preferred model id. */
  modelId?: string;
  /** Optional default permission mode for new agent sessions. */
  permissionMode?: ToolPermissionMode;
  /** Optional personality key (if the global personality should be overridden). */
  personality?: string;
}
