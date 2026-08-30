import { useEffect, useState } from "react";
import { Check, FileEdit, Folder, Loader2, ShieldAlert, Terminal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { cloneToolCall, executeTool, type ToolCall, type ToolContext } from "@/lib/tools";
import { useChatStore } from "@/stores/chatStore";
import { useToolRuntimeStore } from "@/stores/toolRuntimeStore";

interface ToolCallCardProps {
  call: ToolCall;
  context: ToolContext;
  sessionId: string;
  showApprove?: boolean;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  read_file: <FileEdit className="size-3.5" aria-hidden />,
  write_file: <FileEdit className="size-3.5" aria-hidden />,
  create_dir: <Folder className="size-3.5" aria-hidden />,
  delete_file: <Trash2 className="size-3.5" aria-hidden />,
  delete_dir: <Trash2 className="size-3.5" aria-hidden />,
  rename_file: <FileEdit className="size-3.5" aria-hidden />,
  list_dir: <Folder className="size-3.5" aria-hidden />,
  shell_command: <Terminal className="size-3.5" aria-hidden />,
};

const TOOL_LABELS: Record<string, string> = {
  read_file: "Read file",
  write_file: "Write file",
  create_dir: "Create folder",
  delete_file: "Delete file",
  delete_dir: "Delete folder",
  rename_file: "Move file",
  list_dir: "List folder",
  shell_command: "Run command",
};

function formatArgs(call: ToolCall): string {
  switch (call.name) {
    case "read_file":
    case "write_file":
    case "create_dir":
    case "delete_file":
    case "delete_dir":
    case "list_dir":
      return call.args.path ?? "";
    case "rename_file":
      return `${call.args.from ?? ""} → ${call.args.to ?? ""}`;
    case "shell_command":
      return call.args.command ?? "";
    default:
      return "";
  }
}

export function ToolCallCard({ call, context, sessionId, showApprove = false }: ToolCallCardProps) {
  // Deep-clone the prop so we don't hold onto any Immer proxies that can be revoked after state updates.
  const [localCall, setLocalCall] = useState<ToolCall>(() => cloneToolCall(call));
  const approve = useToolRuntimeStore((s) => s.approve);
  const deny = useToolRuntimeStore((s) => s.deny);
  const submitToolResults = useChatStore((s) => s.submitToolResults);

  const isPending = localCall.status === "pending";
  const isRunning = localCall.status === "running";
  const isDone = localCall.status === "done";
  const isDenied = localCall.status === "denied";
  const isError = localCall.status === "error";

  useEffect(() => {
    setLocalCall(cloneToolCall(call));
  }, [call]);

  const handleApprove = async () => {
    const approved = approve(localCall.id);
    if (!approved) return;
    setLocalCall({ ...approved, status: "running" });
    const executed = await executeTool(approved, context);
    setLocalCall(executed);
    const remaining = useToolRuntimeStore.getState().pendingCalls.length;
    await submitToolResults(sessionId, [executed], remaining === 0);
  };

  const handleDeny = () => {
    const denied = deny(localCall.id);
    if (!denied) return;
    setLocalCall(denied);
    const remaining = useToolRuntimeStore.getState().pendingCalls.length;
    void submitToolResults(sessionId, [denied], remaining === 0);
  };

  return (
    <div
      className={cn(
        "my-2 overflow-hidden rounded-md border border-border/70 bg-muted/20 text-xs",
        isError && "border-destructive/35",
        isDenied && "border-amber-500/35",
      )}
    >
      <div className="flex min-h-9 items-center justify-between gap-3 px-2.5 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground">{TOOL_ICONS[localCall.name] ?? null}</span>
          <span className="shrink-0 font-medium">{TOOL_LABELS[localCall.name] ?? localCall.name}</span>
          <span className="truncate text-muted-foreground">{formatArgs(localCall)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isDone && <Check className="size-3.5 text-green-500" aria-hidden />}
          {isError && <X className="size-3.5 text-red-500" aria-hidden />}
          {isDenied && <ShieldAlert className="size-3.5 text-amber-500" aria-hidden />}
          {isRunning && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {showApprove && isPending && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={handleDeny}
              >
                Deny
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={handleApprove}
              >
                Allow
              </Button>
            </>
          )}
        </div>
      </div>

      {localCall.result && (localCall.result.output || localCall.result.error) && (
        <Collapsible defaultOpen={isError || isDenied}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full border-t border-border/50 bg-muted/20 px-3 py-1.5 text-left text-[10px] text-muted-foreground hover:bg-muted/40"
            >
              {localCall.result.error ? "Show error" : "Show output"}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-[10px]">
              {localCall.result.error ?? localCall.result.output}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
