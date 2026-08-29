import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Toaster, toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { CommandPalette } from "@/components/chat/CommandPalette";
import { VibeHearts } from "@/components/chat/VibeHearts";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentFinishSound, useHapticFeedback } from "@/hooks/useHaptics";
import { useKeyboardShortcut, type ShortcutHandlers } from "@/hooks/useKeyboardShortcut";
import { toggleDarkMode, useResolvedDark, useTheme } from "@/hooks/useTheme";
import { ipc, isTauri, type QuickChatPayload } from "@/lib/ipc";
import { recoverExplicitMemories } from "@/lib/memory";
import { reportAppError } from "@/lib/errors";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useUiStore } from "@/stores/uiStore";

let bootStarted = false;

export function useAppBootstrap(recoverMemory = true): boolean {
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const sessionsLoaded = useSessionStore((s) => s.isLoaded);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (bootStarted) {
      setBooted(true);
      return;
    }
    bootStarted = true;
    const run = async () => {
      await useSettingsStore.getState().load();
      await Promise.all([
        useSessionStore.getState().loadAll(),
        useModelStore.getState().loadProviders(),
      ]);
      if (recoverMemory) {
        void recoverExplicitMemories().catch((error) => {
          reportAppError(error, { category: "storage", source: "Memory recovery" });
          console.error("Memory recovery failed", error);
        });
      }
    };
    run()
      .catch((error) => {
        reportAppError(error, { category: "startup", source: "App bootstrap" });
        toast.error(error instanceof Error ? error.message : "Failed to initialize Black One.");
      })
      .finally(() => setBooted(true));
  }, [recoverMemory]);

  return booted && settingsLoaded && sessionsLoaded;
}

function openAuxWindow(): void {
  if (isTauri) {
    void import("@tauri-apps/api/webviewWindow")
      .then(({ WebviewWindow }) => {
        const label = `black-one-${Date.now()}`;
        new WebviewWindow(label, {
          url: window.location.href,
          title: "Black One",
          width: 1200,
          height: 800,
        });
      })
      .catch(() => toast.error("Could not open a new window."));
    return;
  }
  window.open(window.location.href, "_blank", "noopener");
}

function cycleSession(direction: 1 | -1): void {
  const { sessions, activeSessionId, selectSession } = useSessionStore.getState();
  if (sessions.length === 0) return;
  const index = sessions.findIndex((s) => s.id === activeSessionId);
  const next = sessions[(index + direction + sessions.length) % sessions.length];
  selectSession(next.id);
}

const shortcutHandlers: ShortcutHandlers = {
  "new-chat": () => {
    void useSessionStore.getState().createSession();
  },
  "new-chat-window": () => openAuxWindow(),
  "attach-file": () => useUiStore.getState().requestAttachFile(),
  "attach-folder": () => useUiStore.getState().requestAttachFolder(),
  "toggle-sidebar": () => useUiStore.getState().toggleSidebar(),
  "toggle-right-sidebar": () => useUiStore.getState().toggleRightPanel(),
  "open-settings": () => useUiStore.getState().openSettings(),
  "command-palette": () => {
    const ui = useUiStore.getState();
    ui.setCommandPaletteOpen(!ui.commandPaletteOpen);
  },
  "copy-last-response": () => {
    const content = useChatStore.getState().getLastResponse();
    if (!content) {
      toast.info("No response to copy yet.");
      return;
    }
    navigator.clipboard
      .writeText(content)
      .then(() => toast.success("Last response copied."))
      .catch(() => toast.error("Copy failed."));
  },
  "focus-composer": () => useUiStore.getState().requestComposerFocus(),
  "edit-last-message": () => useUiStore.getState().requestEditLastMessage(),
  "stop-generation": () => {
    const streaming = useChatStore.getState().streamingSessionId !== null;
    if (streaming) {
      useChatStore.getState().stopStreaming();
      return;
    }
    return false;
  },
  "prev-chat": () => cycleSession(-1),
  "next-chat": () => cycleSession(1),
  "toggle-dark-mode": () => toggleDarkMode(),
  "zen-mode": () => useUiStore.getState().toggleZenMode(),
  "new-terminal": () => {
    const ui = useUiStore.getState();
    if (ui.viewMode !== "code") ui.setViewMode("code");
    void useTerminalStore.getState().createTerminal();
  },
};

function BootScreen() {
  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <Skeleton className="h-header w-full rounded-none" />
      <div className="flex flex-1">
        <Skeleton className="h-full w-sidebar rounded-none" />
        <div className="flex flex-1 flex-col gap-4 p-8">
          <Skeleton className="h-16 w-2/3 self-end" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

export function App() {
  const ready = useAppBootstrap();
  const dark = useResolvedDark();
  useTheme();
  useHapticFeedback();
  useAgentFinishSound();
  useKeyboardShortcut(shortcutHandlers);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const quickChatShortcut = useSettingsStore(
    (s) => s.settings.shortcuts["quick-chat"],
  );

  useEffect(() => {
    if (!isTauri || !settingsLoaded || quickChatShortcut === undefined) return;
    void ipc.setQuickChatShortcut(quickChatShortcut).catch((error) =>
      toast.error(error instanceof Error ? error.message : String(error)),
    );
  }, [quickChatShortcut, settingsLoaded]);

  useEffect(() => {
    if (!isTauri) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<QuickChatPayload>("quick-chat-submit", ({ payload }) => {
      void (async () => {
        useUiStore.getState().setViewMode("chat");
        useModelStore.getState().selectModel(payload.modelId);
        await useSessionStore.getState().createSession({ title: "New chat" });
        void useChatStore
          .getState()
          .sendMessage(payload.content, payload.attachments)
          .catch((error) =>
            toast.error(error instanceof Error ? error.message : String(error)),
          );
      })();
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauri || !ready) return;
    let unlisten: (() => void) | undefined;
    void listen<{ sessionId: string }>("quick-chat-message-sent", ({ payload }) => {
      const { sessionId } = payload;
      void useSessionStore
        .getState()
        .loadAll()
        .then(() => {
          useSessionStore.getState().selectSession(sessionId);
          void useChatStore.getState().loadMessages(sessionId);
        });
    }).then((cleanup) => {
      unlisten = cleanup;
    });
    return () => {
      unlisten?.();
    };
  }, [ready]);

  useEffect(() => {
    if (!isTauri || !ready) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timeout) return;
      timeout = setTimeout(() => {
        timeout = null;
        const sessionId = useSessionStore.getState().activeSessionId;
        void useSessionStore
          .getState()
          .loadAll()
          .then(() => {
            const store = useSessionStore.getState();
            const target =
              [...store.sessions, ...store.archivedSessions].find(
                (s) => s.id === sessionId,
              )?.id ?? store.sessions[0]?.id;
            if (target) {
              store.selectSession(target);
              void useChatStore.getState().loadMessages(target);
            }
          });
      }, 500);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      if (timeout) clearTimeout(timeout);
    };
  }, [ready]);

  if (!ready) return <BootScreen />;

  return (
    <>
      <AppShell />
      <SettingsModal />
      <CommandPalette />
      <VibeHearts />
      <Toaster position="bottom-right" closeButton theme={dark ? "dark" : "light"} />
    </>
  );
}
