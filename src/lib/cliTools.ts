export type CliAction = "install" | "update" | "uninstall";

export interface CliTool {
  id: string;
  name: string;
  binary: string;
  packageName: string;
  description: string;
}

export const CLI_TOOLS: CliTool[] = [
  {
    id: "codex",
    name: "Codex CLI",
    binary: "codex",
    packageName: "@openai/codex",
    description: "OpenAI's coding agent for local repositories.",
  },
  {
    id: "claude",
    name: "Claude Code",
    binary: "claude",
    packageName: "@anthropic-ai/claude-code",
    description: "Anthropic's terminal coding agent.",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    binary: "gemini",
    packageName: "@google/gemini-cli",
    description: "Google's open-source terminal agent.",
  },
  {
    id: "kimi",
    name: "Kimi Code",
    binary: "kimi",
    packageName: "@moonshot-ai/kimi-code",
    description: "Moonshot AI's terminal coding agent.",
  },
  {
    id: "opencode",
    name: "OpenCode",
    binary: "opencode",
    packageName: "opencode-ai",
    description: "An open-source multi-provider coding agent.",
  },
];

export function getCliCommand(tool: CliTool, action: CliAction): string {
  if (action === "uninstall") {
    return `npm.cmd uninstall -g ${tool.packageName}`;
  }
  return `npm.cmd install -g ${tool.packageName}@latest`;
}
