import type { Attachment, QueuedMessage } from "@/types/chat";
import { useChatStore } from "@/stores/chatStore";

export interface UseQueueResult {
  queue: QueuedMessage[];
  removeQueued: (id: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  updateQueued: (id: string, content: string, attachments?: Attachment[]) => void;
  moveQueuedToTop: (id: string) => void;
  moveQueuedUp: (id: string) => void;
  clearQueue: () => void;
}

export function useQueue(): UseQueueResult {
  const queue = useChatStore((s) => s.queue);
  const removeQueued = useChatStore((s) => s.removeQueued);
  const reorderQueue = useChatStore((s) => s.reorderQueue);
  const updateQueued = useChatStore((s) => s.updateQueued);
  const moveQueuedToTop = useChatStore((s) => s.moveQueuedToTop);
  const moveQueuedUp = useChatStore((s) => s.moveQueuedUp);
  const clearQueue = useChatStore((s) => s.clearQueue);
  return {
    queue,
    removeQueued,
    reorderQueue,
    updateQueued,
    moveQueuedToTop,
    moveQueuedUp,
    clearQueue,
  };
}
