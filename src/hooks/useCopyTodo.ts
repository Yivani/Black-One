import { useCallback } from "react";
import { toast } from "sonner";
import { useCopyText } from "@/hooks/useCopyText";
import { useTranslation } from "@/hooks/useTranslation";
import type { TodoItem } from "@/lib/todoCore";
import { useTodoStore } from "@/stores/todoStore";

/**
 * Copies a task and ticks it off.
 *
 * Copying is how a task leaves the board — it goes to the terminal or agent
 * that will carry it out — so the copy is the moment the task is handed over,
 * and leaving it in the queue afterwards means every task has to be finished
 * twice. Only a copy the clipboard actually accepted counts, and the toast
 * carries an undo for the ones that were copied to be read rather than run.
 */
export function useCopyTodo(item: TodoItem): {
  copied: boolean;
  copy: () => void;
} {
  const { t } = useTranslation();
  const updateTodo = useTodoStore((state) => state.updateTodo);
  const { id, status } = item;

  const finish = useCallback(() => {
    if (status === "done") return;
    updateTodo(id, { status: "done" });
    toast.success(t("todo.copiedDone"), {
      action: {
        label: t("common.undo"),
        onClick: () => updateTodo(id, { status: "queued" }),
      },
    });
  }, [id, status, t, updateTodo]);

  return useCopyText(item.text, { onCopied: finish });
}
