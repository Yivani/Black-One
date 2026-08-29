import Dexie, { type EntityTable } from "dexie";
import type { Message } from "@/types/chat";
import type { ChatFolder, ChatSession } from "@/types/session";
import { folderFromRow, ipc, isTauri, messageFromRow, sessionFromRow } from "@/lib/ipc";

export interface PersistenceAdapter {
  listSessions(includeArchived: boolean): Promise<ChatSession[]>;
  createSession(session: ChatSession): Promise<void>;
  updateSession(session: ChatSession): Promise<void>;
  deleteSession(id: string): Promise<void>;
  listMessages(sessionId: string): Promise<Message[]>;
  addMessage(message: Message): Promise<void>;
  updateMessage(message: Message): Promise<void>;
  /** Deletes the message with the given id and every later message in the session. */
  deleteMessagesFrom(sessionId: string, messageId: string): Promise<void>;
  listFolders(): Promise<ChatFolder[]>;
  createFolder(folder: ChatFolder): Promise<void>;
  updateFolder(folder: ChatFolder): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  readMemoryFile(): Promise<string>;
  writeMemoryFile(content: string): Promise<void>;
  deleteMemoryFile(): Promise<void>;
  clearAll(): Promise<void>;
}

interface SettingRow {
  key: string;
  value: string;
}

class BlackOneDatabase extends Dexie {
  sessions!: EntityTable<ChatSession, "id">;
  messages!: EntityTable<Message, "id">;
  folders!: EntityTable<ChatFolder, "id">;
  settings!: EntityTable<SettingRow, "key">;

  constructor() {
    super("black-one");
    this.version(1).stores({
      sessions: "id, updatedAt, archived, pinned, folderId",
      messages: "id, sessionId, createdAt",
      folders: "id, sortOrder",
      settings: "key",
    });
  }
}

class DexieAdapter implements PersistenceAdapter {
  private db = new BlackOneDatabase();

  async listSessions(includeArchived: boolean): Promise<ChatSession[]> {
    const all = await this.db.sessions.orderBy("updatedAt").reverse().toArray();
    return all.filter((s) => includeArchived || !s.archived);
  }

  async createSession(session: ChatSession): Promise<void> {
    await this.db.sessions.add(session);
  }

  async updateSession(session: ChatSession): Promise<void> {
    await this.db.sessions.put(session);
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.messages.where("sessionId").equals(id).delete();
    await this.db.sessions.delete(id);
  }

  async listMessages(sessionId: string): Promise<Message[]> {
    return this.db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
  }

  async addMessage(message: Message): Promise<void> {
    await this.db.messages.add(message);
  }

  async updateMessage(message: Message): Promise<void> {
    await this.db.messages.put(message);
  }

  async deleteMessagesFrom(sessionId: string, messageId: string): Promise<void> {
    const messages = await this.listMessages(sessionId);
    const target = messages.find((m) => m.id === messageId);
    if (!target) return;
    const toDelete = messages.filter((m) => m.createdAt >= target.createdAt).map((m) => m.id);
    await this.db.messages.bulkDelete(toDelete);
  }

  async listFolders(): Promise<ChatFolder[]> {
    return this.db.folders.orderBy("sortOrder").toArray();
  }

  async createFolder(folder: ChatFolder): Promise<void> {
    await this.db.folders.add(folder);
  }

  async updateFolder(folder: ChatFolder): Promise<void> {
    await this.db.folders.put(folder);
  }

  async deleteFolder(id: string): Promise<void> {
    await this.db.folders.delete(id);
  }

  async getSetting(key: string): Promise<string | null> {
    const row = await this.db.settings.get(key);
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.settings.put({ key, value });
  }

  async readMemoryFile(): Promise<string> {
    const row = await this.db.settings.get("app:memory");
    return row?.value ?? "";
  }

  async writeMemoryFile(content: string): Promise<void> {
    await this.db.settings.put({ key: "app:memory", value: content });
  }

  async deleteMemoryFile(): Promise<void> {
    await this.db.settings.delete("app:memory");
    await this.db.settings.delete("app:memory-md");
  }

  async clearAll(): Promise<void> {
    await this.db.transaction("rw", [this.db.sessions, this.db.messages, this.db.folders, this.db.settings], async () => {
      await Promise.all([
        this.db.sessions.clear(),
        this.db.messages.clear(),
        this.db.folders.clear(),
        this.db.settings.clear(),
      ]);
    });
  }
}

class TauriAdapter implements PersistenceAdapter {
  async listSessions(includeArchived: boolean): Promise<ChatSession[]> {
    const rows = await ipc.listSessions(includeArchived);
    return rows.map(sessionFromRow);
  }

  createSession(session: ChatSession): Promise<void> {
    return ipc.createSession(session);
  }

  updateSession(session: ChatSession): Promise<void> {
    return ipc.updateSession(session);
  }

  deleteSession(id: string): Promise<void> {
    return ipc.deleteSession(id);
  }

  async listMessages(sessionId: string): Promise<Message[]> {
    const rows = await ipc.listMessages(sessionId);
    return rows.map(messageFromRow);
  }

  addMessage(message: Message): Promise<void> {
    return ipc.addMessage(message);
  }

  updateMessage(message: Message): Promise<void> {
    return ipc.updateMessage(message);
  }

  deleteMessagesFrom(sessionId: string, messageId: string): Promise<void> {
    return ipc.deleteMessagesFrom(sessionId, messageId);
  }

  async listFolders(): Promise<ChatFolder[]> {
    const rows = await ipc.listFolders();
    return rows.map(folderFromRow);
  }

  createFolder(folder: ChatFolder): Promise<void> {
    return ipc.createFolder(folder);
  }

  updateFolder(folder: ChatFolder): Promise<void> {
    return ipc.updateFolder(folder);
  }

  deleteFolder(id: string): Promise<void> {
    return ipc.deleteFolder(id);
  }

  getSetting(key: string): Promise<string | null> {
    return ipc.getSetting(key);
  }

  setSetting(key: string, value: string): Promise<void> {
    return ipc.setSetting(key, value);
  }

  readMemoryFile(): Promise<string> {
    return ipc.readMemoryFile();
  }

  writeMemoryFile(content: string): Promise<void> {
    return ipc.writeMemoryFile(content);
  }

  async deleteMemoryFile(): Promise<void> {
    await ipc.deleteMemoryFile();
    // The markdown mirror is stored as a setting on desktop too.
    await ipc.setSetting("app:memory-md", "");
  }

  clearAll(): Promise<void> {
    return ipc.clearAllData();
  }
}

export const persistence: PersistenceAdapter = isTauri ? new TauriAdapter() : new DexieAdapter();
