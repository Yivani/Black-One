import { MemoryViewer } from "./MemoryViewer";

export function MemorySettings() {
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        Black One saves a memory only when you explicitly ask it to remember or
        save something. Memories stay local and can be copied to a terminal CLI
        as Markdown.
      </p>
      <div className="h-[min(560px,calc(100vh-250px))] min-h-80">
        <MemoryViewer />
      </div>
    </div>
  );
}
