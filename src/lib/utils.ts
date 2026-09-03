import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Message } from "@/types/chat";
import type { ModelPricing } from "@/types/models";
import { DATE_GROUP_ORDER, type ChatSession, type DateGroup } from "@/types/session";
import { SESSION_TITLE_MAX_LENGTH } from "@/lib/constants";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeDate(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return formatTimestamp(ts);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function dateGroupFor(ts: number, now: number = Date.now()): DateGroup {
  const dayMs = 86_400_000;
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const startOfDate = new Date(ts).setHours(0, 0, 0, 0);
  const diffDays = Math.round((startOfToday - startOfDate) / dayMs);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Last 7 Days";
  if (diffDays <= 30) return "Last 30 Days";
  return "Older";
}

export function groupSessionsByDate(sessions: ChatSession[]): Array<[DateGroup, ChatSession[]]> {
  const groups = new Map<DateGroup, ChatSession[]>();
  for (const session of sessions) {
    const group = dateGroupFor(session.updatedAt);
    const list = groups.get(group) ?? [];
    list.push(session);
    groups.set(group, list);
  }
  return DATE_GROUP_ORDER.filter((g) => groups.has(g)).map((g) => [g, groups.get(g) ?? []]);
}

export function truncateMiddle(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const half = Math.floor((maxLength - 1) / 2);
  return `${text.slice(0, half)}…${text.slice(text.length - half)}`;
}

export function deriveSessionTitle(prompt: string): string {
  const flat = prompt.replace(/\s+/g, " ").trim();
  if (flat.length <= SESSION_TITLE_MAX_LENGTH) return flat || "New chat";
  return `${flat.slice(0, SESSION_TITLE_MAX_LENGTH).trimEnd()}…`;
}

/**
 * Compact a chat title for the sidebar. Keeps the full title available via
 * tooltip; this is just the visible cap.
 */
export function compactTitle(title: string, maxLength = 22): string {
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength).trimEnd()}…`;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimates API spend for a message given its model pricing.
 * Because only total tokens are stored, the average of input and output
 * prices is used. Returns undefined when pricing is unknown or zero tokens.
 */
export function estimateMessageCost(
  pricing: ModelPricing | undefined,
  tokensUsed: number,
): number | undefined {
  if (!pricing || tokensUsed <= 0) return undefined;
  const avgPrice = (pricing.inputPrice + pricing.outputPrice) / 2;
  return (tokensUsed * avgPrice) / 1_000_000;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: amount < 1 ? 4 : 2,
  }).format(amount);
}

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return String(tokens);
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function messagesToMarkdown(session: ChatSession, messages: Message[]): string {
  const lines: string[] = [`# ${session.title}`, ""];
  for (const message of messages) {
    const speaker = message.role === "user" ? "You" : "Black One";
    lines.push(`## ${speaker} — ${new Date(message.createdAt).toLocaleString()}`, "");
    lines.push(message.content, "");
  }
  return lines.join("\n");
}

export function sessionToJson(session: ChatSession, messages: Message[]): string {
  return JSON.stringify({ session, messages }, null, 2);
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function hexToHsl(hex: string): Hsl | null {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function formatHslChannels({ h, s, l }: Hsl): string {
  return `${h} ${s}% ${l}%`;
}

/**
 * Produces light and dark HSL channel strings from a single hex color.
 * The light variant is the color itself; the dark variant is lighter and
 * slightly more saturated so it pops against dark backgrounds.
 */
export function accentChannelsFromHex(
  hex: string,
): { light: string; dark: string } | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const light = formatHslChannels(hsl);
  const dark = formatHslChannels({
    h: hsl.h,
    s: clamp(hsl.s + 10, 0, 100),
    l: clamp(hsl.l + 18, 0, 100),
  });
  return { light, dark };
}

