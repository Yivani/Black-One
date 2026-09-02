export type CliAction = "install" | "update" | "uninstall";
export type CliToolId =
  | "codex"
  | "claude"
  | "gemini"
  | "kimi"
  | "opencode";
type CliPermissionMode = "manual" | "auto" | "yolo" | "blocked";

export interface CliTool {
  id: CliToolId;
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function utf16LeBase64(value: string): string {
  const bytes = new Uint8Array(value.length * 2);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes[index * 2] = code & 0xff;
    bytes[index * 2 + 1] = code >> 8;
  }
  return bytesToBase64(bytes);
}

function taskArgs(toolId: CliToolId, permission: CliPermissionMode): string[] {
  switch (toolId) {
    case "codex":
      return [
        "exec",
        "--sandbox",
        permission === "manual" ? "read-only" : "workspace-write",
      ];
    case "claude":
      return [
        "-p",
        "--permission-mode",
        permission === "manual" ? "manual" : "auto",
      ];
    case "gemini":
      return [
        "-p",
        `--approval-mode=${permission === "yolo" ? "yolo" : permission === "auto" ? "auto_edit" : "default"}`,
      ];
    case "kimi":
      return ["-p"];
    case "opencode":
      return permission === "manual" ? ["run"] : ["run", "--auto"];
  }
}

/**
 * Runs a prompt without placing its text in shell syntax. PowerShell's encoded
 * command form works from both PowerShell and cmd, and prevents Todo text from
 * becoming a second command when it contains quotes or newlines.
 */
export function buildCliTaskCommand(
  toolId: CliToolId,
  prompt: string,
  permission: CliPermissionMode,
): string {
  const promptBase64 = bytesToBase64(new TextEncoder().encode(prompt));
  const args = taskArgs(toolId, permission)
    .map((arg) => `'${arg.replaceAll("'", "''")}'`)
    .join(", ");
  const script = [
    `$prompt = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${promptBase64}'))`,
    `$command = (Get-Command '${toolId}' -CommandType Application -ErrorAction Stop).Source`,
    `$arguments = @(${args})`,
    "& $command @arguments $prompt",
    "exit $LASTEXITCODE",
  ].join("\n");
  return `powershell.exe -NoLogo -NoProfile -EncodedCommand ${utf16LeBase64(script)}`;
}
