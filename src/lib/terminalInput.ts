/**
 * Reading the user's intent out of a terminal.
 *
 * Saying "remember that I prefer concise answers" to a CLI agent running in a
 * pane should reach the memory bank, the same as saying it in the composer.
 *
 * The critical design choice is *which stream to watch*. Scanning terminal
 * **output** would find the phrase in a `cat`ed README, in a man page, or in
 * the agent's own reply — noise the bank must never absorb. Watching what the
 * user **types** cannot produce those false positives: the only way a directive
 * appears is if a human pressed the keys.
 *
 * Import-free so the line assembly and the directive rules are unit-tested
 * without a PTY.
 */

/** Control bytes a terminal actually sends, named so they are visible in a diff. */
const ESC = "\u001B";
const BACKSPACE = "\u007F";
const CTRL_C = "\u0003";
const CTRL_U = "\u0015";
const CTRL_W = "\u0017";
const BELL = "\u0007";

/** Keys that end a line and submit it. */
const SUBMIT = /[\r\n]/;

/** Longest line we will assemble. A paste of a whole file is not a directive. */
const MAX_LINE = 400;

export interface InputState {
  /** Partial line still being typed. */
  buffer: string;
  /**
   * Bytes of an escape sequence seen so far, empty when not inside one.
   *
   * This has to survive across chunks: a terminal is free to deliver `ESC`,
   * `[` and `D` in three separate writes, and without carrying the state the
   * tail of an arrow key would land in the line as literal text.
   */
  pending: string;
}

export interface InputScanResult {
  state: InputState;
  /** Lines the user submitted in this chunk. */
  lines: string[];
}

export const EMPTY_INPUT_STATE: InputState = { buffer: "", pending: "" };

/** Longest escape sequence we will wait for before giving up on it. */
const MAX_ESCAPE = 32;

/**
 * The wrappers a terminal puts around pasted text when bracketed paste is on.
 *
 * Every serious TUI — Kimi Code, Claude Code, Codex — turns this mode on, so a
 * pasted instruction arrives as `ESC[200~ … ESC[201~`. These are not cursor
 * movement: the text between them is exactly what the user meant to enter, and
 * treating them like an arrow key threw the whole line away.
 */
const BRACKETED_PASTE = new RegExp(`^${ESC}\\[20[01]~$`);

/**
 * The only sequences that mean the user edited the line somewhere this buffer
 * cannot follow: arrow keys, Home/End, Insert/Delete — with or without
 * modifiers, and in both normal and application cursor mode.
 *
 * Everything else a terminal sends upstream is chatter, not editing: cursor
 * position replies to a TUI's own query, focus in/out, and mouse movement.
 * Treating those as edits threw the line away mid-sentence, which is why a
 * directive typed into Kimi Code — whose input box redraws and queries the
 * cursor — never arrived, while the same words typed into Claude Code and
 * Codex did.
 */
const EDITING_KEYS = new RegExp(
  `^${ESC}(?:\\[[0-9;]*[ABCDHF]|\\[[1234678]~|O[ABCDHF])$`,
);

function invalidatesLine(sequence: string): boolean {
  return EDITING_KEYS.test(sequence);
}

/** Whether `pending` is now a complete escape sequence. */
function escapeComplete(pending: string): boolean {
  if (pending.length < 2) return false;
  // Legacy X10 mouse reports carry three raw coordinate bytes after `ESC[M`,
  // and those bytes fall in the range a CSI final byte lives in — without this
  // they would end the sequence early and leak into the line as garbage.
  if (pending.startsWith(`${ESC}[M`)) return pending.length >= 6;
  const kind = pending[1];
  // SS3: application-cursor-mode arrows are `ESC O A`, three bytes, not two.
  if (kind === "O") return pending.length >= 3;
  if (kind === "[") {
    // CSI: parameters, then a final byte in the @-~ range.
    return /[@-~]$/.test(pending.slice(2));
  }
  if (kind === "]") {
    // OSC: runs until BEL or ESC-backslash.
    return pending.endsWith(BELL) || pending.endsWith(ESC + "\\");
  }
  // Anything else is a two-byte escape.
  return true;
}

/**
 * Folds a chunk of keystrokes into the line the user is typing.
 *
 * Handles the control bytes a shell or TUI actually sends: backspace, Ctrl-C,
 * Ctrl-U, and escape sequences from arrow keys. An escape abandons the line
 * rather than being interpreted — the cursor may have moved somewhere this
 * buffer cannot represent, and missing a directive typed with mid-line edits
 * beats recording something the user did not write.
 */
export function applyInputChunk(
  state: InputState,
  chunk: string,
): InputScanResult {
  let { buffer: current, pending } = state;
  const lines: string[] = [];

  for (const char of chunk) {
    if (pending) {
      pending += char;
      if (pending.length > MAX_ESCAPE) {
        // Malformed or truncated: the terminal state is unknown, so is the line.
        pending = "";
        current = "";
        continue;
      }
      if (escapeComplete(pending)) {
        // Only a real editing key invalidates what the user typed.
        if (invalidatesLine(pending)) current = "";
        pending = "";
      }
      continue;
    }

    if (char === ESC) {
      // The line is only abandoned once the sequence is known not to be a
      // paste wrapper, which is decided when it completes above.
      pending = char;
      continue;
    }

    if (SUBMIT.test(char)) {
      if (current.trim()) lines.push(current.trim());
      current = "";
      continue;
    }

    if (char === BACKSPACE || char === "\b") {
      current = current.slice(0, -1);
      continue;
    }

    // Ctrl-C, Ctrl-U, Ctrl-W: the line is gone.
    if (char === CTRL_C || char === CTRL_U || char === CTRL_W) {
      current = "";
      continue;
    }

    // Any other C0 control byte is not text the user meant to type.
    if (char < " " && char !== "\t") continue;

    current += char;
    if (current.length > MAX_LINE) current = "";
  }

  return { state: { buffer: current, pending }, lines };
}

