import { useState } from "react";
import { Check, FileEdit, Folder, Loader2, ShieldAlert, Terminal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { executeTool, type ToolCall, type ToolContext } from "@/lib/tools";
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
  const [localCall, setLocalCall] = useState<ToolCall>(call);
  const approve = useToolRuntimeStore((s) => s.approve);
  const deny = useToolRuntimeStore((s) => s.deny);
  const submitToolResults = useChatStore((s) => s.submitToolResults);

  const isPending = localCall.status === "pending";
  const isRunning = localCall.status === "running";
  const isDone = localCall.status === "done";
  const isDenied = localCall.status === "denied";
  const isError = localCall.status === "error";

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
        "my-2 overflow-hidden rounded-lg border text-xs",
        isDone && "border-green-500/30 bg-green-500/5",
        isError && "border-red-500/30 bg-red-500/5",
        isDenied && "border-amber-500/30 bg-amber-500/5",
        isPending && "border-primary/30 bg-primary/5",
        isRunning && "border-primary/50 bg-primary/10",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground">{TOOL_ICONS[localCall.name] ?? null}</span>
          <span className="font-medium capitalize">{localCall.name.replace(/_/g, " ")}</span>
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
                size="icon"
                className="size-6 hover:bg-green-500/10 hover:text-green-500"
                onClick={handleApprove}
                aria-label="Approve"
              >
                <Check className="size-3.5" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 hover:bg-red-500/10 hover:text-red-500"
                onClick={handleDeny}
                aria-label="Deny"
              >
                <X className="size-3.5" aria-hidden />
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
              {localCall.result.error ? "Error" : "Result"}
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
