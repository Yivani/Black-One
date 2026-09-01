/**
 * Pure path and terminal-output helpers used by the tool runtime.
 *
 * This module deliberately has no imports: the workspace sandbox and the
 * terminal result parser are the highest-risk logic in the app, and keeping
 * them dependency-free is what makes them unit-testable.
 */

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Collapses `.` and `..` segments and normalizes separators and case so that
 * prefix comparisons cannot be defeated by traversal. `C:\proj\..\..\Windows`
 * normalizes to `c:/windows`, not `c:/proj/../../windows`.
 */
export function normalizePathForCompare(value: string): string {
  const slashed = value.replace(/\\/g, "/");
  const driveMatch = slashed.match(/^([a-zA-Z]:)\//);
  let prefix = "";
  if (driveMatch) {
    prefix = `${driveMatch[1].toLowerCase()}/`;
  } else if (slashed.startsWith("/")) {
    prefix = "/";
  }
  const rest = slashed.slice(prefix.length);
  const segments: string[] = [];
  for (const segment of rest.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      const last = segments[segments.length - 1];
      if (segments.length > 0 && last !== "..") {
        segments.pop();
      } else if (!prefix) {
        // A relative path may legitimately climb above its own base.
        segments.push("..");
      }
      continue;
    }
    segments.push(segment);
  }
  return (prefix + segments.join("/")).toLowerCase();
}

/**
 * Whether `path` resolves inside one of `roots`. Both sides are normalized
 * first, so this is a real containment test rather than a string prefix test.
 *
 * An empty `roots` list means "no workspace restriction configured"; callers
 * that must fail closed check `roots.length` themselves.
 */
export function pathLooksInsideAny(path: string, roots: string[]): boolean {
  if (roots.length === 0) return true;
  const normalized = normalizePathForCompare(path);
  return roots.some((root) => {
    const rootNormalized = normalizePathForCompare(root);
    if (rootNormalized === "") return false;
    return (
      normalized === rootNormalized ||
      normalized.startsWith(`${rootNormalized}/`)
    );
  });
}

/** Resolves a possibly-relative tool path against the first attached folder. */
export function resolvePath(path: string, attachedFolders: string[]): string {
  if (attachedFolders.length === 0) return path;
  const normalized = path.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    (/^[a-z]:/i.test(normalized) && normalized.length > 2 && normalized[2] === "/")
  ) {
    return path;
  }
  const base = attachedFolders[0];
  return `${base.replace(/\\/g, "/")}/${normalized}`;
}

/**
 * Removes CSI, OSC and other escape sequences. A PTY interleaves colour codes,
 * cursor movement and title updates with real output; none of that should
 * reach the model.
 */
export function stripAnsi(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/\u001B[@-Z\\-_]/g, "");
}

export interface TerminalScript {
  /** Text written into the PTY, newline-terminated by the caller. */
  script: string;
  beginMarker: string;
  endMarker: string;
  exitPrefix: string;
}

export interface TerminalScriptOptions {
  command: string;
  /** Directory the command must run in. */
  cwd: string;
  /** Directory the terminal was opened in; a `cd` is emitted only if it differs. */
  terminalCwd: string;
  /** Display name of the shell, e.g. "PowerShell", "cmd", "bash". */
  shell: string;
  /** Unique token making this run's markers distinct from any prior run. */
  token: string;
}

/**
 * Builds a script that brackets the command with markers so its output can be
 * separated from the shell's own echo, prompts, and any earlier scrollback.
 */
export function buildTerminalScript(
  options: TerminalScriptOptions,
): TerminalScript {
  const { command, cwd, terminalCwd, shell, token } = options;
  const beginMarker = `__BLACKONE_BEGIN_${token}__`;
  const endMarker = `__BLACKONE_END_${token}__`;
  const exitPrefix = `__BLACKONE_EXIT_${token}_`;

  const normalizedShell = shell.toLowerCase();
  const isCmd = normalizedShell === "cmd" || normalizedShell.includes("cmd.exe");
  const isPowerShell =
    normalizedShell.includes("powershell") || normalizedShell.includes("pwsh");

  const needsCd =
    normalizePathForCompare(cwd) !== normalizePathForCompare(terminalCwd);

  const lines: string[] = [];
  if (isCmd) {
    lines.push(`echo ${beginMarker}`);
    if (needsCd) lines.push(`cd /d "${cwd}"`);
    lines.push(command);
    lines.push(`echo ${exitPrefix}%ERRORLEVEL%__`);
    lines.push(`echo ${endMarker}`);
  } else if (isPowerShell) {
    lines.push(`Write-Host "${beginMarker}"`);
    if (needsCd) lines.push(`cd "${cwd}"`);
    lines.push(command);
    // $LASTEXITCODE covers native executables; $? covers cmdlet failures.
    // `if ($LASTEXITCODE)` is false for both 0 and $null, so a clean native
    // run falls through to $? and reports 0.
    lines.push(
      `Write-Host "${exitPrefix}$(if ($LASTEXITCODE) { $LASTEXITCODE } elseif ($?) { 0 } else { 1 })__"`,
    );
    lines.push(`Write-Host "${endMarker}"`);
  } else {
    lines.push(`echo "${beginMarker}"`);
    if (needsCd) lines.push(`cd "${cwd}"`);
    lines.push(command);
    lines.push(`echo "${exitPrefix}$?__"`);
    lines.push(`echo "${endMarker}"`);
  }

  return { script: lines.join("\n"), beginMarker, endMarker, exitPrefix };
}

export interface TerminalCapture {
  output: string;
  /** `null` when the sentinel could not be read — never treated as success. */
  exitCode: number | null;
}

function markerLinePattern(marker: string): RegExp {
  return new RegExp(`^[ \\t]*${escapeRegex(marker)}[ \\t]*$`, "m");
}

/**
 * Extracts the command's own output from raw PTY bytes, or `null` if the
 * command has not finished yet.
 *
 * The markers appear twice in the stream: once as the shell echoes the script
 * line (`echo "__BLACKONE_END_x__"`) and once as real output (`__BLACKONE_END_x__`
 * alone on its line). Anchoring to a full line is what tells them apart.
 */
export function parseTerminalOutput(
  raw: string,
  script: TerminalScript,
): TerminalCapture | null {
  const text = stripAnsi(raw).replace(/\r\n?/g, "\n");

  const endMatch = markerLinePattern(script.endMarker).exec(text);
  if (!endMatch) return null;

  const beginMatch = markerLinePattern(script.beginMarker).exec(text);
  const start =
    beginMatch && beginMatch.index + beginMatch[0].length <= endMatch.index
      ? beginMatch.index + beginMatch[0].length
      : 0;

  const captured = text.slice(start, endMatch.index);

  // Read the last sentinel: an echoed script line can contain the prefix, but
  // never the prefix followed immediately by digits.
  const exitPattern = new RegExp(
    `${escapeRegex(script.exitPrefix)}(-?\\d+)__`,
    "g",
  );
  let exitCode: number | null = null;
  for (const match of captured.matchAll(exitPattern)) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed)) exitCode = parsed;
  }

  const output = captured
    .split("\n")
    .filter((line) => !line.includes(script.exitPrefix))
    .join("\n")
    .trim();

  return { output, exitCode };
}
