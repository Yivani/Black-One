import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { QueueManager } from "@/components/chat/QueueManager";

export function ChatArea() {
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col">
        <MessageList />
      </div>
      <QueueManager />
      <Composer />
    </main>
  );
}