/** Decoration a shell prompt or TUI input box may prefix to the typed line. */
const PROMPT_PREFIX = /^[\s>❯$#%│|»▸●•\-*]+/;

/**
 * Extracts the fact from an explicit "remember this" instruction.
 *
 * Deliberately narrow: the line must *begin* with the directive, so "I can't
 * remember the build command" is not mistaken for one. Returns null for
 * anything else, which is almost every line the user ever types.
 */
export function detectMemoryDirective(line: string): string | null {
  const cleaned = line.replace(PROMPT_PREFIX, "").trim();
  if (!cleaned || cleaned.length > MAX_LINE) return null;

  const match =
    /^(?:(?:please|pls|can you|could you|would you)\s+)*(?:remember|memorize|memorise|note|save)(?:\s+this)?(?:\s+for\s+(?:later|next\s+time))?(?:\s+that)?[\s:,-]+([\s\S]+)$/i.exec(
      cleaned,
    );
  const content = match?.[1]?.trim().replace(/[\s.]+$/, "");
  if (!content || content.length < 4) return null;

  // "save the file", "note down" and similar are commands, not facts.
  if (/^(the\s+file|it|that|this|everything|all)$/i.test(content)) return null;
  return content;
}

/**
 * Unambiguous first-person identity statements.
 *
 * The one exception to "only an explicit directive counts". Telling an agent
 * your name is not a task request — it is a fact you expect it to keep, and
 * people say it without thinking to add "remember". Each pattern is anchored to
 * the start of the line and names the *kind* of fact, so a task that merely
 * mentions the same words ("my name is not showing up in the header") cannot
 * pass: those read as a problem, not an introduction, and are excluded below.
 */
const INTRODUCTIONS: RegExp[] = [
  /^my (?:name|username|handle|nickname|email|github|pronouns?|timezone|time zone) (?:is|are) .{2,}/i,
  /^(?:call me|i go by) [^\s].{1,}/i,
  /^i(?:'m| am) (?:from|based in) .{2,}/i,
  /^i live in .{2,}/i,
  /^i work (?:at|as) .{2,}/i,
];

/** Phrases that turn an introduction back into a bug report or a request. */
const NOT_AN_INTRODUCTION =
  /\b(?:not working|not showing|doesn'?t work|broken|failing|error|undefined|null|bug|fix|why|how do i)\b/i;

/**
 * Recognizes someone introducing themselves, which is worth remembering even
 * without the word "remember".
 */
export function detectIntroduction(line: string): string | null {
  const cleaned = line.replace(PROMPT_PREFIX, "").trim();
  if (!cleaned || cleaned.length > MAX_LINE) return null;
  if (NOT_AN_INTRODUCTION.test(cleaned)) return null;
  if (!INTRODUCTIONS.some((pattern) => pattern.test(cleaned))) return null;
  return cleaned.replace(/[\s.]+$/, "");
}

export interface MemoryStatement {
  content: string;
  category: string;
}

/**
 * Everything typed at a terminal that is worth keeping: an explicit
 * instruction, or an introduction. Nothing else — a question, a task, or a
 * command produces null, which is almost every line anyone ever types.
 */
export function detectMemoryStatement(line: string): MemoryStatement | null {
  const directive = detectMemoryDirective(line);
  if (directive) {
    return { content: directive, category: categorizeDirective(directive) };
  }
  const introduction = detectIntroduction(line);
  if (introduction) return { content: introduction, category: "personal" };
  return null;
}

/**
 * Guesses a category for a directive typed at a terminal.
 *
 * Terminal directives are usually about the project, so the default leans that
 * way rather than to "personal" the way a chat message would.
 */
export function categorizeDirective(content: string): string {
  if (/\b(?:prefer|preference|like|dislike|always|never|don't|do not)\b/i.test(content)) {
    return "preferences";
  }
  // Someone introducing themselves is not describing the project. Checked
  // before the project categories so "my name is …, I do web dev" does not
  // land under conventions.
  if (/\b(?:my name is|i am|i'm|call me|years old|i live in|my username|my email|my github|born in|pronouns)\b/i.test(content)) {
    return "personal";
  }
  if (/\b(?:command|script)\b|`|\b(?:npm|pnpm|yarn|bun|cargo|make|pytest|tsc|go|dotnet)\b/i.test(content)) {
    return "commands";
  }
  if (/\b(?:version|installed|available|path|port|url|localhost)\b/i.test(content)) {
    return "environment";
  }
  if (/\b(?:goal|aim|plan to|want to|need to)\b/i.test(content)) return "goals";
  return "conventions";
}
