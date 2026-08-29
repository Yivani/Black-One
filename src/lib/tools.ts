import { toast } from "sonner";
import { ipc, isTauri } from "@/lib/ipc";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Attachment } from "@/types/chat";

export type ToolName =
  | "read_file"
  | "write_file"
  | "create_dir"
  | "delete_file"
  | "delete_dir"
  | "rename_file"
  | "list_dir"
  | "shell_command";

export type RiskLevel = "low" | "high" | "critical";
export type ToolPermissionMode = "manual" | "auto" | "yolo";

export interface ToolCall {
  id: string;
  name: ToolName;
  args: Record<string, string>;
  status: "pending" | "approved" | "denied" | "running" | "done" | "error";
  result?: ToolResult;
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface ToolContext {
  attachedFolders: string[];
  cwd?: string;
}

interface ToolDefinition {
  name: ToolName;
  description: string;
  args: Array<{ name: string; description: string; required: boolean }>;
  example: string;
}

const TOOLS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the full text content of a file.",
    args: [{ name: "path", description: "Relative or absolute file path", required: true }],
    example: `<tool name="read_file">
<path>src/main.ts</path>
</tool>`,
  },
  {
    name: "write_file",
    description: "Create or overwrite a text file.",
    args: [
      { name: "path", description: "Relative or absolute file path", required: true },
      { name: "content", description: "Full file content to write", required: true },
    ],
    example: `<tool name="write_file">
<path>notes.txt</path>
<content>Hello world</content>
</tool>`,
  },
  {
    name: "create_dir",
    description: "Create a directory and any missing parent directories.",
    args: [{ name: "path", description: "Relative or absolute directory path", required: true }],
    example: `<tool name="create_dir">
<path>src/components</path>
</tool>`,
  },
  {
    name: "delete_file",
    description: "Delete a file.",
    args: [{ name: "path", description: "Relative or absolute file path", required: true }],
    example: `<tool name="delete_file">
<path>old.txt</path>
</tool>`,
  },
  {
    name: "delete_dir",
    description: "Delete an empty directory.",
    args: [{ name: "path", description: "Relative or absolute directory path", required: true }],
    example: `<tool name="delete_dir">
<path>empty-folder</path>
</tool>`,
  },
  {
    name: "rename_file",
    description: "Rename or move a file or directory.",
    args: [
      { name: "from", description: "Source path", required: true },
      { name: "to", description: "Destination path", required: true },
    ],
    example: `<tool name="rename_file">
<from>old.txt</from>
<to>new.txt</to>
</tool>`,
  },
  {
    name: "list_dir",
    description: "List files and folders in a directory.",
    args: [{ name: "path", description: "Relative or absolute directory path", required: true }],
    example: `<tool name="list_dir">
<path>src</path>
</tool>`,
  },
  {
    name: "shell_command",
    description: "Run a one-shot shell command in the attached folder. Use only when necessary.",
    args: [
      { name: "command", description: "Shell command to run", required: true },
      { name: "cwd", description: "Working directory (optional, defaults to attached folder)", required: false },
    ],
    example: `<tool name="shell_command">
<command>npm install</command>
</tool>`,
  },
];

const CRITICAL_SHELL_PATTERNS = [
  /\bsudo\b/i,
  /\brm\s+-rf?\b/i,
  /\bmkfs\b/i,
  /\bdd\b/i,
  /\bformat\b/i,
  /\bdiskpart\b/i,
  />\s*\/dev\//,
  /\bcurl\b.*\|\s*\bsh\b/i,
  /\bwget\b.*\|\s*\bsh\b/i,
];

export function parseToolCalls(content: string, idPrefix = "tool"): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /<tool\s+name="([^"]+)"\s*>([\s\S]*?)<\/tool>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1] as ToolName;
    const body = match[2];
    const args: Record<string, string> = {};
    const argRegex = /<([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)<\/\1>/g;
    let argMatch: RegExpExecArray | null;
    while ((argMatch = argRegex.exec(body)) !== null) {
      args[argMatch[1]] = argMatch[2].trim();
    }
    calls.push({ id: `${idPrefix}-${calls.length}`, name, args, status: "pending" });
  }
  return calls;
}

