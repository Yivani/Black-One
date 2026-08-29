export interface MemoryEntry {
  id: string;
  createdAt: number;
  category: string;
  content: string;
  importance: 1 | 2 | 3 | 4 | 5;
  sessionId?: string;
}

export interface MemoryBank {
  entries: MemoryEntry[];
  markdown?: string;
}

const encoder = new TextEncoder();

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

export function pruneMemoryEntries(
  entries: MemoryEntry[],
  maxBytes: number,
): MemoryEntry[] {
  const cap = Math.max(0, maxBytes);
  const sizes = new Map(entries.map((entry) => [entry, encoder.encode(JSON.stringify(entry)).length]));
  let count = entries.length;
  let total = entries.reduce((sum, entry) => sum + (sizes.get(entry) ?? 0), Math.max(0, count - 1));
  if (total <= cap) return [...entries];

  const removed = new Set<MemoryEntry>();
  const removalOrder = [...entries].sort(
    (a, b) => a.importance - b.importance || a.createdAt - b.createdAt,
  );
  for (const entry of removalOrder) {
    if (total <= cap) break;
    total -= (sizes.get(entry) ?? 0) + (count > 1 ? 1 : 0);
    count -= 1;
    removed.add(entry);
  }
  return entries.filter((entry) => !removed.has(entry));
}

export function selectPromptEntries(
  entries: MemoryEntry[],
  enabledCategories: string[],
  maxChars: number,
): MemoryEntry[] {
  const allowed = new Set(enabledCategories);
  const candidates = entries
    .filter((entry) => allowed.has(entry.category))
    .sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt);
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
