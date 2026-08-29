import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { toast } from "sonner";
import type { ChatFolder, ChatSession } from "@/types/session";
import { MAX_PINNED_SESSIONS } from "@/lib/constants";
import { persistence } from "@/lib/persistence";
import { generateId, messagesToMarkdown, sessionToJson } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";

interface SessionState {
  sessions: ChatSession[];
  archivedSessions: ChatSession[];
  folders: ChatFolder[];
  activeSessionId: string | null;
  isLoaded: boolean;

  loadAll: () => Promise<void>;
  createSession: (opts?: {
    folderId?: string | null;
    title?: string;
    mode?: "chat" | "code" | "agent";
    systemPrompt?: string;
    modelId?: string;
  }) => Promise<ChatSession>;
  selectSession: (id: string) => void;
  renameSession: (id: string, title: string) => Promise<void>;
  updateSessionMeta: (id: string, patch: Partial<ChatSession>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  archiveSession: (id: string, archived: boolean) => Promise<void>;
  duplicateSession: (id: string) => Promise<ChatSession | null>;
  togglePin: (id: string) => Promise<void>;
  moveToFolder: (id: string, folderId: string | null) => Promise<void>;
  markUnread: (id: string, unread: boolean) => Promise<void>;
  createFolder: (name: string) => Promise<ChatFolder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  setFolderColor: (id: string, color: string | undefined) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  exportSession: (id: string, format: "json" | "markdown") => Promise<string>;
  touchSession: (id: string, patch?: Partial<ChatSession>) => void;
  ensureActiveSession: () => Promise<string>;
}

function sortSessions(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

export const useSessionStore = create<SessionState>()(
  immer((set, get) => ({
    sessions: [],
    archivedSessions: [],
    folders: [],
    activeSessionId: null,
    isLoaded: false,

    loadAll: async () => {
      const [all, folders] = await Promise.all([
        persistence.listSessions(true),
        persistence.listFolders(),
      ]);
      const redundantDraftIds = new Set(
        sortSessions(
          all.filter(
            (session) =>
              !session.archived &&
              !session.pinned &&
              !session.folderId &&
              session.messageCount === 0 &&
              session.title === "New chat",
          ),
        )
          .slice(1)
          .map((session) => session.id),
      );
      if (redundantDraftIds.size > 0) {
        await Promise.all(
          [...redundantDraftIds].map((sessionId) =>
            persistence.deleteSession(sessionId),
          ),
        );
      }
      const cleaned = all.filter(
        (session) => !redundantDraftIds.has(session.id),
      );
      set((state) => {
        state.sessions = sortSessions(cleaned.filter((s) => !s.archived));
        state.archivedSessions = sortSessions(
          cleaned.filter((s) => s.archived),
        );
        state.folders = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);
        state.isLoaded = true;
        if (
          !state.activeSessionId ||
          !cleaned.some((s) => s.id === state.activeSessionId)
        ) {
          state.activeSessionId = state.sessions[0]?.id ?? null;
        }
      });
      if (!get().activeSessionId) {
        await get().createSession();
      }
    },

    createSession: async (opts) => {
      if (!opts) {
        const reusable = get().sessions.find(
          (session) =>
            session.messageCount === 0 && session.title === "New chat",
        );
        if (reusable) {
          set((state) => {
            state.activeSessionId = reusable.id;
          });
          return reusable;
        }
      }
      const now = Date.now();
      const session: ChatSession = {
        id: generateId(),
        title: opts?.title ?? "New chat",
        createdAt: now,
        updatedAt: now,
        archived: false,
        pinned: false,
        folderId: opts?.folderId ?? null,
        messageCount: 0,
        mode: opts?.mode ?? useUiStore.getState().viewMode,
        systemPrompt: opts?.systemPrompt,
        modelId: opts?.modelId,
      };
      await persistence.createSession(session);
      set((state) => {
        state.sessions.unshift(session);
        state.activeSessionId = session.id;
      });
      return session;
    },

    selectSession: (id) => {
      set((state) => {
        state.activeSessionId = id;
      });
      const session = [...get().sessions, ...get().archivedSessions].find(
        (s) => s.id === id,
      );
      if (session?.mode) {
        useUiStore.getState().setViewMode(session.mode);
      }
    },

    renameSession: async (id, title) => {
      const session = [...get().sessions, ...get().archivedSessions].find(
        (s) => s.id === id,
      );
      if (!session) return;
      const updated = { ...session, title, updatedAt: Date.now() };
      await persistence.updateSession(updated);
      set((state) => {
        const target =
          state.sessions.find((s) => s.id === id) ??
          state.archivedSessions.find((s) => s.id === id);
        if (target) target.title = title;
      });
    },

    updateSessionMeta: async (id, patch) => {
      const session = [...get().sessions, ...get().archivedSessions].find(
        (s) => s.id === id,
      );
      if (!session) return;
      const updated = { ...session, ...patch };
      await persistence.updateSession(updated);
      set((state) => {
        const apply = (list: ChatSession[]) => {
          const idx = list.findIndex((s) => s.id === id);
          if (idx >= 0) list[idx] = updated;
        };
        apply(state.sessions);
        apply(state.archivedSessions);
      });
    },

    deleteSession: async (id) => {
      await persistence.deleteSession(id);
      set((state) => {
        state.sessions = state.sessions.filter((s) => s.id !== id);
        state.archivedSessions = state.archivedSessions.filter(
          (s) => s.id !== id,
        );
        if (state.activeSessionId === id) {
          state.activeSessionId = state.sessions[0]?.id ?? null;
        }
      });
      if (!get().activeSessionId) {
        await get().createSession();
      }
    },

    archiveSession: async (id, archived) => {
      const session = [...get().sessions, ...get().archivedSessions].find(
        (s) => s.id === id,
      );
      if (!session) return;
      const updated = {
        ...session,
        archived,
        pinned: archived ? false : session.pinned,
      };
      await persistence.updateSession(updated);
      set((state) => {
        if (archived) {
          state.sessions = state.sessions.filter((s) => s.id !== id);
          state.archivedSessions.unshift(updated);
          if (state.activeSessionId === id) {
            state.activeSessionId = state.sessions[0]?.id ?? null;
          }
        } else {
          state.archivedSessions = state.archivedSessions.filter(
            (s) => s.id !== id,
          );
          state.sessions.unshift(updated);
        }
      });
      if (!get().activeSessionId) {
        await get().createSession();
      }
    },

    duplicateSession: async (id) => {
      const source = [...get().sessions, ...get().archivedSessions].find(
        (s) => s.id === id,
      );
      if (!source) return null;
      const now = Date.now();
      const copy: ChatSession = {
        ...source,
        id: generateId(),
        title: `${source.title} (copy)`,
        createdAt: now,
        updatedAt: now,
        pinned: false,
        archived: false,
      };
      const messages = await persistence.listMessages(id);
      await persistence.createSession(copy);
      for (const message of messages) {
        await persistence.addMessage({
          ...message,
          id: generateId(),
          sessionId: copy.id,
        });
      }
      set((state) => {
        state.sessions.unshift(copy);
        state.activeSessionId = copy.id;
      });
      return copy;
    },

    togglePin: async (id) => {
      const session = get().sessions.find((s) => s.id === id);
      if (!session) return;
      if (!session.pinned) {
        const pinnedCount = get().sessions.filter((s) => s.pinned).length;
        if (pinnedCount >= MAX_PINNED_SESSIONS) {
          toast.error(`You can pin at most ${MAX_PINNED_SESSIONS} chats.`);
          return;
        }
      }
      const updated = { ...session, pinned: !session.pinned };
      await persistence.updateSession(updated);
      set((state) => {
        const target = state.sessions.find((s) => s.id === id);
        if (target) target.pinned = !session.pinned;
      });
    },

    moveToFolder: async (id, folderId) => {
      const session = get().sessions.find((s) => s.id === id);
      if (!session) return;
      const updated = { ...session, folderId };
      await persistence.updateSession(updated);
      set((state) => {
        const target = state.sessions.find((s) => s.id === id);
        if (target) target.folderId = folderId;
      });
    },

    markUnread: async (id, unread) => {
      const session = [...get().sessions, ...get().archivedSessions].find(
        (s) => s.id === id,
      );
      if (!session) return;
      const updated = { ...session, unread };
      await persistence.updateSession(updated);
      set((state) => {
        const apply = (list: ChatSession[]) => {
          const idx = list.findIndex((s) => s.id === id);
          if (idx >= 0) list[idx] = updated;
        };
        apply(state.sessions);
        apply(state.archivedSessions);
      });
    },

    createFolder: async (name) => {
      const folder: ChatFolder = {
        id: generateId(),
        name,
        createdAt: Date.now(),
        sortOrder: get().folders.length,
      };
      await persistence.createFolder(folder);
      set((state) => {
        state.folders.push(folder);
      });
      return folder;
    },

    renameFolder: async (id, name) => {
      const folder = get().folders.find((f) => f.id === id);
      if (!folder) return;
      await persistence.updateFolder({ ...folder, name });
      set((state) => {
        const target = state.folders.find((f) => f.id === id);
        if (target) target.name = name;
      });
    },

    setFolderColor: async (id, color) => {
      const folder = get().folders.find((f) => f.id === id);
      if (!folder) return;
      await persistence.updateFolder({ ...folder, color });
      set((state) => {
        const target = state.folders.find((f) => f.id === id);
        if (target) target.color = color;
      });
    },

    deleteFolder: async (id) => {
      await persistence.deleteFolder(id);
      const orphans = get().sessions.filter((s) => s.folderId === id);
      for (const orphan of orphans) {
        await persistence.updateSession({ ...orphan, folderId: null });
      }
      set((state) => {
        state.folders = state.folders.filter((f) => f.id !== id);
        for (const session of state.sessions) {
          if (session.folderId === id) session.folderId = null;
        }
      });
    },

    exportSession: async (id, format) => {
      const session = [...get().sessions, ...get().archivedSessions].find(
        (s) => s.id === id,
      );
      if (!session) return "";
      const messages = await persistence.listMessages(id);
      return format === "json"
        ? sessionToJson(session, messages)
        : messagesToMarkdown(session, messages);
    },

    touchSession: (id, patch) => {
      set((state) => {
        const target = state.sessions.find((s) => s.id === id);
        if (!target) return;
        target.updatedAt = Date.now();
        if (patch) Object.assign(target, patch);
        state.sessions = sortSessions(state.sessions);
      });
      const session = get().sessions.find((s) => s.id === id);
      if (session) void persistence.updateSession(session);
    },

    ensureActiveSession: async () => {
      const current = get().activeSessionId;
      if (current) return current;
      const session = await get().createSession();
      return session.id;
    },
  })),
);