export function stripToolCalls(content: string): string {
  return content.replace(/<tool\s+name="[^"]+"\s*>[\s\S]*?<\/tool>/g, "").trim();
}

export function buildToolSystemPrompt(
  attachedFolders: string[],
  options: { fileTools?: boolean; shellTools?: boolean; allowedTools?: ToolName[] } = {},
): string | undefined {
  if (!isTauri) return undefined;
  if (useSettingsStore.getState().settings.tools.permission === "blocked") return undefined;
  let tools = TOOLS;
  if (options.allowedTools) {
    tools = tools.filter((t) => options.allowedTools!.includes(t.name));
  } else {
    const fileTools = new Set<ToolName>([
      "read_file",
      "write_file",
      "create_dir",
      "delete_file",
      "delete_dir",
      "rename_file",
      "list_dir",
    ]);
    if (options.fileTools === false) {
      tools = tools.filter((t) => !fileTools.has(t.name));
    }
    if (options.shellTools === false) {
      tools = tools.filter((t) => t.name !== "shell_command");
    }
  }
  if (tools.length === 0) return undefined;

  const folderBlock = attachedFolders.length
    ? attachedFolders.map((f) => `- ${f}`).join("\n")
    : "(none attached yet; ask the user to attach a folder first)";

  return `You have access to file and shell tools. You can read, write, create, delete, and rename files, list directories, and run shell commands — but ONLY inside the attached folders listed below.

Attached folders:
${folderBlock}

Available tools:
${tools
  .map(
    (t) =>
      `- ${t.name}: ${t.description}\n  Args: ${t.args.map((a) => `${a.name}${a.required ? "" : "?"}`).join(", ")}\n  Example:\n${t.example}`,
  )
  .join("\n\n")}

How to use tools:
1. When you need to act on files, emit ONE tool block at a time like the examples above.
2. After each tool call, the user will see the result and the conversation continues.
3. Do not describe the tool call in prose — just emit the <tool> block.
4. For file paths, prefer relative paths from the attached folder root when possible.
5. For shell_command, the command runs in the attached folder by default.
6. If a task requires multiple steps, call tools in sequence; wait for each result before the next call.
7. Never use tools outside the attached folders unless the user explicitly asks you to.
8. If the user asks you to inspect, create, change, debug, or verify a project and its folder is attached, use tools instead of pretending, drafting a replacement, or asking for information you can read yourself.

After you receive a tool result, summarize what happened briefly for the user.`;
}

export function classifyRisk(call: ToolCall, attachedFolders: string[]): RiskLevel {
  if (call.name === "shell_command") {
    const command = (call.args.command ?? "").toLowerCase();
    if (CRITICAL_SHELL_PATTERNS.some((pattern) => pattern.test(command))) {
      return "critical";
    }
    return "high";
  }

  if (["delete_file", "delete_dir", "rename_file"].includes(call.name)) {
    return "high";
  }

  if (call.name === "write_file" || call.name === "create_dir") {
    const path = call.args.path ?? "";
    if (attachedFolders.length > 0 && !pathLooksInsideAny(path, attachedFolders)) {
      return "high";
    }
    return "low";
  }

  return "low";
}

export function shouldAutoApprove(
  call: ToolCall,
  mode: ToolPermissionMode,
  attachedFolders: string[],
): boolean {
  if (mode === "yolo") return true;
  if (mode === "manual") return false;
  // auto mode
  const risk = classifyRisk(call, attachedFolders);
  return risk === "low";
}

export function extractAttachedFolders(attachments: Attachment[]): string[] {
  return attachments
    .filter((a): a is Attachment & { path: string } => a.kind === "folder" && !!a.path)
    .map((a) => a.path);
}

function pathLooksInsideAny(path: string, roots: string[]): boolean {
  if (roots.length === 0) return true;
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return roots.some((root) => {
    const rootNormalized = root.replace(/\\/g, "/").toLowerCase();
    return normalized === rootNormalized || normalized.startsWith(rootNormalized + "/");
  });
}

