/**
 * Terminal-derived memory.
 *
 * The bar here is deliberately very high, and it is set by one question:
 *
 *   **Would an agent starting work do something different because of this?**
 *
 * "The build command is `npm run build`" fails that test — it is written in
 * `package.json`, and any agent can read it in a second. So does the package
 * manager (the lockfile says so), the dev server port (the config says so), and
 * a tool's version (one command away, and stale the moment it is upgraded).
 * Writing those down is not memory; it is clutter that buries the handful of
 * facts that actually matter.
 *
 * What survives the test is what the project's own files *cannot* tell you:
 * something this machine does not have. Everything else worth remembering comes
 * from the user saying it — see `terminalInput.ts`.
 *
 * Import-free so every rule is unit-tested without a PTY.
 */

/** The one kind of fact worth learning from a command on its own. */
export type MemoryKind = "missing-tool";

/** A finished command, as observed by the tool runtime. */
export interface CommandObservation {
  command: string;
  /** Directory the command ran in. */
  cwd?: string;
  /** stdout and stderr, already ANSI-stripped by the caller. */
  output: string;
  exitCode: number | null;
  timedOut?: boolean;
}

export interface MemoryCandidate {
  kind: MemoryKind;
  /**
   * Stable identity. A newer observation with the same subject replaces the
   * older one, so installing a tool retires the note that it was missing.
   */
  subject: string;
  content: string;
  importance: 1 | 2 | 3 | 4 | 5;
}

/** Only the head of a long log is scanned, so extraction stays fast. */
const MAX_SCAN_CHARS = 16_000;

export function categoryForKind(_kind: MemoryKind): string {
  return "environment";
}

// --------------------------------------------------------------- redaction

/**
 * Secrets that must never reach the memory bank.
 *
 * Terminals are full of credentials, and a memory bank is the worst possible
 * place for one: it is long-lived, it is fed back into prompts, it is written
 * into files the CLI agents read, and it can be exported.
 */
const SECRET_RULES: Array<{ pattern: RegExp; replace: string }> = [
  { pattern: /\bsk-[A-Za-z0-9_-]{16,}/g, replace: "[redacted]" },
  { pattern: /\bghp_[A-Za-z0-9]{20,}/g, replace: "[redacted]" },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/g, replace: "[redacted]" },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g, replace: "[redacted]" },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replace: "[redacted]" },
  {
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    replace: "[redacted]",
  },
  {
    pattern: /([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/g,
    replace: "$1[redacted]@",
  },
  {
    pattern:
      /(--?(?:token|api[-_]?key|apikey|password|passwd|secret|auth|credential)s?[=\s]+)(?!\[redacted\])\S+/gi,
    replace: "$1[redacted]",
  },
  {
    pattern: /\b([A-Z][A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|PASSWD|CREDENTIALS))=\S+/g,
    replace: "$1=[redacted]",
  },
  { pattern: /\b(Authorization:\s*(?:Bearer|Basic)\s+)\S+/gi, replace: "$1[redacted]" },
];

/** Masks anything that looks like a credential. */
export function redactSecrets(text: string): string {
  let result = text;
  for (const { pattern, replace } of SECRET_RULES) {
    result = result.replace(pattern, replace);
  }
  return result;
}

/** Whether redaction would change the text — i.e. it carries a credential. */
export function containsSecret(text: string): boolean {
  return redactSecrets(text) !== text;
}

// -------------------------------------------------------------- tool names

/**
 * Tools whose absence is worth writing down.
 *
 * A whitelist, because the alternative is recording every typo: `sl` instead of
 * `ls` would otherwise become the permanent fact "`sl` is not installed".
 */
const DEVELOPMENT_TOOLS = new Set([
  // Package managers and runtimes
  "npm", "pnpm", "yarn", "bun", "deno", "node", "nvm", "corepack",
  "python", "python3", "pip", "pip3", "poetry", "uv", "pipx", "conda",
  "ruby", "gem", "bundle", "php", "composer", "perl",
  // Compiled languages and their tooling
  "cargo", "rustc", "rustup", "go", "java", "javac", "gradle", "mvn",
  "dotnet", "gcc", "clang", "cmake", "make", "ninja", "zig",
  // Build, test, and quality tools
  "tsc", "vite", "webpack", "esbuild", "jest", "vitest", "pytest", "tox",
  "eslint", "prettier", "ruff", "mypy", "black", "biome",
  // Infrastructure and version control
  "git", "gh", "docker", "docker-compose", "podman", "kubectl", "helm",
  "terraform", "ansible", "aws", "gcloud", "az", "vercel", "netlify",
  "flyctl", "heroku", "supabase", "wrangler", "ngrok",
  // The agents this app can install
  "claude", "codex", "gemini", "kimi", "opencode",
]);

export function isDevelopmentTool(name: string): boolean {
  return DEVELOPMENT_TOOLS.has(name.trim().toLowerCase());
}

// ---------------------------------------------------------- output parsing

/** Reduces `/usr/bin/pnpm.exe` to `pnpm`. */
function toolName(raw: string): string {
  const base = raw.trim().split(/[\\/]/).pop() ?? raw;
  return base.replace(/\.(exe|cmd|bat|ps1)$/i, "").toLowerCase();
}

/** A shell reporting that an executable does not exist. */
export function parseMissingCommand(output: string): string | null {
  const patterns = [
    // bash/sh: "bash: pnpm: command not found"
    /(?:^|\n)[^\n:]*:\s*([\w.+-]+):\s*command not found/i,
    // zsh: "zsh: command not found: pnpm"
    /command not found:\s*([\w.+-]+)/i,
    // PowerShell: "The term 'pnpm' is not recognized as a name of a cmdlet"
    /The term '([^']+)' is not recognized/i,
    // cmd.exe: "'pnpm' is not recognized as an internal or external command"
    /'([^']+)' is not recognized as an internal or external command/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(output);
    const name = match?.[1]?.trim();
    if (name) return toolName(name);
  }
  return null;
}

// ------------------------------------------------------------- extraction

/**
 * Facts worth keeping from one finished command.
 *
 * Returns an empty array almost always — that is the design, not a gap. A
 * command that worked teaches nothing the project's own files do not already
 * say, so only a blocking gap in the environment survives.
 */
export function extractMemoryCandidates(
  observation: CommandObservation,
): MemoryCandidate[] {
  const { command, exitCode, timedOut } = observation;

  // A timed-out command proved nothing: it may have been about to fail.
  if (timedOut) return [];
  // A command carrying a credential is dropped whole.
  if (containsSecret(command)) return [];
  // Success teaches only that it worked, which the repository already implies.
  if (exitCode === 0 || exitCode === null) return [];

  const output = redactSecrets((observation.output ?? "").slice(0, MAX_SCAN_CHARS));
  const missing = parseMissingCommand(output);
  if (!missing || !isDevelopmentTool(missing)) return [];

  return [
    {
      kind: "missing-tool",
      subject: `tool:${missing}`,
      content: `\`${missing}\` is not installed on this machine.`,
      importance: 4,
    },
  ];
}

/** Identity used to supersede an older fact about the same subject. */
export function candidateKey(candidate: Pick<MemoryCandidate, "subject">): string {
  return candidate.subject;
}
