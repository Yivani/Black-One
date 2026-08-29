export const ERROR_CATEGORIES = ["startup", "render", "provider", "network", "storage", "system"] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export interface AppError {
  id: string;
  category: ErrorCategory;
  message: string;
  source: string;
  stack?: string;
  details?: string;
  occurredAt: number;
  occurrences: number;
}

interface ErrorContext {
  category?: ErrorCategory;
  source?: string;
  details?: string;
}

const STORAGE_KEY = "black-one:errors";
const MAX_ERRORS = 100;
let errors = loadErrors();
const listeners = new Set<() => void>();

function loadErrors(): AppError[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.slice(0, MAX_ERRORS) : [];
  } catch {
    return [];
  }
}

function saveErrors(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
  } catch {
    // Diagnostics must never cause another app failure.
  }
  listeners.forEach((listener) => listener());
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : JSON.stringify(value) || "Unknown error");
}

export function categorizeError(error: unknown, source = "runtime"): ErrorCategory {
  const text = `${source} ${toError(error).message}`.toLowerCase();
  if (/fetch|http|network|offline|timeout|connection/.test(text)) return "network";
  if (/provider|model|generation|api key|rate limit|429/.test(text)) return "provider";
  if (/database|indexeddb|sqlite|persist|storage|file system/.test(text)) return "storage";
  if (/bootstrap|startup|initialize|initialise/.test(text)) return "startup";
  if (/react|render|component/.test(text)) return "render";
  return "system";
}

export function reportAppError(value: unknown, context: ErrorContext = {}): AppError {
  const error = toError(value);
  const now = Date.now();
  const category = context.category ?? categorizeError(error, context.source);
  const source = context.source ?? "runtime";
  const duplicate = errors.find(
    (item) => item.message === error.message && item.source === source && now - item.occurredAt < 2_000,
  );

  if (duplicate) {
    errors = [
      { ...duplicate, occurredAt: now, occurrences: duplicate.occurrences + 1 },
      ...errors.filter((item) => item.id !== duplicate.id),
    ];
    saveErrors();
    return errors[0];
  }

  const entry: AppError = {
    id: crypto.randomUUID(),
    category,
    message: error.message || error.name,
    source,
    stack: error.stack,
    details: context.details,
    occurredAt: now,
    occurrences: 1,
  };
  errors = [entry, ...errors].slice(0, MAX_ERRORS);
  saveErrors();
  return entry;
}

export function subscribeErrors(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getErrors(): AppError[] {
  return errors;
}

export function dismissError(id: string): void {
  errors = errors.filter((error) => error.id !== id);
  saveErrors();
}

export function clearErrors(): void {
  errors = [];
  saveErrors();
}

export function installGlobalErrorHandlers(): () => void {
  const onError = (event: ErrorEvent) => {
    reportAppError(event.error ?? event.message, { source: event.filename || "window" });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportAppError(event.reason, { source: "unhandled promise" });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

export function redactErrorText(text: string): string {
  return text
    .replace(/bearer\s+[a-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/(authorization|api[-_ ]?key|token|secret)(\s*[:=]\s*)([^\s,;]+)/gi, "$1$2[redacted]")
    .replace(/([?&](?:key|token|secret|password)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(/C:\\Users\\[^\\\s]+/gi, "C:\\Users\\[user]");
}

export function errorReportText(error: AppError): string {
  const lines = [
    `Category: ${error.category}`,
    `Source: ${error.source}`,
    `Occurred: ${new Date(error.occurredAt).toISOString()}`,
    `Occurrences: ${error.occurrences}`,
    "",
    "Message:",
    error.message,
  ];
  if (error.details) lines.push("", "Context:", error.details);
  if (error.stack) lines.push("", "Stack:", error.stack);
  return redactErrorText(lines.join("\n"));
}

export function createGitHubIssueUrl(repositoryUrl: string, error: AppError): string {
  const title = `[${error.category}] ${error.message}`.slice(0, 120);
  const body = [
    "## What happened",
    "<!-- Add the steps that caused the problem. -->",
    "",
    "## Diagnostics",
    "```text",
    errorReportText(error),
    "```",
    "",
    "## Checklist",
    "- [ ] I removed any private information from this report.",
    "- [ ] I checked that this issue has not already been reported.",
  ].join("\n");
  const query = new URLSearchParams({ title, body, labels: "bug,from-app" });
  return `${repositoryUrl}/issues/new?${query}`;
}
