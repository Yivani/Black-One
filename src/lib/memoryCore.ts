/**
 * Memory bank rules.
 *
 * Import-free so the parts that decide what survives — deduplication,
 * superseding, confirmation, and pruning under a byte cap — are unit-tested
 * without a filesystem or a store.
 */

/** Where a memory came from. Terminal facts are evidence; chat facts are claims. */
export type MemorySource = "chat" | "terminal" | "manual";

export interface MemoryEntry {
  id: string;
  createdAt: number;
  category: string;
  content: string;
  importance: 1 | 2 | 3 | 4 | 5;
  sessionId?: string;
  /** Fact type, e.g. "command" | "toolchain". Free-form to stay import-free. */
  kind?: string;
  source?: MemorySource;
  /** Terminal facts are scoped: the game's build command is not the site's. */
  workspaceId?: string;
  /**
   * Stable identity of what the fact is *about*. Two entries with the same
   * subject describe the same thing, so the newer one replaces the older.
   */
  subject?: string;
  /** How many times this fact has been independently observed. */
  hits?: number;
  lastSeenAt?: number;
  /** Pinned entries are never pruned and never superseded automatically. */
  pinned?: boolean;
}

export interface MemoryBank {
  entries: MemoryEntry[];
  markdown?: string;
}

const encoder = new TextEncoder();

/** Observations needed before a fact is treated as an established habit. */
export const CONFIRMATIONS_FOR_PROMOTION = 3;

export function memoryKey(content: string): string {
  return content
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^the user\s+/, "")
    .replace(/^user\s+/, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?,;:]+$/, "")
    .trim();
}

