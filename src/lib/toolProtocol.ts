export type ToolName =
  | "read_file"
  | "write_file"
  | "create_dir"
  | "delete_file"
  | "delete_dir"
  | "rename_file"
  | "list_dir"
  | "shell_command";

export type ToolStatus =
  | "pending"
  | "approved"
  | "denied"
  | "running"
  | "done"
  | "error";

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: ToolName;
  args: Record<string, string>;
  status: ToolStatus;
  result?: ToolResult;
}

const TOOL_CALL_PATTERN =
  /<tool\s+name="([^"]+)"(?:\s+id="([^"]+)")?\s*>([\s\S]*?)<\/tool>/g;
const TOOL_RESULT_PATTERN =
  /<tool_result\s+name="([^"]+)"\s+id="([^"]+)"\s+status="([^"]+)"\s*>([\s\S]*?)<\/tool_result>/g;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function readTag(body: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(body);
  return match ? unescapeXml(match[1]) : undefined;
}

export function cloneToolCall(call: ToolCall): ToolCall {
  return {
    ...call,
    args: { ...call.args },
    result: call.result ? { ...call.result } : undefined,
  };
}

export function parseToolCalls(content: string, idPrefix = "tool"): ToolCall[] {
  const calls: ToolCall[] = [];
  let match: RegExpExecArray | null;
  while ((match = TOOL_CALL_PATTERN.exec(content)) !== null) {
    const args: Record<string, string> = {};
    const argPattern = /<([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)<\/\1>/g;
    let argMatch: RegExpExecArray | null;
    while ((argMatch = argPattern.exec(match[3])) !== null) {
      args[argMatch[1]] = unescapeXml(argMatch[2].trim());
    }
    calls.push({
      id: unescapeXml(match[2] || `${idPrefix}-${calls.length}`),
      name: unescapeXml(match[1]) as ToolName,
      args,
      status: "pending",
    });
  }
  return calls;
}

export function stripToolCalls(content: string): string {
  return content.replace(TOOL_CALL_PATTERN, "").trim();
}

export function serializeToolResult(call: ToolCall): string {
  const result = call.result ?? { success: false, error: "No tool result returned." };
  const detail = result.output ?? result.error ?? "";
  const tag = result.success ? "output" : "error";
  return `<tool_result name="${escapeXml(call.name)}" id="${escapeXml(call.id)}" status="${escapeXml(call.status)}"><success>${result.success}</success><${tag}>${escapeXml(detail)}</${tag}></tool_result>`;
}

export function parseToolResults(content: string): ToolCall[] {
  const results: ToolCall[] = [];
  let match: RegExpExecArray | null;
  while ((match = TOOL_RESULT_PATTERN.exec(content)) !== null) {
    const successTag = readTag(match[4], "success");
    const output = readTag(match[4], "output");
    const error = readTag(match[4], "error");
    const legacy = unescapeXml(match[4].trim());
    const success = successTag
      ? successTag === "true"
      : legacy.toLowerCase().startsWith("success:");
    const detail = output ?? error ?? legacy.replace(/^(?:success|error):\s*/i, "");
    results.push({
      id: unescapeXml(match[2]),
      name: unescapeXml(match[1]) as ToolName,
      args: {},
      status: success ? "done" : "error",
      result: success
        ? { success: true, output: detail }
        : { success: false, error: detail },
    });
  }
  return results;
}
