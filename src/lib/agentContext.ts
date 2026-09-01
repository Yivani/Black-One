/**
 * Sharing memory with the terminal CLI agents.
 *
 * Black One's own model gets the memory bank through its system prompt. Claude
 * Code, Codex, Gemini CLI and Kimi running in a pane get nothing — they are
 * separate processes with their own context. But every one of them reads a
 * Markdown context file from the project root on startup, so that file is the
 * shared channel.
 *
 * Import-free: the rendering and — more importantly — the *merge* are pure, so
 * the guarantee that this never eats a hand-written file is unit-tested.
 */

export interface AgentContextEntry {
  content: string;
  category: string;
  importance: number;
  pinned?: boolean;
}

/**
 * Markers delimiting the region this app owns.
 *
 * Everything outside them is the user's and is preserved byte for byte. HTML
 * comments because every one of these files is Markdown, where they render as
 * nothing.
 */
export const BLOCK_START = "<!-- black-one:memory:start -->";
export const BLOCK_END = "<!-- black-one:memory:end -->";

/** Context files, and which agent reads each one. */
export const AGENT_CONTEXT_FILES: Array<{ file: string; tools: string[] }> = [
  // The cross-tool convention; Codex reads it, and others increasingly do.
  { file: "AGENTS.md", tools: ["codex", "opencode", "kimi"] },
  { file: "CLAUDE.md", tools: ["claude"] },
  { file: "GEMINI.md", tools: ["gemini"] },
];

/**
 * What `agentContextFiles` defaulted to before GEMINI.md was included.
 *
 * A stored list identical to this was never chosen — it is just an install
 * that predates the fix — so it is safe to upgrade. Anything else is the
 * user's own selection and is left alone.
 */
const LEGACY_CONTEXT_FILE_DEFAULT = ["AGENTS.md", "CLAUDE.md"];

export function isLegacyContextFileDefault(files: readonly string[]): boolean {
  return (
    files.length === LEGACY_CONTEXT_FILE_DEFAULT.length &&
    LEGACY_CONTEXT_FILE_DEFAULT.every((file, index) => files[index] === file)
  );
}

const HEADING = "## Project memory (maintained by Black One)";

/** Renders the owned block. Returns null when there is nothing worth sharing. */
export function renderAgentBlock(entries: readonly AgentContextEntry[]): string | null {
  if (entries.length === 0) return null;

  const grouped = new Map<string, AgentContextEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }

  const lines = [
    BLOCK_START,
    HEADING,
    "",
    "Facts the user asked Black One to keep, shared with every agent in every",
    "project. Edit them in Black One — anything written between these markers",
    "by hand is replaced on the next sync.",
    "",
  ];

  for (const [category, list] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${category}`);
    for (const entry of [...list].sort((a, b) => b.importance - a.importance)) {
      lines.push(`- ${entry.content}${entry.pinned ? " _(pinned)_" : ""}`);
    }
    lines.push("");
  }

  lines.push(BLOCK_END);
  return lines.join("\n");
}

/**
 * Splices the block into an existing file.
 *
 * The three cases that matter: no file yet, a file with our block already in
 * it, and a file the user wrote that we have never touched. Only the region
 * between the markers is ever rewritten.
 */
export function mergeAgentFile(existing: string, block: string | null): string {
  const start = existing.indexOf(BLOCK_START);
  const end = existing.indexOf(BLOCK_END);
  const hasBlock = start !== -1 && end !== -1 && end > start;

  if (!hasBlock) {
    if (block === null) return existing;
    if (!existing.trim()) return `${block}\n`;
    return `${existing.replace(/\s*$/, "")}\n\n${block}\n`;
  }

  const before = existing.slice(0, start);
  const after = existing.slice(end + BLOCK_END.length);

  // Nothing to share any more: take the block out and leave the rest intact.
  if (block === null) {
    const merged = `${before.replace(/\s*$/, "")}\n${after.replace(/^\s*\n/, "")}`;
    return merged.trim() ? merged : "";
  }

  return `${before}${block}${after}`;
}

/** Whether a rewrite would actually change anything. */
export function needsUpdate(existing: string, block: string | null): boolean {
  return mergeAgentFile(existing, block) !== existing;
}

/**
 * Decides which directory the context files belong in.
 *
 * A workspace folder is the right answer when there is one. When there is not,
 * the CLI agents are still running *somewhere* — and a file they cannot see is
 * worth nothing, so the terminal's own working directory is used instead. That
 * is literally where Kimi says it looks: "any AGENTS.md in the current
 * directory".
 */
export function resolveContextFolder(
  workspacePath: string | null | undefined,
  terminalCwds: readonly string[],
): string | null {
  const workspace = workspacePath?.trim();
  if (workspace) return workspace;
  for (const cwd of terminalCwds) {
    const trimmed = cwd?.trim();
    // "~" is what the backend reports when it could not resolve a real path.
    if (trimmed && trimmed !== "~" && trimmed !== ".") return trimmed;
  }
  return null;
}

/** Joins a directory and a file name without assuming a path separator. */
export function contextFilePath(folder: string, file: string): string {
  const separator = folder.includes("\\") && !folder.includes("/") ? "\\" : "/";
  return `${folder.replace(/[\\/]+$/, "")}${separator}${file}`;
}
