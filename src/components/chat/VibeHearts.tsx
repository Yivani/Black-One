import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { useChatStore, type ChatState } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

interface HeartParticle {
  id: string;
  x: number;
  drift: number;
  delay: number;
  duration: number;
  scale: number;
  color: string;
}

const TRIGGER_WORDS = [
  "thanks",
  "thank you",
  "ty",
  "ily",
  "i love you",
  "love you",
  "good bot",
  "great bot",
  "awesome",
  "amazing",
  "perfect",
  "wonderful",
  "❤️",
  "💕",
  "💖",
  "💗",
  "💓",
  "💝",
  "😍",
  "🥰",
  "😘",
];

const HEART_COLORS = [
  "text-red-500",
  "text-pink-500",
  "text-rose-400",
  "text-red-400",
  "text-pink-400",
];

function shouldTrigger(content: string): boolean {
  const lower = content.toLowerCase();
  return TRIGGER_WORDS.some((word) => lower.includes(word.toLowerCase()));
}

function generateParticles(count: number): HeartParticle[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    x: -30 + Math.random() * 60,
    drift: -20 + Math.random() * 40,
    delay: Math.random() * 0.25,
    duration: 1.4 + Math.random() * 0.7,
    scale: 0.6 + Math.random() * 0.6,
    color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
  }));
}

function selectLastUserMessageId(state: ChatState, sessionId: string | null): string | null {
  if (!sessionId) return null;
  const list = state.messagesBySession[sessionId];
  if (!list || list.length === 0) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].role === "user") return list[i].id;
  }
  return null;
}

function selectLastUserMessageContent(state: ChatState, sessionId: string | null): string | null {
  if (!sessionId) return null;
  const list = state.messagesBySession[sessionId];
  if (!list || list.length === 0) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].role === "user") return list[i].content;
  }
  return null;
}

export function VibeHearts() {
  const enabled = useSettingsStore((s) => s.settings.appearance.vibeHearts);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const lastUserId = useChatStore((s) => selectLastUserMessageId(s, activeSessionId));
  const lastUserContent = useChatStore((s) =>
    selectLastUserMessageContent(s, activeSessionId),
  );
  const [particles, setParticles] = useState<HeartParticle[]>([]);
  const lastMessageIdRef = useRef<string | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Switching chats should not re-trigger hearts for an existing message.
    if (lastSessionIdRef.current !== activeSessionId) {
      lastSessionIdRef.current = activeSessionId;
      lastMessageIdRef.current = lastUserId;
      return;
    }

    if (!lastUserId || lastUserContent === null) return;
    if (lastUserId === lastMessageIdRef.current) return;
    lastMessageIdRef.current = lastUserId;

    if (!shouldTrigger(lastUserContent)) return;

    const newParticles = generateParticles(6 + Math.floor(Math.random() * 5));
    setParticles((prev) => [...prev, ...newParticles]);

    const maxDuration = Math.max(...newParticles.map((p) => p.duration + p.delay));
    const timer = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.some((n) => n.id === p.id)));
    }, maxDuration * 1000 + 150);

    return () => clearTimeout(timer);
  }, [enabled, activeSessionId, lastUserId, lastUserContent]);

  if (!enabled || particles.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center"
    >
      <div className="relative h-48 w-48">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="absolute bottom-0 left-1/2"
            style={{
              ["--vibe-x" as string]: `${particle.x}px`,
              ["--vibe-drift" as string]: `${particle.drift}px`,
              ["--vibe-scale" as string]: particle.scale,
              animation: `vibe-heart-float ${particle.duration}s ease-out ${particle.delay}s forwards`,
            }}
          >
            <Heart
              className={cn("size-5 fill-current", particle.color)}
              style={{ transform: "translateX(-50%)" }}
            />
          </span>
        ))}
      </div>
      <style>{`
        @keyframes vibe-heart-float {
          0% {
            transform: translateX(-50%) translateX(var(--vibe-x)) translateY(0) scale(0);
            opacity: 0;
          }
          12% {
            transform: translateX(-50%) translateX(var(--vibe-x)) translateY(-12px) scale(var(--vibe-scale));
            opacity: 1;
          }
          100% {
            transform: translateX(-50%) translateX(calc(var(--vibe-x) + var(--vibe-drift))) translateY(-180px) scale(0.25);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