function resolvePath(path: string, attachedFolders: string[]): string {
  if (attachedFolders.length === 0) return path;
  const normalized = path.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    (/^[a-z]:/i.test(normalized) && normalized.length > 2 && normalized[2] === "/")
  ) {
    return path;
  }
  const base = attachedFolders[0];
  return base.replace(/\\/g, "/") + "/" + normalized;
}

export async function executeTool(
  call: ToolCall,
  context: ToolContext,
): Promise<ToolCall> {
  if (!isTauri) {
    return { ...call, status: "error", result: { success: false, error: "Tools only work in the desktop app." } };
  }

  const toolSettings = useSettingsStore.getState().settings.tools;
  if (toolSettings.permission === "blocked") {
    return { ...call, status: "error", result: { success: false, error: "Tools are blocked in Settings → Tools." } };
  }
  const isFileTool = call.name !== "shell_command";
  if (isFileTool && !toolSettings.fileToolsEnabled) {
    return { ...call, status: "error", result: { success: false, error: "File tools are disabled in Settings → Tools." } };
  }
  if (call.name === "shell_command" && !toolSettings.shellToolsEnabled) {
    return { ...call, status: "error", result: { success: false, error: "Shell tools are disabled in Settings → Tools." } };
  }

  try {
    const roots = context.attachedFolders;
    switch (call.name) {
      case "read_file": {
        const path = resolvePath(call.args.path, roots);
        const output = await ipc.readFileText(path);
        return { ...call, status: "done", result: { success: true, output } };
      }
      case "write_file": {
        const path = resolvePath(call.args.path, roots);
        await ipc.writeFileText(path, call.args.content, roots);
        return { ...call, status: "done", result: { success: true, output: `Wrote ${path}` } };
      }
      case "create_dir": {
        const path = resolvePath(call.args.path, roots);
        await ipc.createDir(path, roots);
        return { ...call, status: "done", result: { success: true, output: `Created ${path}` } };
      }
      case "delete_file": {
        const path = resolvePath(call.args.path, roots);
        await ipc.deleteFile(path, roots);
        return { ...call, status: "done", result: { success: true, output: `Deleted ${path}` } };
      }
      case "delete_dir": {
        const path = resolvePath(call.args.path, roots);
        await ipc.deleteDir(path, roots);
        return { ...call, status: "done", result: { success: true, output: `Deleted ${path}` } };
      }
      case "rename_file": {
        const from = resolvePath(call.args.from, roots);
        const to = resolvePath(call.args.to, roots);
        await ipc.renameFile(from, to, roots);
        return { ...call, status: "done", result: { success: true, output: `Renamed ${from} → ${to}` } };
      }
      case "list_dir": {
        const path = resolvePath(call.args.path, roots);
        const entries = await ipc.readDirEntries(path);
        const lines = entries.map((e) => (e.isDir ? `${e.name}/` : e.name));
        return { ...call, status: "done", result: { success: true, output: lines.join("\n") || "(empty)" } };
      }
      case "shell_command": {
        const cwd = call.args.cwd
          ? resolvePath(call.args.cwd, roots)
          : roots[0] ?? ".";
        if (roots.length > 0 && !pathLooksInsideAny(cwd, roots)) {
          return { ...call, status: "error", result: { success: false, error: "Shell cwd is outside attached folders." } };
        }
        const result = await ipc.executeShellCommand(call.args.command, cwd, roots);
        const output = [result.stdout, result.stderr]
          .filter(Boolean)
          .join("\n")
          .slice(0, 4000);
        return {
          ...call,
          status: "done",
          result: {
            success: result.exitCode === 0 && !result.timedOut,
            output: result.timedOut ? `${output}\n… timed out`.trim() : output,
          },
        };
      }
      default:
        return { ...call, status: "error", result: { success: false, error: `Unknown tool: ${call.name}` } };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`Tool ${call.name} failed`, { description: message });
    return { ...call, status: "error", result: { success: false, error: message } };
  }
}