export function sanitizeMemoryContent(content: string, maxLength = 1000): string {
  return content.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function escapeMemoryText(content: string): string {
  return content.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Identity of the thing a fact is about, scoped to its workspace. */
export function subjectKey(subject: string, workspaceId?: string): string {
  return `${workspaceId ?? "global"}::${subject}`;
}

export function clampImportance(value: unknown): MemoryEntry["importance"] {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 3;
  return Math.max(1, Math.min(5, Math.round(number))) as MemoryEntry["importance"];
}

// ------------------------------------------------------------------ upsert

export type UpsertOutcome = "added" | "updated" | "confirmed" | "skipped";

export interface MemoryUpsert {
  id: string;
  now: number;
  category: string;
  content: string;
  importance: 1 | 2 | 3 | 4 | 5;
  source: MemorySource;
  kind?: string;
  subject?: string;
  workspaceId?: string;
  sessionId?: string;
}

export interface UpsertResult {
  entries: MemoryEntry[];
  outcome: UpsertOutcome;
  /** The resulting entry, or null when the upsert was skipped. */
  entry: MemoryEntry | null;
}

function promoted(
  base: MemoryEntry["importance"],
  hits: number,
): MemoryEntry["importance"] {
  // A command confirmed several times is a habit, not a one-off. One notch is
  // enough: repetition should nudge the ordering, not dominate it.
  return hits >= CONFIRMATIONS_FOR_PROMOTION
    ? clampImportance(base + 1)
    : clampImportance(base);
}

/**
 * Adds a fact, or folds it into the one it supersedes.
 *
 * Facts with a subject replace the previous fact about that subject in the same
 * workspace — this is what stops "node is v20" from accumulating next to "node
 * is v22". Facts without one (chat memories) fall back to content dedupe.
 *
 * A pinned entry is never overwritten: the user's edit outranks an observation.
 */
export function upsertMemoryEntry(
  entries: readonly MemoryEntry[],
  upsert: MemoryUpsert,
): UpsertResult {
  const content = sanitizeMemoryContent(upsert.content);
  if (!content) return { entries: [...entries], outcome: "skipped", entry: null };

  const index = upsert.subject
    ? entries.findIndex(
        (entry) =>
          entry.subject !== undefined &&
          subjectKey(entry.subject, entry.workspaceId) ===
            subjectKey(upsert.subject!, upsert.workspaceId),
      )
    : entries.findIndex((entry) => memoryKey(entry.content) === memoryKey(content));

  if (index === -1) {
    const entry: MemoryEntry = {
      id: upsert.id,
      createdAt: upsert.now,
      lastSeenAt: upsert.now,
      category: upsert.category,
      content,
      importance: clampImportance(upsert.importance),
      source: upsert.source,
      hits: 1,
      ...(upsert.kind ? { kind: upsert.kind } : {}),
      ...(upsert.subject ? { subject: upsert.subject } : {}),
      ...(upsert.workspaceId ? { workspaceId: upsert.workspaceId } : {}),
      ...(upsert.sessionId ? { sessionId: upsert.sessionId } : {}),
    };
    return { entries: [...entries, entry], outcome: "added", entry };
  }

  const existing = entries[index];
  if (existing.pinned) {
    return { entries: [...entries], outcome: "skipped", entry: existing };
  }

  const hits = (existing.hits ?? 1) + 1;
  const changed = memoryKey(existing.content) !== memoryKey(content);
  const entry: MemoryEntry = {
    ...existing,
    // The subject is the same thing, so it keeps its identity and its age.
    content: changed ? content : existing.content,
    category: upsert.category,
    importance: promoted(clampImportance(upsert.importance), hits),
    hits,
    lastSeenAt: upsert.now,
    source: upsert.source,
    ...(upsert.kind ? { kind: upsert.kind } : {}),
    ...(upsert.workspaceId ? { workspaceId: upsert.workspaceId } : {}),
  };
  const next = [...entries];
  next[index] = entry;
  return { entries: next, outcome: changed ? "updated" : "confirmed", entry };
}

// ------------------------------------------------------------------ pruning

export function pruneMemoryEntries(
  entries: MemoryEntry[],
  maxBytes: number,
): MemoryEntry[] {
  const cap = Math.max(0, maxBytes);
  const sizes = new Map(
    entries.map((entry) => [entry, encoder.encode(JSON.stringify(entry)).length]),
  );
  let count = entries.length;
  let total = entries.reduce(
    (sum, entry) => sum + (sizes.get(entry) ?? 0),
    Math.max(0, count - 1),
  );
  if (total <= cap) return [...entries];

  const removed = new Set<MemoryEntry>();
  // Drop the least valuable first: low importance, rarely confirmed, and stale.
  // Pinned entries are excluded entirely — the user asked for them.
  const removalOrder = entries
    .filter((entry) => !entry.pinned)
    .sort(
      (a, b) =>
        a.importance - b.importance ||
        (a.hits ?? 1) - (b.hits ?? 1) ||
        (a.lastSeenAt ?? a.createdAt) - (b.lastSeenAt ?? b.createdAt) ||
        a.createdAt - b.createdAt,
    );
  for (const entry of removalOrder) {
    if (total <= cap) break;
    total -= (sizes.get(entry) ?? 0) + (count > 1 ? 1 : 0);
    count -= 1;
    removed.add(entry);
  }
  return entries.filter((entry) => !removed.has(entry));
}

// ------------------------------------------------------------- prompt build

export function selectPromptEntries(
  entries: MemoryEntry[],
  enabledCategories: string[],
  maxChars: number,
  /** When set, workspace-scoped entries from other workspaces are excluded. */
  workspaceId?: string,
): MemoryEntry[] {
  const allowed = new Set(enabledCategories);
  const candidates = entries
    .filter((entry) => allowed.has(entry.category))
    .filter(
      (entry) =>
        // A global fact is always in scope; a scoped one only in its workspace.
        entry.workspaceId === undefined ||
        workspaceId === undefined ||
        entry.workspaceId === workspaceId,
    )
    .sort(
      (a, b) =>
        b.importance - a.importance ||
        (b.hits ?? 1) - (a.hits ?? 1) ||
        b.createdAt - a.createdAt,
    );
  const selected = new Set<MemoryEntry>();
  let used = 0;
  for (const entry of candidates) {
    const length = entry.category.length + escapeMemoryText(entry.content).length + 4;
    if (used + length > maxChars) continue;
    selected.add(entry);
    used += length;
  }
  return entries.filter((entry) => selected.has(entry));
}
